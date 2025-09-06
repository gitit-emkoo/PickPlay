import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, where } from 'firebase/firestore';
import LottieView from 'lottie-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BannerAdComponent from './components/BannerAdComponent';
import ErrorScreen from './components/ErrorScreen';
import LoadingScreen from './components/LoadingScreen';
import TutorialScreen from './components/TutorialScreen';
import UserHeader from './components/UserHeader';
import { attachRewardedInterstitial, createRewardedInterstitial, initAds } from './services/ads';
import { db, watchAuth } from './services/firebase';
import { initializeNotifications, scheduleStreakNotification } from './services/notifications';
import { aggregate, ensureUser, getOrAssignTodayQuestion, hasUserVoted, rewardWithMajority, saveVote, watchAggregation } from './services/store';
import SplashScreen from './splash';
import colors from './styles/colors';
import { Aggregation, Question } from './types';

export default function App(){
  const [showSplash, setShowSplash] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [userData, setUserData] = useState<{ points: number; streakCount: number; lastAnswerDate: string; nickname: string } | null>(null);
  const [q, setQ] = useState<Question | null>(null);
  const [agg, setAgg] = useState<Aggregation>({total:0,c0:0,c1:0,p0:0,p1:0});
  const [loading, setLoading] = useState(true);
  const [adReady, setAdReady] = useState(false); // 광고 준비 상태를 false로 초기화
  const [msg, setMsg] = useState('');
  const [userChoice, setUserChoice] = useState<number | null>(null); // 사용자가 선택한 선택지
  const [showRewardButton, setShowRewardButton] = useState(false); // 보상 버튼 표시 여부
  const [adWatched, setAdWatched] = useState(false); // 광고 시청 완료 여부
  const [rewardCompleted, setRewardCompleted] = useState(false); // 보상 적립 완료 여부
  const [, setDebugLogs] = useState<string[]>([]);
  const [showAdInfoModal, setShowAdInfoModal] = useState(false); // 광고 안내 모달
  const [showRewardDoneModal, setShowRewardDoneModal] = useState(false); // 적립 완료 모달
  const [showAdRetryModal, setShowAdRetryModal] = useState(false); // 광고 재시도 모달

  // 보상 메시지 설정 함수
  const setRewardMessage = (totalReward: number, myIsMajority: boolean) => {
    setMsg(myIsMajority ? 
      `${totalReward}P 획득완료! 💎` :
      `${totalReward}P +(소수보상 5P) 획득완료! 💎`
    );
  };
  const [showTomorrowModal, setShowTomorrowModal] = useState(false); // 내일 다시 만나요 모달


  const rewarded = useMemo(()=>{
    // 광고 초기화를 먼저 실행
    initAds();
    return createRewardedInterstitial();
  },[]);

  // 디버그 로그 추가 함수
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setDebugLogs(prev => [...prev.slice(-49), logMessage]); // 최대 50개 로그 유지
    console.log(message); // 기존 콘솔 로그도 유지
  };



  // 스플래시 화면이 끝나면 튜토리얼 또는 메인 앱 시작
  const handleSplashFinish = () => {
    setShowSplash(false);
    // 첫 사용자인지 확인 (AsyncStorage에서 확인)
    checkFirstTimeUser();
  };

  // 첫 사용자 확인
  const checkFirstTimeUser = async () => {
    try {
      const hasSeenTutorial = await AsyncStorage.getItem('hasSeenTutorial');
      if (!hasSeenTutorial) {
        setShowTutorial(true);
      }
    } catch (error) {
      console.error('튜토리얼 상태 확인 실패:', error);
      setShowTutorial(true); // 에러 시 기본적으로 튜토리얼 표시
    }
  };

  // 튜토리얼 완료 처리
  const handleTutorialFinish = async () => {
    try {
      await AsyncStorage.setItem('hasSeenTutorial', 'true');
      setShowTutorial(false);
    } catch (error) {
      console.error('튜토리얼 완료 저장 실패:', error);
      setShowTutorial(false);
    }
  };

  // 알림 초기화(권한/채널/토큰/리스너/스케줄)
  useEffect(() => {
    const init = async () => {
      const cleanup = await initializeNotifications(20, 15);
      addDebugLog('🔔 알림 초기화 완료');
    return cleanup;
    };
    const maybeCleanup = init();
    return () => {
      // cleanup promise 처리
      Promise.resolve(maybeCleanup).then(fn => {
        if (typeof fn === 'function') fn();
      });
    };
  }, []);

  useEffect(()=>{
    watchAuth(async(u: { uid: string } | null)=>{
      setUser(u); 
      if(u?.uid) {
        const userDataResult = await ensureUser(u.uid);
        setUserData(userDataResult);
      } else {
        setUserData(null);
      }
    });
    
    // 광고 초기화는 이미 useMemo에서 실행됨
    const detach = attachRewardedInterstitial(rewarded,{
      onLoaded:()=>{
        addDebugLog('🎯 광고 준비 완료!');
        setAdReady(true);
      },
      onEarned:async()=>{
        // 광고 시청 완료 → 최신 상태에서 보상 지급하도록 플래그만 세움
        addDebugLog('💰 광고 시청 완료!');
        setAdWatched(true);
      },
      onClosed:()=>{ 
        addDebugLog('❌ 광고 종료, 새 광고 로드 시작');
        setAdReady(false); 
        // 새 광고 로드 시작 (로드 완료는 onLoaded에서 처리됨)
        setTimeout(() => {
          rewarded.load();
        }, 1000); // 1초 후 새 광고 로드
      }
    });
    return ()=>{ if(detach) detach(); };
  },[user?.uid]);

  // 광고 시청 완료 시 최신 상태로 보상 지급 및 UI 업데이트
  useEffect(() => {
    if (!adWatched || rewardCompleted) return;
    (async () => {
      addDebugLog('🎯 광고 시청 완료 처리 시작');
      await grantReward();
      setShowRewardDoneModal(true);
      // 보상 완료 후 버튼은 숨겨 중복 표시 방지
      setShowRewardButton(false);
    })();
  }, [adWatched]);

  // 질문 변경 시 실시간 집계 구독
  useEffect(() => {
    if (!q?.id) return;
    const unsubscribe = watchAggregation(q.id, (result: Aggregation) => {
      setAgg(result);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [q?.id]);

  useEffect(()=>{
    (async()=>{
      if(!user?.uid) return;
      
      // 0. 사용자 데이터 로드
      try {
        const userDataFromStore = await ensureUser(user.uid);
          setUserData(userDataFromStore);
          console.log('👤 사용자 데이터 로드:', userDataFromStore);
      } catch (error) {
        console.error('사용자 데이터 로드 실패:', error);
      }
      
      // 1. 오늘 질문 배정(승자 라우팅 반영)
      let qq = await getOrAssignTodayQuestion(user.uid);
      
      if (qq && 'title' in qq && 'options' in qq) {
        setQ(qq as Question);
        const aggData = await aggregate(qq.id);
        setAgg(aggData);
        
                      // 사용자가 이미 투표했는지 확인
              try {
                // AsyncStorage에서 먼저 확인
                const savedVote = await AsyncStorage.getItem(`vote_${qq.id}`);
                if (savedVote) {
                  const voteData = JSON.parse(savedVote);
                  if (voteData.uid === user.uid) {
                    console.log('🔄 AsyncStorage에서 투표 상태 복원:', voteData);
                    setUserChoice(voteData.optionIndex);
                    
                                         // 투표 후 보상이 이미 지급되었는지 확인
                     const rewardKey = `reward_${qq.id}_${user.uid}`;
                     const rewardStatus = await AsyncStorage.getItem(rewardKey);
                     if (rewardStatus) {
                       const rewardData = JSON.parse(rewardStatus);
                       // 기본 보상 계산 (출석 보너스 제외)
                       const baseReward = rewardData.myIsMajority ? 5 : 10;
                       const totalReward = rewardData.base;
                       
                       setRewardMessage(baseReward, rewardData.myIsMajority);
                       setRewardCompleted(true);
                       // 이미 보상 완료 → 버튼 숨김(중복/혼동 방지)
                       setShowRewardButton(false);
                     } else {
                       // 보상이 지급되지 않았으면 보상 버튼 표시
                       setShowRewardButton(true);
                     }
                  }
                } else {
                  // Firestore에서 확인
                  const hasVoted = await hasUserVoted(user.uid, qq.id);
                  if (hasVoted) {
                    const votes = await getDocs(
                      query(
                        collection(db, 'votes'), 
                        where('uid', '==', user.uid), 
                        where('questionId', '==', qq.id)
                      )
                    );
                    if (!votes.empty) {
                      const voteData = votes.docs[0].data();
                      console.log('🔄 Firestore에서 투표 상태 복원:', voteData);
                      setUserChoice(voteData.optionIndex);
                      
                      // 투표 후 보상이 이미 지급되었는지 확인
                      const rewardKey = `reward_${qq.id}_${user.uid}`;
                      const rewardStatus = await AsyncStorage.getItem(rewardKey);
                      if (rewardStatus) {
                        const rewardData = JSON.parse(rewardStatus);
                        // 기본 보상 계산 (출석 보너스 제외)
                        const baseReward = rewardData.myIsMajority ? 5 : 10;
                        const totalReward = rewardData.base;
                        
                        setRewardMessage(baseReward, rewardData.myIsMajority);
                        setRewardCompleted(true);
                        // 이미 보상 완료 → 버튼 숨김(중복/혼동 방지)
                        setShowRewardButton(false);
                      } else {
                        // 보상이 지급되지 않았으면 보상 버튼 표시
                        setShowRewardButton(true);
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('투표 확인 에러:', error);
              }
      }
      setLoading(false);
    })();
  },[user?.uid]);

  const vote = async(i: number)=>{
    if(!user?.uid || !q) return;
    
    try {
      addDebugLog(`🗳️ 투표 시작: uid=${user.uid}, questionId=${q.id}, optionIndex=${i}`);
      await saveVote(user.uid, q.id, i);
      setUserChoice(i); // 사용자 선택 저장
      
      // 투표 후 집계 다시 가져오기
      addDebugLog('📊 투표 후 집계 업데이트 시작');
      const newAgg = await aggregate(q.id);
      addDebugLog(`📊 새로운 집계 결과: ${JSON.stringify(newAgg)}`);
      setAgg(newAgg);
      
      // 보상 버튼 노출 (광고/모달은 보상 버튼 클릭 시)
      setShowRewardButton(true);
      setRewardCompleted(false);
      
    } catch (error) {
      addDebugLog(`❌ 투표 실패: ${error}`);
      if (error instanceof Error) {
        setMsg(error.message); // 중복 투표 등의 에러 메시지 표시
      }
    }
  };

  const shareInvite = async()=>{
    await Share.share({ 
      message: `🎮 PickPlay! 🎯
      
매일 30초 나의 성향을 선택하고 100% 보상을 적립해 보세요!
💎 소수의 선택과 같을때 +특별 보상!
🔥 연속 참여 시 추가 2배, 3배로 강화!

매일 나를 마주하는 꾸준한 30초!
오늘부터 긍정 루틴을 달성해 보세요👇
https://play.google.com/store/apps/details?id=com.pickplay.kwcc` 
    });
  };

  // 투표 완료 후 버튼 클릭 시 모달 표시
  const handleVotedButtonClick = () => {
    setShowTomorrowModal(true);
  };

  // 광고 시청 완료 후 실제 보상 지급 로직
  const grantReward = async () => {
    if (!user?.uid || !q || userChoice === null) {
      addDebugLog('❌ 보상 지급 불가: 사용자/질문/선택 상태 누락');
      return;
    }
    addDebugLog(`🎯 보상 지급 시작: uid=${user.uid}, questionId=${q.id}, userChoice=${userChoice}`);
    try {
      const { base, myIsMajority, next } = await rewardWithMajority(
        user.uid, q.id, userChoice
      );

      const baseReward = myIsMajority ? 5 : 10;
      const totalReward = base;
      addDebugLog(`💎 보상 계산 완료: baseReward=${baseReward}, totalReward=${totalReward}, myIsMajority=${myIsMajority}, next=${next}`);

      // 메시지에는 기본 보상만 표시, 실제 지급은 전체 금액
      setRewardMessage(baseReward, myIsMajority);

      // 보상 지급 상태 저장
      const rewardKey = `reward_${q.id}_${user.uid}`;
      await AsyncStorage.setItem(rewardKey, JSON.stringify({ base, myIsMajority, next }));
      addDebugLog('💾 보상 상태 저장 완료');

      // 사용자 데이터 업데이트
      if (userData && user?.uid) {
        const updatedUserData = {
          ...userData,
          points: userData.points + base,
          streakCount: next,
          lastAnswerDate: new Date().toISOString().slice(0, 10)
        };
        setUserData(updatedUserData);
        addDebugLog(`👤 사용자 데이터 업데이트 완료: ${JSON.stringify(updatedUserData)}`);

        // 연속 참여 알림 발송 (3일, 10일 달성 시에만)
        if (next === 3 || next === 10) {
          scheduleStreakNotification(next);
        }
      }

      setAdWatched(false);
      setRewardCompleted(true);
      addDebugLog('✅ 보상 지급 완료!');
    } catch (error) {
      addDebugLog(`❌ 보상 지급 실패: ${error}`);
    }
  };

  // 스플래시 화면 표시 중
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // 튜토리얼 화면 표시 중
  if (showTutorial) {
    return <TutorialScreen onFinish={handleTutorialFinish} />;
  }

  if(loading) return <LoadingScreen />;
  
  if(!q) return <ErrorScreen />;

  return (
    <>
      
      <SafeAreaView style={{flex:1, backgroundColor: colors.background}}>
        <ScrollView style={{flex:1}} contentContainerStyle={{flexGrow: 1}}>
                      <View style={{flex:1, paddingHorizontal: 24, paddingTop: 5, paddingBottom: 20, justifyContent:'center'}}>
        
                {userData && <UserHeader userData={userData} />}
        
        {/* 상단 왼쪽 로고 */}
        <View style={{
          position: 'absolute',
          top: 18,
          left: 24,
          zIndex: 10
        }}>
          <Image 
            source={require('../assets/images/logo_pickplay.png')}
            style={{
              width: 120,
              height: 40,
              resizeMode: 'contain'
            }}
          />
        </View>
        
        {/* 중앙 서브타이틀 */}
        <View style={{alignItems: 'center', marginTop: 100, marginBottom: 32}}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '600',
            color: colors.textSecondary,
            textAlign: 'center'
          }}>
            매일 나의 선택을 가치로 바꾸는  
            <Text style={{ 
            color: colors.primary}}> 30초 루틴</Text>{'\n'}
            취향? 직감? 
            <Text style={{ 
            color: colors.primary}}> 픽플</Text>
            에서는 모든 선택을 보상합니다.
          </Text>
        </View>

        {/* 질문 카드 */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 24,
          marginBottom: 24,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 4
        }}>
          <Text style={{ 
            fontSize: 20, 
            fontWeight: '700', 
            color: colors.primary,
            textAlign: 'center',
            lineHeight: 28,
            marginBottom: 24
          }}>
            Q. 당신의 <Text style={{ color: colors.accent }}>{q.title}</Text> 성향은?
          </Text>


          {/* 선택지 버튼들 */}
          <View style={{gap: 16}}>
            <TouchableOpacity 
              onPress={()=>userChoice !== null ? handleVotedButtonClick() : vote(0)} 
              disabled={false} // 투표 완료 후에도 클릭 가능하도록 변경
              style={{ 
                padding: 20, 
                borderRadius: 16, 
                backgroundColor: userChoice === 0 ? 'transparent' : colors.background,
                borderWidth: 2,
                borderColor: userChoice === 0 ? 'transparent' : colors.border,
                alignItems: 'center',
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
                position: 'relative',
                opacity: userChoice !== null && userChoice !== 0 ? 0.5 : 1, // 투표 완료 시 비선택된 버튼 흐리게
                marginHorizontal: 20 // 양쪽 여백 추가
              }}
              activeOpacity={0.7}
            >
              {/* 선택한 배경 - 선택한 경우에만 표시 */}
              {userChoice === 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: colors.primary,
                    borderRadius: 16
                  }}
                />
              )}
              
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '400',
                color: userChoice === 0 ? 'white' : colors.text 
              }}>
                {q.options?.[0]}
              </Text>
              
              {/* 스탬프 이미지 - 선택한 경우에만 표시 */}
              {userChoice === 0 && (
                <View style={{
                  position: 'absolute',
                  top: '50%',
                  right: '20%',
                  width: 60,
                  height: 60,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 99999,
                  transform: [{ translateY: -30 }]
                }}>
                  <Image 
                    source={require('../assets/images/img_stamp.png')}
                    style={{
                      width: 50,
                      height: 50,
                      resizeMode: 'contain'
                    }}
                  />
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={()=>userChoice !== null ? handleVotedButtonClick() : vote(1)} 
              disabled={false} // 투표 완료 후에도 클릭 가능하도록 변경
              style={{ 
                padding: 20, 
                borderRadius: 16, 
                backgroundColor: userChoice === 1 ? 'transparent' : colors.background,
                borderWidth: 2,
                borderColor: userChoice === 1 ? 'transparent' : colors.border,
                alignItems: 'center',
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
                position: 'relative',
                opacity: userChoice !== null && userChoice !== 1 ? 0.5 : 1, // 투표 완료 시 비선택된 버튼 흐리게
                marginHorizontal: 20 // 양쪽 여백 추가
              }}
              activeOpacity={0.7}
            >
              {/* 선택한 배경 - 선택한 경우에만 표시 */}
              {userChoice === 1 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: colors.primary,
                    borderRadius: 16
                  }}
                />
              )}
              
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '400',
                color: userChoice === 1 ? 'white' : colors.text 
              }}>
                {q.options?.[1]}
              </Text>
              
              {/* 스탬프 이미지 - 선택한 경우에만 표시 */}
              {userChoice === 1 && (
                <View style={{
                  position: 'absolute',
                  top: '50%',
                  right: '20%',
                  width: 60,
                  height: 60,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 99999,
                  transform: [{ translateY: -30 }]
                }}>
                  <Image 
                    source={require('../assets/images/img_stamp.png')}
                    style={{
                      width: 50,
                      height: 50,
                      resizeMode: 'contain'
                    }}
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

                  <View style={{
            backgroundColor: 'transparent', 
            paddingVertical: 20,
            paddingHorizontal: 15,
            marginBottom: 24,
            borderRadius: 16, // 보더 둥글게
            borderWidth: 2,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
                        {/* 캘린더 이미지 왼쪽, 텍스트 오른쪽 배치 */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              marginBottom: 8,
              width: '100%'
            }}>
              <Image 
                source={require('../assets/images/img_calendar.png')}
                style={{ width: 60, height: 60, borderRadius: 8, marginRight: 16 }}
                resizeMode="contain"
              />
              {/* 텍스트 컬럼 */}
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ 
                  fontWeight: '700',
                  fontSize: 18, 
                  color: colors.accent,
                  lineHeight: 24,
                  marginBottom: 8
                }}>
                  연속참여 보상 강화!
                </Text>
                <Text style={{ 
                  fontWeight: '700',
                  fontSize: 14, 
                  color: colors.text,
                  lineHeight: 20
                }}>
                  10일 연속 참여 부터 보상 2배로 UP!{'\n'}20일 연속 참여 부터 보상 3배로 UP!
                </Text>
              </View>
            </View>
            
            
          </View>

        {/* 결과 카드 - 투표 후에만 표시 (총합이 0이어도 먼저 노출하고 실시간/원격 집계로 갱신) */}
        {userChoice !== null && (
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2
        }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '700',
            color: colors.primary,
            textAlign: 'center',
            marginBottom: 16
          }}>
            PickPlay 유니버스 선택결과
          </Text>
          
                      {/* 단일 프로그레스바 */}
          <View style={{marginBottom: 16}}>
            {/* 선택지 정보 */}
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
              <Text style={{fontSize: 14, color: colors.textSecondary}}>
                {q.options?.[0]}
              </Text>
              <Text style={{fontSize: 14, color: colors.textSecondary}}>
                {q.options?.[1]}
              </Text>
            </View>
            
            {/* 프로그레스바 (flex 기반 2분할) */}
            <View style={{
              height: 16,
              backgroundColor: colors.border,
              borderRadius: 8,
              overflow: 'hidden',
              flexDirection: 'row'
            }}>
              <View style={{
                flex: Math.max(agg.p0, 0),
                backgroundColor: userChoice === 0 ? colors.secondary : colors.border
              }} />
              <View style={{
                flex: Math.max(agg.p1, 0),
                backgroundColor: userChoice === 1 ? colors.secondary : colors.border
              }} />
            </View>
            
            {/* 퍼센트 표시 */}
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
              <Text style={{fontSize: 18, fontWeight: '700', color: userChoice === 0 ? colors.secondary : colors.textSecondary}}>
                {agg.p0}%
              </Text>
              <Text style={{fontSize: 18, fontWeight: '700', color: userChoice === 1 ? colors.secondary : colors.textSecondary}}>
                {agg.p1}%
              </Text>
            </View>
          </View>
          
          <Text style={{
            fontSize: 14,
            color: colors.textLight,
            textAlign: 'center',
            marginTop: 16
          }}>
            총 {agg.total}명 참여
          </Text>
        </View>
        )}

        {/* 공유 버튼 */}
        <TouchableOpacity 
          onPress={shareInvite} 
          style={{ 
            alignSelf: 'center',
            paddingVertical: 12,
            paddingHorizontal: 24
          }}
        >
          <Text style={{ 
            fontSize: 16, 
            color: colors.primary,
            fontWeight: '600',
            textDecorationLine: 'underline' 
          }}>
            🔗 30초루틴 픽플레이 친구에게 알려주기
          </Text>
        </TouchableOpacity>

        {/* 보상 메시지 */}
        {!!msg && (
          <View style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 16,
            marginTop: 20,
            alignItems: 'center'
          }}>
            <Text style={{ 
              fontSize: 18, 
              color: 'white',
              fontWeight: '700',
              textAlign: 'center' 
            }}>
              {msg}
            </Text>
          </View>
        )}

        {/* 투표 완료 후 보상 버튼 */}
        {userChoice !== null && showRewardButton && (
          <TouchableOpacity 
            onPress={async () => {
              if (rewardCompleted) return; // 재진입 가드
              addDebugLog('🎁 보상 버튼 클릭!');
              setShowAdInfoModal(true);
            }}
            style={{
              marginTop: 20,
              alignSelf: 'center',
              backgroundColor: rewardCompleted ? '#A3A3A3' : colors.primary,
              borderRadius: 12,
              paddingVertical: 16,
              paddingHorizontal: 32,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
              marginHorizontal: 40 // 양쪽 여백 추가
            }}
            disabled={rewardCompleted}
          >
            <Text style={{
              fontSize: 18,
              color: 'white',
              fontWeight: '700',
              textAlign: 'center'
            }}>
              {rewardCompleted ? (msg || '적립 완료') : '🎁 보상 받기'}
            </Text>
          </TouchableOpacity>
        )}

        {/* 연속 참여 정보 */}
        {userData && (
          <View style={{
            alignItems: 'center',
            marginTop: 16,
            marginBottom: 20,
            paddingHorizontal: 24
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8
            }}>
              <View style={{width: 24, height: 24}}>
                <LottieView
                  source={{ uri: "https://lottie.host/951ea34e-ef87-45ee-90f2-ac796963312f/NUCSZs3eid.lottie" }}
                  loop={true}
                  autoPlay={true}
                  style={{ width: 24, height: 24 }}
                />
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.primary,
                textAlign: 'center'
              }}>
                {userData.streakCount}일 연속 참여 중!
              </Text>
            </View>
            
            <Text style={{
              fontSize: 16,
              color: colors.textSecondary,
              textAlign: 'center',
              lineHeight: 24
            }}>
              {userData.streakCount >= 11 ? 
                `🎉 ${userData.streakCount >= 21 ? '3배' : '2배'} 보상 적용 중!` :
                `내일도 참여하면 ${userData.streakCount + 1}일 연속 달성!`
              }
            </Text>
            
            {userData.streakCount < 10 && (
              <Text style={{
                fontSize: 16,
                color: colors.primary,
                textAlign: 'center',
                marginTop: 4
              }}>
                {userData.streakCount < 9 ? 
                  `${10 - userData.streakCount}일 더 참여하면 그 이후부터 모든 보상이 2배!` :
                  '내일 참여하면 2배 보상! 꼭 놓치지 마세요!'
                }
              </Text>
            )}
          </View>
        )}

        

        {/* 내일 다시 만나요 모달 */}
        {showTomorrowModal && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <View style={{
              backgroundColor: 'white',
              borderRadius: 20,
              padding: 24,
              alignItems: 'center',
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
              marginHorizontal: 40
            }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '700',
                color: colors.primary,
                textAlign: 'center',
                marginBottom: 16
              }}>
                내일 다시 만나요!
              </Text>
              
              <Text style={{
                fontSize: 16,
                color: colors.textSecondary,
                textAlign: 'center',
                lineHeight: 24,
                marginBottom: 24
              }}>
                오늘의 선택은 완료되었어요!{'\n'}
                내일 새로운 질문으로 다시 만나요! ✨
              </Text>
              
              <TouchableOpacity 
                onPress={() => setShowTomorrowModal(false)}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4
                }}
              >
                <Text style={{
                  fontSize: 16,
                  color: 'white',
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  확인
                </Text>
              </TouchableOpacity>
            </View>
          </View>
                 )}

         {/* 📺 배너 광고 */}
         <BannerAdComponent />
         
         {/* 🏢 사업자 정보 (푸터) */}
         <View style={{
           backgroundColor: colors.background,
           paddingVertical: 12,
           paddingHorizontal: 24,
           borderTopWidth: 1,
           borderTopColor: colors.border,
           alignItems: 'center',
           marginTop: 20
         }}>
           <Text style={{
             fontSize: 12,
             color: colors.textLight,
             textAlign: 'center',
             lineHeight: 16
           }}>
             © 2025 PickPlay{'\n'}
             KWCC Co., Ltd. | Emkoo{'\n'}
             907, Dongtan-daero 646-2{'\n'}
             Hwaseong-si, Gyeonggi-do, Republic of Korea{'\n'}
             e-mail: cokwcc@gmail.com{'\n'}
             tel: +82-10-4857-4876{'\n'}
             version: 1.0.0
           </Text>
         </View>

      </View>
    </ScrollView>
       </SafeAreaView>


      {/* 광고 안내 모달 */}
      {showAdInfoModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100
        }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
            marginHorizontal: 40
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: colors.primary,
              textAlign: 'center',
              marginBottom: 8
            }}>
              당신의 선택으로 포인트가 생성되었습니다.
            </Text>
            <Text style={{
              fontSize: 14,
              color: colors.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 20
            }}>
              광고 시청 후, 포인트를 적립하세요.
            </Text>
            <TouchableOpacity
              onPress={async () => {
                setShowAdInfoModal(false);
                if (adReady) {
                  addDebugLog('📣 광고 표시(안내 모달 확인)');
                  rewarded.show();
                } else {
                  addDebugLog('⏳ 광고가 아직 준비되지 않음, 재시도 시작');
                  setMsg('광고를 준비 중입니다. 잠시만 기다려주세요...');
                  
                  // 광고 재로드 시도
                  try {
                    rewarded.load();
                    
                    // 광고 로드 완료를 기다리는 함수
                    const waitForAdReady = () => {
                      return new Promise<boolean>((resolve) => {
                        const checkInterval = setInterval(() => {
                          // 광고 객체의 실제 로드 상태 확인
                          if (rewarded.isLoaded && rewarded.isLoaded()) {
                            clearInterval(checkInterval);
                            resolve(true);
                          }
                        }, 100);
                        
                        // 10초 후 타임아웃
                        setTimeout(() => {
                          clearInterval(checkInterval);
                          resolve(false);
                        }, 10000);
                      });
                    };
                    
                    // 광고 로드 완료 대기
                    const isReady = await waitForAdReady();
                    
                    if (isReady) {
                      addDebugLog('📣 광고 재로드 후 표시');
                      rewarded.show();
                    } else {
                      addDebugLog('❌ 광고 로드 타임아웃');
                      setMsg('광고 로드에 실패했습니다. 잠시 후 다시 시도해주세요.');
                      setShowAdRetryModal(true); // 재시도 모달 표시
                    }
                  } catch (error) {
                    addDebugLog(`❌ 광고 재로드 실패: ${error}`);
                    setMsg('광고 로드에 실패했습니다. 잠시 후 다시 시도해주세요.');
                    setShowAdRetryModal(true); // 재시도 모달 표시
                  }
                }
              }}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 24,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4
              }}
            >
              <Text style={{
                fontSize: 16,
                color: 'white',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                확인
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 광고 재시도 모달 */}
      {showAdRetryModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100
        }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
            marginHorizontal: 40
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: colors.primary,
              textAlign: 'center',
              marginBottom: 8
            }}>
              광고 로드에 실패했습니다
            </Text>
            <Text style={{
              fontSize: 14,
              color: colors.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 20
            }}>
              네트워크 상태를 확인하고 다시 시도해주세요.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowAdRetryModal(false)}
                style={{
                  backgroundColor: colors.border,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 24
                }}
              >
                <Text style={{
                  fontSize: 16,
                  color: colors.text,
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setShowAdRetryModal(false);
                  setShowAdInfoModal(true);
                }}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 24
                }}
              >
                <Text style={{
                  fontSize: 16,
                  color: 'white',
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  다시 시도
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      

      {/* 적립 완료 모달 */}
      {showRewardDoneModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100
        }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
            marginHorizontal: 40
          }}>
            <View style={{ width: 120, height: 120, marginBottom: 12 }}>
              <LottieView
                source={{ uri: 'https://lottie.host/c691c7ab-e2e2-4a77-a50e-cef6c130dce1/GjbXQZOTda.lottie' }}
                autoPlay
                loop={false}
                style={{ width: 120, height: 120 }}
              />
            </View>
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: colors.primary,
              textAlign: 'center',
              marginBottom: 16
            }}>
              적립이 완료되었습니다🎉
            </Text>
            <TouchableOpacity onPress={() => setShowRewardDoneModal(false)} style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 24
            }}>
              <Text style={{ fontSize: 16, color: 'white', fontWeight: '600' }}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </>
  );
}
