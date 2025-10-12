import React, { useEffect, useState, useRef } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, StyleSheet, Image, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadData, ensureUser, getTodayQuestionForUser, saveAnswerAndProcessLogic, aggregate, getTodayAnswer, rewardWithMajority } from '@/src/services/store';
import { Question, UserData } from './types';
import { watchAuth } from '@/src/services/firebase';
import LoadingScreen from './components/LoadingScreen';
import ErrorScreen from './components/ErrorScreen';
import SplashScreen from './splash';
import TutorialScreen from './components/TutorialScreen';
import UserHeader from './components/UserHeader';
import colors from './styles/colors';
import * as WebBrowser from 'expo-web-browser';
import LottieView from 'lottie-react-native';
import BannerAdComponent from './components/BannerAdComponent';
import { currentDateKey } from '@/src/utils/date';
import { createRewardedInterstitial, attachRewardedInterstitial } from '@/src/services/ads';

export default function App() {
  // 화면 흐름 상태
  const [showSplash, setShowSplash] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialChecked, setTutorialChecked] = useState(false);

  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [userChoice, setUserChoice] = useState<number | null>(null);
  const [agg, setAgg] = useState<{ total: number; c0: number; c1: number; p0: number; p1: number }>({
    total: 0,
    c0: 0,
    c1: 0,
    p0: 50,
    p1: 50,
  });
  const [loading, setLoading] = useState(true);
  const [showTomorrowModal, setShowTomorrowModal] = useState(false);
  const [msg, setMsg] = useState('');
  const [rewardCompleted, setRewardCompleted] = useState(false);
  const [showRewardInfoModal, setShowRewardInfoModal] = useState(false);
  const [showRewardDoneModal, setShowRewardDoneModal] = useState(false);
  const [lastRewardMultiplier, setLastRewardMultiplier] = useState<number | null>(null);
  
  // 광고 관련 상태
  const [adLoaded, setAdLoaded] = useState(false);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const rewardedAdRef = useRef<any>(null);

  // 스플래시 완료 후 튜토리얼 확인
  const handleSplashFinish = async () => {
    setShowSplash(false);
    
    // 튜토리얼을 본 적이 있는지 확인
    const hasSeenTutorial = await AsyncStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
    setTutorialChecked(true);
  };

  // 튜토리얼 완료
  const handleTutorialFinish = async () => {
      await AsyncStorage.setItem('hasSeenTutorial', 'true');
      setShowTutorial(false);
  };

  useEffect(() => {
    loadData();
    const unsub = watchAuth(setUser);
    return unsub;
  }, []);

  // 광고 초기화 및 이벤트 리스너 설정
  useEffect(() => {
    if (!user || !question || userChoice === null) return;

    console.log('🎬 보상형 광고 초기화 시작');
    const ad = createRewardedInterstitial();
    rewardedAdRef.current = ad;

    const unsubscribe = attachRewardedInterstitial(ad, {
      onLoaded: () => {
        console.log('✅ 광고 로드 완료');
        setAdLoaded(true);
        setIsLoadingAd(false);
      },
      onEarned: async () => {
        console.log('🎁 광고 시청 완료 - 보상 지급 시작');
        await handleAdWatchComplete();
      },
      onClosed: () => {
        console.log('❌ 광고 닫힘');
        setAdLoaded(false);
        setIsLoadingAd(false);
      }
    });

    return () => {
      console.log('🔌 광고 리스너 해제');
      unsubscribe();
    };
  }, [user, question, userChoice]);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      setLoading(true);
      const data = await ensureUser(user.uid);
      setUserData(data);
      
      const q = getTodayQuestionForUser(data);
      setQuestion(q);

      if (q) {
        // 오늘 답변 기록을 가져와 UI 상태 설정
        const todayAnswer = await getTodayAnswer(user.uid, q.question_id);
        if (todayAnswer) {
          setUserChoice(todayAnswer.selected_option_index);
          // 보상 수령 완료 상태 반영 (버튼 숨기기)
          if (todayAnswer.rewarded) {
            setRewardCompleted(true);
            // 보상 완료 배너 복원 (배수에 따른 색상 적용)
            const multiplier = data.streakCount >= 31 ? 3 : data.streakCount >= 11 ? 2 : 1;
            setLastRewardMultiplier(multiplier);
            setMsg('보상완료💎');
          } else {
            setRewardCompleted(false);
          }
        } else {
          setUserChoice(null);
          setRewardCompleted(false);
        }
        
        const result = await aggregate(q.question_id);
        setAgg(result);
      } else {
        setUserChoice(null);
      }
      setLoading(false);
    };
    init();
  }, [user]);

  const handleVote = async (index: 0 | 1) => {
    if (!user || !userData || !question) return;
    if (userChoice !== null) {
      setShowTomorrowModal(true);
      return;
    }

    // 1. 즉시 UI 업데이트 (사용자 경험 우선)
    setUserChoice(index);
    setRewardCompleted(false);
    setMsg('');
    
    // 2. 백그라운드에서 AI 태그 생성 및 저장 처리
    setTimeout(async () => {
      try {
        const updatedUserData = await saveAnswerAndProcessLogic(userData, question, index);
        setUserData(updatedUserData);
        const result = await aggregate(question.question_id);
        setAgg(result);
        console.log('✅ 백그라운드 투표 처리 완료');
      } catch (e: any) {
        console.error('❌ 백그라운드 투표 처리 실패:', e);
        // 에러 발생 시에도 UI는 이미 업데이트됨 (사용자 경험 유지)
      }
    }, 0);
  };

  const shareInvite = async () => {
    await Share.share({
      message: `🎮 PickPlay! 🎯\n\n매일 30초 나의 성향을 선택하고 100% 보상을 적립해 보세요!\n💎 소수의 선택과 같을때 +특별 보상!\n🔥 연속 참여 시 추가 2배, 3배로 강화!\n\n매일 나를 마주하는 꾸준한 30초!\n오늘부터 긍정 루틴을 달성해 보세요👇\nhttps://pickplay.waveon.me/`
    });
  };

  const openLink = async (url: string) => {
    try { await WebBrowser.openBrowserAsync(url, { enableBarCollapsing: true }); } catch {}
  };

  // streak 배수 계산 (기존 규칙 유지)
  const getStreakMultiplier = (streak?: number) => {
    if (!streak) return 1;
    return streak >= 31 ? 3 : streak >= 11 ? 2 : 1;
  };

  const handleGrantReward = () => {
    // 1단계: 안내 모달 표시
    setMsg('');
    setShowRewardInfoModal(true);
  };

  const handleConfirmRewardInfo = () => {
    // 2단계: 안내 모달 닫고 광고 표시
    setShowRewardInfoModal(false);
    
    if (adLoaded && rewardedAdRef.current) {
      console.log('🎬 광고 표시 시작');
      try {
        rewardedAdRef.current.show();
      } catch (error) {
        console.error('❌ 광고 표시 실패:', error);
        Alert.alert('광고 로드 중', '잠시 후 다시 시도해주세요.');
      }
    } else {
      console.log('⏳ 광고가 아직 로드되지 않음 - 로드 대기 중');
      Alert.alert('광고 준비 중', '광고를 불러오는 중입니다. 잠시만 기다려주세요.');
      setIsLoadingAd(true);
    }
  };

  const handleAdWatchComplete = async () => {
    // 3단계: 광고 시청 완료 후 포인트 지급
    if (!user || !userData || !question || userChoice === null) return;

    try {
      // Firestore에서 최신 데이터 가져오기 (백그라운드 처리와 타이밍 이슈 방지)
      const latestUserData = await ensureUser(user.uid);
      
      const reward = await rewardWithMajority(
        user.uid,
        question.question_id,
        userChoice,
        latestUserData.streakCount
      );

      // 최신 사용자 데이터 기반으로 업데이트 (포인트 반영)
      const updatedUserData = {
        ...latestUserData,
        points: latestUserData.points + reward.totalPoints
      };
      setUserData(updatedUserData);

      // 보상 메시지 생성
      const majorityText = reward.myIsMajority ? '' : ' (소수보상)';
      const multiplierText = reward.multiplier > 1 ? ` X${reward.multiplier}배` : '';
      setMsg(`${reward.base}P${majorityText}${multiplierText} 획득완료! 💎`);
      setLastRewardMultiplier(reward.multiplier);
      
      setRewardCompleted(true);
      setShowRewardDoneModal(true);
      
      console.log('✅ 포인트 지급 및 완료 모달 표시 완료');
    } catch (error) {
      console.error('❌ 포인트 지급 실패:', error);
      Alert.alert('오류', '포인트 지급 중 문제가 발생했습니다.');
    }
  };

  // 1. 스플래시 화면
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // 2. 튜토리얼 화면 (첫 방문자만)
  if (showTutorial) {
    return <TutorialScreen onFinish={handleTutorialFinish} />;
  }

  // 3. 튜토리얼 체크 완료 전까지 로딩
  if (!tutorialChecked) {
    return <LoadingScreen />;
  }

  // 4. 메인 화면 로딩 및 에러 처리
  if (loading) return <LoadingScreen />;
  if (!question) return <ErrorScreen title="오늘의 질문을 불러오지 못했습니다." />;

  // 5. 메인 화면
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 5, paddingBottom: 20, justifyContent: 'center' }}>

          {/* 우측 상단 유저 헤더 */}
          {userData && (
            <UserHeader userData={{
              points: userData.points,
              streakCount: userData.streakCount,
              nickname: userData.nickname,
              totalSelections: userData.totalSelections,
              characterId: userData.characterId,
              adjective1: userData.adjective1,
              adjective2: userData.adjective2,
            }} />
          )}

          {/* 좌측 상단 로고 */}
          <View style={{ position: 'absolute', top: 18, left: 24, zIndex: 10 }}>
            <Image source={require('../assets/images/logo_pickplay.png')} style={{ width: 120, height: 40, resizeMode: 'contain' }} />
        </View>

          {/* 중앙 서브타이틀 */}
          <View style={{ alignItems: 'center', marginTop: 100, marginBottom: 32 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' }}>
              매일 나의 선택을 가치로 바꾸는 <Text style={{ color: colors.primary }}> 30초 루틴</Text>{'\n'}취향? 직감? <Text style={{ color: colors.primary }}> 픽플</Text>에서는 모든 선택을 보상합니다.
          </Text>
        </View>

          {/* 질문 카드 */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, marginBottom: 24, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.primary, textAlign: 'center', lineHeight: 28, marginBottom: 24 }}>
              Q. 나의 <Text style={{ color: colors.accent }}>{(question as any).text ?? (question as any).question_text} 취향은?</Text>
          </Text>

            {/* 선택지 */}
            <View style={{ gap: 16 }}>
              <TouchableOpacity onPress={() => handleVote(0)} activeOpacity={0.7} style={{ padding: 20, borderRadius: 16, backgroundColor: userChoice === 0 ? 'transparent' : colors.background, borderWidth: 2, borderColor: userChoice === 0 ? 'transparent' : colors.border, alignItems: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, position: 'relative', opacity: userChoice !== null && userChoice !== 0 ? 0.5 : 1, marginHorizontal: 20 }}>
                {userChoice === 0 && (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.primary, borderRadius: 16 }} />
                )}
                <Text style={{ fontSize: 16, fontWeight: '400', color: userChoice === 0 ? 'white' : colors.text }}>{question.option_1_text}</Text>
                {userChoice === 0 && (
                  <View style={{ position: 'absolute', top: '50%', right: '20%', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', zIndex: 99999, transform: [{ translateY: -30 }] }}>
                    <Image source={require('../assets/images/img_stamp.png')} style={{ width: 50, height: 50, resizeMode: 'contain' }} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => handleVote(1)} activeOpacity={0.7} style={{ padding: 20, borderRadius: 16, backgroundColor: userChoice === 1 ? 'transparent' : colors.background, borderWidth: 2, borderColor: userChoice === 1 ? 'transparent' : colors.border, alignItems: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, position: 'relative', opacity: userChoice !== null && userChoice !== 1 ? 0.5 : 1, marginHorizontal: 20 }}>
                {userChoice === 1 && (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.primary, borderRadius: 16 }} />
                )}
                <Text style={{ fontSize: 16, fontWeight: '400', color: userChoice === 1 ? 'white' : colors.text }}>{question.option_2_text}</Text>
                {userChoice === 1 && (
                  <View style={{ position: 'absolute', top: '50%', right: '20%', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', zIndex: 99999, transform: [{ translateY: -30 }] }}>
                    <Image source={require('../assets/images/img_stamp.png')} style={{ width: 50, height: 50, resizeMode: 'contain' }} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

          {/* 정보 카드 */}
          <View style={{ backgroundColor: 'transparent', paddingVertical: 20, paddingHorizontal: 15, marginBottom: 24, borderRadius: 16, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 8, width: '100%' }}>
              <Image source={require('../assets/images/img_calendar.png')} style={{ width: 60, height: 60, borderRadius: 8, marginRight: 16 }} resizeMode="contain" />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', fontSize: 18, color: colors.accent, lineHeight: 24, marginBottom: 8 }}>연속참여 보상 강화!</Text>
                <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text, lineHeight: 20 }}>11일 연속 참여 부터 보상 2배로 UP!{`\n`}31일 연속 참여 부터 보상 3배로 UP!</Text>
              </View>
            </View>
          </View>

          {/* 결과 카드 */}
        {userChoice !== null && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 24, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary, textAlign: 'center', marginBottom: 16 }}>PickPlay 유니버스 선택결과</Text>
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>{question.option_1_text}</Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>{question.option_2_text}</Text>
            </View>
                <View style={{ height: 16, backgroundColor: colors.border, borderRadius: 8, overflow: 'hidden', flexDirection: 'row' }}>
                    <View style={{ flex: Math.max(agg.p0, 0), backgroundColor: userChoice === 0 ? colors.secondary : colors.border }} />
                    <View style={{ flex: Math.max(agg.p1, 0), backgroundColor: userChoice === 1 ? colors.secondary : colors.border }} />
            </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: userChoice === 0 ? colors.secondary : colors.textSecondary }}>{agg.p0}%</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: userChoice === 1 ? colors.secondary : colors.textSecondary }}>{agg.p1}%</Text>
            </View>
          </View>
              <Text style={{ fontSize: 14, color: colors.textLight, textAlign: 'center', marginTop: 16 }}>총 {agg.total}명 참여</Text>
          </View>
        )}

          {/* 공유 버튼 (보상 버튼 위) */}
          <TouchableOpacity onPress={shareInvite} style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 16, color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' }}>🔗 30초루틴 픽플레이 친구에게 알려주기</Text>
        </TouchableOpacity>

          {/* 보상 받기 버튼 (광고 연동 전 플레이스홀더) */}
            {userChoice !== null && !rewardCompleted && (
              <TouchableOpacity onPress={handleGrantReward} style={{
                  marginTop: 8,
                  alignSelf: 'center',
                  backgroundColor: (() => { const m = getStreakMultiplier(userData?.streakCount); return m === 3 ? '#8e44ad' : m === 2 ? '#2ecc71' : colors.primary; })(),
              borderRadius: 12,
              paddingVertical: 16,
              paddingHorizontal: 32,
                  shadowColor: (() => { const m = getStreakMultiplier(userData?.streakCount); return m === 3 ? '#8e44ad' : m === 2 ? '#2ecc71' : colors.primary; })(),
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 6,
            }}>
              <Text style={{ fontSize: 18, color: 'white', fontWeight: '700', textAlign: 'center' }}>🎁 보상 받기</Text>
          </TouchableOpacity>
        )}

        {rewardCompleted && !!msg && (
            <View style={{
              backgroundColor: lastRewardMultiplier === 3 ? '#8e44ad' : lastRewardMultiplier === 2 ? '#2ecc71' : colors.primary,
              borderRadius: 12,
              padding: 14,
              marginTop: 12,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 16, color: 'white', fontWeight: '700' }}>{msg}</Text>
          </View>
        )}

          {/* 연속 참여 정보 */}
        {userData && (
            <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 20, paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary, textAlign: 'center' }}>{userData.streakCount}일 연속 참여 중!</Text>
              <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 }}>
                  {userData.streakCount >= 11 ? ` ${userData.streakCount >= 31 ? '3배' : '2배'} 보상 적용 중!` : `내일도 참여하면 ${userData.streakCount + 1}일 연속 달성!`}
              </Text>
              {/* 다음 배수까지 남은 일수 안내 */}
              {(() => {
                const s = userData.streakCount || 0;
                if (s < 10) {
                  const left = 10 - s;
                  return (
                    <Text style={{ fontSize: 16, color: colors.primary, textAlign: 'center', marginTop: 4 }}>
                      {`${left}일 더 참여하면 그 이후부터 모든 보상이 2배!`}
                    </Text>
                  );
                }
                if (s >= 10 && s < 30) {
                  const left = 30 - s;
                  return (
                    <Text style={{ fontSize: 16, color: colors.primary, textAlign: 'center', marginTop: 4 }}>
                      {`${left}일 더 참여하면 그 이후부터 모든 보상이 3배!`}
                    </Text>
                  );
                }
                return null;
              })()}
          </View>
        )}

          {/* 배너 광고(구분선 위 배치) */}
          <View style={{ width: '100%', marginTop: 20, marginBottom: 8 }}>
         <BannerAdComponent />
          </View>

          {/* 푸터 (구분선) */}
          <View style={{ backgroundColor: colors.background, paddingVertical: 12, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center', marginTop: 8 }}>
            <Text style={{ fontSize: 12, color: colors.textLight, textAlign: 'center', lineHeight: 16 }}>
              © 2025 PickPlay{`\n`}KWCC Co., Ltd. | Emkoo{`\n`}907, Dongtan-daero 646-2{`\n`}Hwaseong-si, Gyeonggi-do, Republic of Korea{`\n`}e-mail: cokwcc@gmail.com{`\n`}tel: +82-10-4857-4876{`\n`}version: 1.0.0
          </Text>
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity onPress={() => openLink('https://pickplay.waveon.me/pages/1757994427672')} activeOpacity={0.7}><Text style={{ fontSize: 12, color: colors.primary }}>개인정보처리방침</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => openLink('https://pickplay.waveon.me/pages/1757994808102')} activeOpacity={0.7}><Text style={{ fontSize: 12, color: colors.primary }}>이용약관</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => openLink('https://pickplay.waveon.me/pages/1757817752093')} activeOpacity={0.7}><Text style={{ fontSize: 12, color: colors.primary }}>고객센터</Text></TouchableOpacity>
            </View>
          </View>

          </View>
        </ScrollView>

      {/* 내일 다시 만나요 모달 */}
      {showTomorrowModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginHorizontal: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary, textAlign: 'center', marginBottom: 16 }}>내일 다시 만나요!</Text>
            <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 24 }}>오늘의 선택은 완료되었어요!{`\n`}내일 새로운 질문으로 다시 만나요! ✨</Text>
            <TouchableOpacity onPress={() => setShowTomorrowModal(false)} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 16, color: 'white', fontWeight: '600', textAlign: 'center' }}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 보상 안내 모달 */}
      {showRewardInfoModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginHorizontal: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary, textAlign: 'center', marginBottom: 8 }}>당신의 선택으로 포인트가 생성되었습니다.</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20 }}>광고 시청 후, 포인트를 적립하세요.</Text>
            <TouchableOpacity onPress={handleConfirmRewardInfo} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 16, color: 'white', fontWeight: '600', textAlign: 'center' }}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 적립 완료 모달 */}
      {showRewardDoneModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginHorizontal: 40 }}>
            <View style={{ width: 120, height: 120, marginBottom: 12 }}>
              <LottieView
                source={{ uri: 'https://lottie.host/c691c7ab-e2e2-4a77-a50e-cef6c130dce1/GjbXQZOTda.lottie' }}
                autoPlay
                loop={false}
                style={{ width: 120, height: 120 }}
              />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary, textAlign: 'center', marginBottom: 20 }}>보상이 적립되었습니다.</Text>
            <TouchableOpacity onPress={() => setShowRewardDoneModal(false)} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 16, color: 'white', fontWeight: '600', textAlign: 'center' }}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

        </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  content: { padding: 16 },
});
