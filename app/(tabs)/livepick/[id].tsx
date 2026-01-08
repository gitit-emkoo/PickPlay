import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, InteractionManager, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../src/styles/colors';
import { LivePickQuestion } from '../../../src/types/livepick';
import ParticipateModal from '../../components/livepick/ParticipateModal';
import LadderGame from '../../components/livepick/LadderGame';
import RewardModal from '../../components/livepick/RewardModal';
import { watchAuth } from '../../../src/services/firebase';
import { createRewardedInterstitial, attachRewardedInterstitial } from '../../../src/services/ads';
import { 
  getLivePickQuestion, 
  subscribeLivePickQuestion,
  participateInLivePick,
  receiveBasicReward,
  receiveLadderReward,
  getParticipation,
  getTodayParticipationCount,
  reportLivePickQuestion,
  hasReportedLivePickQuestion,
} from '../../../src/services/livepick';
import { updateTutorialProgress } from '../../../src/services/tutorial';

// 임시 더미 데이터 (나중에 백엔드 연동)
const getDummyQuestion = (id: string): LivePickQuestion | null => {
  const questions: LivePickQuestion[] = [
    {
      id: '1',
      createdBy: 'user1',
      title: '오늘 저녁 뭐 먹을까?',
      option1: '파스타',
      option2: '치킨',
      category: '일상',
      tags: ['일상'],
      participantCount: 15,
      option1Count: 9,
      option2Count: 6,
      pointDeducted: 10,
      rewardGiven: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'active',
    },
    {
      id: '2',
      createdBy: 'user2',
      title: '주말 계획은?',
      option1: '집에서 쉬기',
      option2: '외출하기',
      category: '일상',
      tags: ['일상'],
      participantCount: 32,
      option1Count: 19,
      option2Count: 13,
      pointDeducted: 10,
      rewardGiven: false,
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      status: 'active',
    },
  ];
  return questions.find(q => q.id === id) || null;
};

export default function QuestionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [question, setQuestion] = useState<LivePickQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<1 | 2 | null>(null);
  const [hasParticipated, setHasParticipated] = useState(false);
  const [todayParticipationCount, setTodayParticipationCount] = useState(0);
  
  // 모달 상태
  const [showParticipateModal, setShowParticipateModal] = useState(false);
  const [showLadderGame, setShowLadderGame] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showCongratulationModal, setShowCongratulationModal] = useState(false);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [isLadderReward, setIsLadderReward] = useState(false);
  
  // 광고 관련 상태
  const [adLoaded, setAdLoaded] = useState(false);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const rewardedAdRef = useRef<any>(null);
  const earnedRewardRef = useRef(false); // 광고 보상 획득 여부
  
  // 신고 관련 상태
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<'spam' | 'inappropriate' | 'violence' | 'harassment' | 'other' | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [hasReported, setHasReported] = useState(false);

  // 참여 기록 확인 함수
  const checkParticipation = async (uid: string, questionId?: string) => {
    const targetQuestionId = questionId || id;
    if (!targetQuestionId) {
      setHasParticipated(false);
      setSelectedOption(null);
      return;
    }
    try {
      console.log(`🔍 [LivePick] 참여 기록 확인: questionId=${targetQuestionId}, uid=${uid}`);
      const participation = await getParticipation(uid, targetQuestionId);
      if (participation) {
        console.log(`✅ [LivePick] 참여 기록 발견: questionId=${targetQuestionId}`);
        setHasParticipated(true);
        setSelectedOption(participation.selectedOption);
      } else {
        console.log(`ℹ️ [LivePick] 참여 기록 없음: questionId=${targetQuestionId}`);
        setHasParticipated(false);
        setSelectedOption(null);
      }
    } catch (error) {
      console.error('❌ 참여 기록 확인 실패:', error);
      setHasParticipated(false);
      setSelectedOption(null);
    }
  };

  // 오늘 참여 횟수 확인
  const checkTodayParticipationCount = async (uid: string) => {
    try {
      const count = await getTodayParticipationCount(uid);
      setTodayParticipationCount(count);
    } catch (error) {
      console.error('오늘 참여 횟수 확인 실패:', error);
    }
  };

  // 사용자 인증 확인
  useEffect(() => {
    const unsubscribe = watchAuth((user) => {
      setUser(user);
      if (user && id) {
        checkParticipation(user.uid, id);
        checkTodayParticipationCount(user.uid);
        // 신고 여부 확인
        hasReportedLivePickQuestion(user.uid, id)
          .then(setHasReported)
          .catch(() => setHasReported(false));
      }
    });
    return unsubscribe;
  }, [id]);

  // 질문 데이터 로드 및 실시간 구독
  useEffect(() => {
    if (!id) return;

    // 질문 ID가 변경되면 상태 초기화 (다른 질문으로 이동할 때)
    setLoading(true);
    setHasParticipated(false);
    setSelectedOption(null);
    setShowParticipateModal(false);
    setShowLadderGame(false);
    setShowRewardModal(false);
    
    // 초기 데이터 로드
    getLivePickQuestion(id).then((data) => {
      setQuestion(data);
      setLoading(false);
    });

    // 실시간 구독
    const unsubscribe = subscribeLivePickQuestion(id, (updatedQuestion) => {
      setQuestion(updatedQuestion);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [id]);

  // 질문 ID 또는 사용자 변경 시 참여 기록 확인
  useEffect(() => {
    if (!user || !id) {
      setHasParticipated(false);
      setSelectedOption(null);
      setHasReported(false);
      return;
    }
    checkParticipation(user.uid, id);
    hasReportedLivePickQuestion(user.uid, id)
      .then(setHasReported)
      .catch(() => setHasReported(false));
  }, [id, user]);

  // 안드로이드 하드웨어 뒤로가기 버튼 처리
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // 목록 화면으로 이동
        router.push('/(tabs)/livepick');
        return true; // 기본 동작 방지
      });

      return () => backHandler.remove();
    }
  }, [router]);

  // 광고 초기화
  useEffect(() => {
    if (!user || !question) {
      // 조건이 맞지 않으면 광고 상태 초기화
      setAdLoaded(false);
      rewardedAdRef.current = null;
      earnedRewardRef.current = false;
      return;
    }

    console.log('🎬 [LivePick] 보상형 광고 초기화 시작');
    
    let unsubscribe: (() => void) | null = null;
    
    const setupAd = async () => {
      try {
        // 이전 광고 객체가 있으면 정리
        if (rewardedAdRef.current && unsubscribe) {
          try {
            unsubscribe();
          } catch (e) {
            console.warn('⚠️ [LivePick] 이전 광고 리스너 정리 실패:', e);
          }
          rewardedAdRef.current = null;
        }
        
        // 메인 화면과 동일한 함수 사용
        const ad = await createRewardedInterstitial();
        rewardedAdRef.current = ad;
        earnedRewardRef.current = false; // 광고 새로 로드 시 플래그 초기화

        // 타임아웃 설정 (10초 내 로드되지 않으면 실패 처리)
        let loadTimeoutRef: NodeJS.Timeout | null = null;
        const loadTimeout = setTimeout(() => {
          console.warn('⏰ [LivePick] 광고 로드 타임아웃 (10초)');
          loadTimeoutRef = null;
          setAdLoaded(false);
          setIsLoadingAd(false);
          // 타임아웃 시 상태만 업데이트 (팝업 표시 안 함 - 사용자가 버튼을 눌렀을 때만 표시)
        }, 10000);
        loadTimeoutRef = loadTimeout;

        unsubscribe = attachRewardedInterstitial(ad, {
          onLoaded: () => {
            if (loadTimeoutRef) {
              clearTimeout(loadTimeoutRef);
              loadTimeoutRef = null;
            }
            setAdLoaded(true);
            setIsLoadingAd(false);
            earnedRewardRef.current = false;
          },
          onEarned: async () => {
            earnedRewardRef.current = true;
            
            // 참여 기록 생성 (보상은 사다리 게임 후)
            if (user && question && selectedOption !== null && !hasParticipated) {
              try {
                await participateInLivePick(user.uid, question.id, selectedOption);
                setHasParticipated(true);
                const newCount = await getTodayParticipationCount(user.uid);
                setTodayParticipationCount(newCount);
              } catch (error) {
                console.error('❌ [LivePick] 참여 기록 생성 실패:', error);
              }
            }
          },
          onClosed: () => {
            const shouldShowLadder = earnedRewardRef.current;
            setAdLoaded(false);
            setIsLoadingAd(false);
            
            // 보상을 획득했다면 사다리 게임 모달 표시
            if (shouldShowLadder) {
              // 광고 view controller 완전 해제 대기 (iOS)
              setTimeout(() => {
                setShowLadderGame(true);
                earnedRewardRef.current = false;
              }, 800);
            }
          },
          onFailedToShow: (error: any) => {
            // 개발 모드에서만 에러 로그 표시
            if (__DEV__) {
              console.error('❌ [LivePick] 광고 표시 실패:', error?.message);
            }
            setAdLoaded(false);
            setIsLoadingAd(false);
            // 표시 실패 시 상태만 업데이트 (팝업 표시 안 함 - handleWatchAd에서 이미 처리)
          },
          onFailedToLoad: (error: any) => {
            if (loadTimeoutRef) {
              clearTimeout(loadTimeoutRef);
              loadTimeoutRef = null;
            }
            const errorMessage = error?.message || String(error || '알 수 없는 오류');
            
            console.error(`❌ [LivePick] 광고 로드 실패:`, errorMessage);
            if (error && typeof error === 'object') {
              try {
                console.error(`❌ [LivePick] 에러 상세:`, JSON.stringify(error, null, 2));
              } catch (e) {
                console.error(`❌ [LivePick] 에러 상세 (직렬화 실패):`, error);
              }
            }
            
            setAdLoaded(false);
            setIsLoadingAd(false);
            
            // 로드 실패 시 상태만 업데이트 (팝업 표시 안 함 - 사용자가 버튼을 눌렀을 때만 표시)
          }
        });
      } catch (error) {
        console.error('❌ [LivePick] 보상형 광고 초기화 실패:', error);
        setAdLoaded(false);
        setIsLoadingAd(false);
        // 초기화 실패 시 자동 재시도 안 함 (유저가 다시 버튼을 눌러야 함)
      }
    };
    
    setupAd();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, question]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>라이브픽</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>질문을 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  if (!question) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>라이브픽</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>질문을 찾을 수 없습니다.</Text>
        </View>
      </View>
    );
  }

  const option1Percent = question.participantCount > 0
    ? Math.round((question.option1Count / question.participantCount) * 100)
    : 0;
  const option2Percent = question.participantCount > 0
    ? 100 - option1Percent
    : 0;
  const hasVotes = question.participantCount > 0;

  const handleOptionSelect = async (option: 1 | 2) => {
    // 사용자 확인
    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    // 질문 생성자는 자신의 질문에 참여할 수 없음
    if (!question) {
      return;
    }
    
    if (question.createdBy === user.uid) {
      Alert.alert('알림', '자신이 만든 질문에는 참여할 수 없습니다.');
      return;
    }

    // 이미 참여한 질문인지 확인
    if (hasParticipated) {
      Alert.alert('알림', '이미 참여한 질문입니다.');
      return;
    }

    // 일일 참여 제한 체크 (4회/일)
    try {
      const latestCount = await getTodayParticipationCount(user.uid);
      
      if (latestCount >= 4) {
        Alert.alert(
          '참여 제한',
          '오늘은 이미 4개의 질문에 참여하셨습니다.\n내일 다시 시도해주세요!'
        );
        return;
      }
      
      // 최신 참여 횟수 업데이트
      setTodayParticipationCount(latestCount);
    } catch (error) {
      console.error('오늘 참여 횟수 확인 실패:', error);
    }

    setSelectedOption(option);
    setShowParticipateModal(true);
  };

  // 10P 받기 선택 (명령문: 즉시 보상 10P)
  const handleReceiveBasicReward = async () => {
    if (!user || !question || selectedOption === null) return;

    setShowParticipateModal(false);
    
    try {
      // 1. 참여 기록 생성
      await participateInLivePick(user.uid, question.id, selectedOption);
      
      // 2. 기본 보상(10P) 지급
      await receiveBasicReward(user.uid, question.id);

      // 3. 참여 상태 업데이트
      setHasParticipated(true);
      
      // 4. 오늘 참여 횟수 다시 확인
      const newCount = await getTodayParticipationCount(user.uid);
      setTodayParticipationCount(newCount);
      
      // 5. 보상 모달 표시
      setRewardPoints(10);
      setIsLadderReward(false);
      setShowRewardModal(true);

      // 튜토리얼 상태 업데이트 (라이브픽 참여)
      try {
        const result = await updateTutorialProgress(user.uid, 'livepickParticipated');
        // 참여 완료 시 축하 팝업 표시 (단, livepickCreated는 아직 안 됨)
        // 실제로 업데이트가 수행되었을 때만 축하 팝업 표시 (첫 번째 참여만)
        if (result?.wasUpdated && 
            result.userData?.tutorial?.mainAnswered && 
            result.userData?.tutorial?.livepickParticipated &&
            !result.userData?.tutorial?.livepickCreated) {
          // 보상 모달이 닫힌 후 축하 팝업 표시
          setTimeout(() => {
            setShowCongratulationModal(true);
          }, 500);
        }
      } catch (e) {
        console.warn('[Tutorial] 라이브픽 참여 튜토리얼 업데이트 실패:', e);
      }

      console.log('✅ 기본 보상 지급 완료 (10P)');
    } catch (error: any) {
      console.error('❌ 보상 지급 실패:', error);
      const errorMessage = error?.message || '보상 지급에 실패했습니다.';
      
      if (errorMessage.includes('이미 참여')) {
        setHasParticipated(true);
        Alert.alert('알림', '이미 참여한 질문입니다.');
      } else {
        Alert.alert('오류', errorMessage);
      }
    }
  };

  // 광고 시청 후 게임하기 선택
  const handleWatchAd = async () => {
    console.log('🟢 [LivePick] handleWatchAd 함수 호출됨');
    console.log('📊 [LivePick] rewardedAdRef.current:', rewardedAdRef.current ? '존재함' : 'null');
    console.log('📊 [LivePick] adLoaded:', adLoaded);
    
    try {
    // 모달을 먼저 닫기
    setShowParticipateModal(false);
      console.log('✅ [LivePick] 모달 닫기 완료');
    
      // iOS 모달이 완전히 dismiss되기를 대기 (view controller dismiss 완료)
      console.log('⏳ [LivePick] 모달 dismiss 대기 시작 (1000ms)...');
    await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 1000);
      });
      console.log('✅ [LivePick] 모달 dismiss 대기 완료');
    
    // 광고가 로드되지 않았거나 광고 객체가 없으면 안내만 표시
    if (!adLoaded || !rewardedAdRef.current) {
      console.log('⏳ [LivePick] 광고가 로드되지 않음');
      Alert.alert('광고 준비 중', '광고를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    } catch (error: any) {
      console.error('❌ [LivePick] handleWatchAd 에러:', error);
      Alert.alert('오류', '광고를 표시하는 중 오류가 발생했습니다.');
      return;
    }

    console.log(`🎬 [LivePick] 광고 표시 시도 - adLoaded 상태: ${adLoaded}`);
    
    // 광고가 아직 로드되지 않은 경우 안내만 표시 (자동 대기 안 함)
    if (!adLoaded) {
      console.log('⏳ [LivePick] 광고가 아직 로드되지 않음');
      Alert.alert('광고 준비 중', '광고를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    
    // 광고가 이미 로드된 경우 표시
    if (!rewardedAdRef.current) {
      Alert.alert('알림', '아직 광고가 로드중입니다. 잠시후 다시 시도하세요.');
      return;
    }
    
    try {
      console.log('🎬 [LivePick] 광고 표시 시작');
      rewardedAdRef.current.show();
      console.log('✅ [LivePick] 광고 표시 호출 완료');
    } catch (error: any) {
      const errorMessage = error?.message || '';
      const isViewControllerError = errorMessage.includes('already presenting another view controller');
      
      if (isViewControllerError) {
        // 모달이 아직 닫히지 않음 - 500ms 후 재시도
        console.warn('⚠️ [LivePick] 모달 닫힘 대기 중, 재시도...');
        setTimeout(() => {
          try {
            rewardedAdRef.current?.show();
          } catch (retryError: any) {
            // 개발 모드에서만 에러 로그 표시
            if (__DEV__) {
              console.error('❌ [LivePick] 광고 표시 재시도 실패:', retryError?.message);
            }
            Alert.alert('광고 준비 중', '광고를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
            setAdLoaded(false);
          }
        }, 500);
      } else {
        // 개발 모드에서만 에러 로그 표시
        if (__DEV__) {
          console.error('❌ [LivePick] 광고 표시 실패:', errorMessage);
        }
        // 광고가 준비되지 않았을 때 사용자 친화적인 메시지 표시
        Alert.alert('광고 준비 중', '광고를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        setAdLoaded(false);
      }
    }
  };

  // 사다리 게임 결과 처리
  const handleLadderResult = async (points: number) => {
    if (!user || !question || selectedOption === null) return;

    console.log('🎯 [LivePick] 사다리 게임 결과:', points, 'P');
    
    try {
      // 참여 기록이 없으면 생성 (이미 onEarned에서 생성되었을 수 있음)
      if (!hasParticipated) {
        await participateInLivePick(user.uid, question.id, selectedOption);
        setHasParticipated(true);
        const newCount = await getTodayParticipationCount(user.uid);
        setTodayParticipationCount(newCount);
      }
      
      // 사다리 게임 보상 지급
      await receiveLadderReward(user.uid, question.id, points);

      // 튜토리얼 상태 업데이트 (라이브픽 참여)
      try {
        await updateTutorialProgress(user.uid, 'livepickParticipated');
      } catch (e) {
        console.warn('[Tutorial] 라이브픽 참여 튜토리얼 업데이트 실패:', e);
      }
      console.log('✅ [LivePick] 사다리 게임 보상 지급 완료:', points, 'P');
      
      // 사다리 게임 모달 닫기 (1초 후)
      setTimeout(() => {
        setShowLadderGame(false);
        // 보상 모달 표시 (모달 닫힌 후 300ms)
        setTimeout(() => {
          setRewardPoints(points);
          setIsLadderReward(true);
          setShowRewardModal(true);
        }, 300);
      }, 1000);
    } catch (error: any) {
      console.error('❌ [LivePick] 보상 지급 실패:', error);
      const errorMessage = error?.message || '보상 지급에 실패했습니다.';
      
      setTimeout(() => {
        setShowLadderGame(false);
        if (errorMessage.includes('이미')) {
          Alert.alert('알림', '이미 보상을 받으셨습니다.');
        } else {
          Alert.alert('오류', errorMessage);
        }
      }, 2000);
    }
  };

  // 보상 모달 닫기
  const handleRewardModalClose = () => {
    setShowRewardModal(false);
    // 기본 보상 (10P)을 받았고, 사다리 보상이 아닌 경우에만 축하 팝업 표시
    // (사다리 게임은 광고 시청 후이므로 제외)
    if (!isLadderReward && rewardPoints === 10) {
      // 잠시 후 축하 팝업 표시 체크는 이미 기본 보상 함수에서 처리됨
    }
  };

  // 신고 버튼 클릭
  const handleReportPress = () => {
    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    if (question && question.createdBy === user.uid) {
      Alert.alert('알림', '자신이 만든 질문은 신고할 수 없습니다.');
      return;
    }

    if (hasReported) {
      Alert.alert('알림', '이미 신고한 질문입니다.');
      return;
    }

    setShowReportModal(true);
  };

  // 신고 제출
  const handleReportSubmit = async () => {
    if (!user || !question || !selectedReportReason) {
      Alert.alert('오류', '신고 사유를 선택해주세요.');
      return;
    }

    setIsReporting(true);

    try {
      await reportLivePickQuestion(
        user.uid,
        question.id,
        selectedReportReason,
        reportDescription.trim() || undefined
      );

      Alert.alert('신고 완료', '신고가 접수되었습니다. 검토 후 조치하겠습니다.', [
        {
          text: '확인',
          onPress: () => {
            setShowReportModal(false);
            setSelectedReportReason(null);
            setReportDescription('');
          },
        },
      ]);
    } catch (error: any) {
      console.error('❌ 신고 실패:', error);
      const errorMessage = error?.message || '신고 처리에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setIsReporting(false);
    }
  };

  const selectedOptionText = selectedOption === 1 ? question.option1 : selectedOption === 2 ? question.option2 : '';

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // 목록 화면으로 이동 (목록 화면이 다시 마운트되면 자동으로 갱신됨)
            router.push('/(tabs)/livepick');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>라이브픽</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
      >
        {/* 질문 제목 */}
        <Text style={styles.questionTitle}>{question.title}</Text>

        {/* 참여자 수 */}
        <View style={styles.participantInfo}>
          <Ionicons name="people" size={20} color={colors.primary} />
          <Text style={styles.participantText}>{question.participantCount}명 참여 중</Text>
        </View>

        {/* 일일 참여 제한 표시 */}
        {user && (
          <View style={[
            styles.dailyLimitInfo,
            todayParticipationCount >= 4 && styles.dailyLimitInfoWarning
          ]}>
            <View style={styles.dailyLimitContent}>
              <Ionicons 
                name={todayParticipationCount >= 4 ? "alert-circle" : "time"} 
                size={18} 
                color={todayParticipationCount >= 4 ? colors.warning : colors.textSecondary} 
              />
              <Text style={[
                styles.dailyLimitText,
                todayParticipationCount >= 4 && styles.dailyLimitTextWarning
              ]}>
                오늘 남은 참여: {Math.max(0, 4 - todayParticipationCount)}/4회
              </Text>
            </View>
            {todayParticipationCount >= 4 && (
              <Text style={styles.dailyLimitWarning}>
                내일 다시 참여하실 수 있습니다
              </Text>
            )}
          </View>
        )}

        {/* 선택지 */}
        <View style={styles.optionsContainer}>
          {/* 선택지 1 */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedOption === 1 && styles.optionCardSelected,
              hasParticipated && styles.optionCardDisabled,
            ]}
            onPress={() => handleOptionSelect(1)}
            disabled={hasParticipated}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.optionText,
              selectedOption === 1 && styles.optionTextSelected,
            ]}>
              {question.option1}
            </Text>
            {hasParticipated && (
              <Text style={[styles.optionPercent, styles.optionPercentLeft]}>{option1Percent}%</Text>
            )}
          </TouchableOpacity>

          {/* 선택지 2 */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedOption === 2 && styles.optionCardSelected,
              (hasParticipated || (user && question && question.createdBy === user.uid)) && styles.optionCardDisabled,
            ]}
            onPress={() => handleOptionSelect(2)}
            disabled={!!(hasParticipated || (user && question && question.createdBy === user.uid))}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.optionText,
              selectedOption === 2 && styles.optionTextSelected,
            ]}>
              {question.option2}
            </Text>
            {hasParticipated && (
              <Text style={[styles.optionPercent, styles.optionPercentRight]}>{option2Percent}%</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 결과 바 (참여 후에만 표시) */}
        {hasParticipated && (
          <View style={[styles.resultBar, !hasVotes && styles.resultBarEmpty]}>
            {hasVotes && (
              <View style={[styles.resultFill, { width: `${option1Percent}%` }]} />
            )}
          </View>
        )}

        {/* 참여 안내 */}
        {!hasParticipated && !selectedOption && (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              {user && question && question.createdBy === user.uid
                ? '자신이 만든 질문에는 참여할 수 없습니다.'
                : '선택지를 클릭하여 참여하세요.\n참여 후 10P를 받거나 광고 시청 후 추가 보상을 받을 수 있습니다.'}
            </Text>
          </View>
        )}

        {/* 참여 완료 안내 */}
        {hasParticipated && (
          <View style={styles.infoBox}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.infoText}>
              참여가 완료되었습니다!
            </Text>
          </View>
        )}

        {/* 신고 버튼 */}
        {user && question && question.createdBy !== user.uid && (
          <TouchableOpacity
            style={[
              styles.reportButton,
              hasReported && styles.reportButtonDisabled,
            ]}
            onPress={handleReportPress}
            activeOpacity={0.7}
          >
            <Ionicons name="flag-outline" size={20} color={colors.error} />
            <Text style={styles.reportButtonText}>
              {hasReported ? '이미 신고한 질문입니다' : '신고하기'}
            </Text>
          </TouchableOpacity>
        )}

        {/* 다른 질문 보기 버튼 (스크롤 하단) */}
        <TouchableOpacity
          style={styles.goToListButton}
          onPress={async () => {
            // 목록 화면으로 이동하면서 강제로 새로고침
            // 약간의 딜레이를 주어 Firestore 인덱싱 시간 확보
            await new Promise(resolve => setTimeout(resolve, 500));
            // router.push를 사용하여 화면 스택에 추가 (replace는 완전히 교체하므로 포커스 이벤트가 발생하지 않을 수 있음)
            router.push('/(tabs)/livepick');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="list" size={20} color="white" />
          <Text style={styles.goToListButtonText}>다른 질문 보기</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 참여 모달 */}
      <ParticipateModal
        visible={showParticipateModal}
        selectedOption={selectedOptionText}
        onReceive={handleReceiveBasicReward}
        onWatchAd={handleWatchAd}
        onClose={() => {
          setShowParticipateModal(false);
          setSelectedOption(null);
        }}
        todayParticipationCount={todayParticipationCount}
      />

      {/* 사다리 게임 모달 */}
      <Modal
        visible={showLadderGame}
        transparent
        animationType="slide"
        onRequestClose={() => {
          console.log('🔙 [LivePick] 사다리 게임 모달 닫기 요청');
          setShowLadderGame(false);
        }}
      >
        <View style={styles.gameModalOverlay}>
          <View style={styles.gameModalContainer}>
            <LadderGame
              visible={showLadderGame}
              onResult={handleLadderResult}
            />
          </View>
        </View>
      </Modal>

      {/* 보상 모달 */}
      <RewardModal
        visible={showRewardModal}
        points={rewardPoints}
        isLadderReward={isLadderReward}
        onClose={() => {
          setShowRewardModal(false);
          // 목록 화면으로 돌아가서 투표 결과가 반영되도록
          router.push('/(tabs)/livepick');
        }}
      />

      {/* 축하 팝업 (라이브픽 참여 완료) */}
      {showCongratulationModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 28, alignItems: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginHorizontal: 40 }}>
            <View style={{ width: 60, height: 60, backgroundColor: '#E3F2FD', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="trophy" size={32} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.primary, textAlign: 'center', marginBottom: 12 }}>첫 번째 참여와 보상을{'\n'}축하합니다! 🎉</Text>
            <Text style={{ fontSize: 16, color: colors.text, textAlign: 'center', lineHeight: 24, marginBottom: 24 }}>이제 질문을 생성해 볼까요?</Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity 
                onPress={() => setShowCongratulationModal(false)} 
                style={{ 
                  flex: 1,
                  backgroundColor: colors.surface, 
                  borderRadius: 12, 
                  paddingVertical: 14, 
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center'
                }}
              >
                <Text style={{ fontSize: 16, color: colors.text, fontWeight: '600' }}>아니요</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  setShowCongratulationModal(false);
                  // 라이브픽 메인 페이지로 이동 (질문 생성 버튼이 있는 곳)
                  router.push('/(tabs)/livepick');
                }} 
                style={{ 
                  flex: 1,
                  backgroundColor: colors.primary, 
                  borderRadius: 12, 
                  paddingVertical: 14,
                  alignItems: 'center'
                }}
              >
                <Text style={{ fontSize: 16, color: 'white', fontWeight: '600' }}>예</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 신고 모달 */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isReporting) {
            Keyboard.dismiss();
            setShowReportModal(false);
            setSelectedReportReason(null);
            setReportDescription('');
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            style={styles.modalKeyboardView}
          >
            <View style={styles.reportModalContent}>
              <View style={styles.reportModalHeader}>
                <Text style={styles.reportModalTitle}>신고하기</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!isReporting) {
                      Keyboard.dismiss();
                      setShowReportModal(false);
                      setSelectedReportReason(null);
                      setReportDescription('');
                    }
                  }}
                  disabled={isReporting}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.reportModalScrollView}
                contentContainerStyle={styles.reportModalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                    <Text style={styles.reportModalSubtitle}>신고 사유를 선택해주세요</Text>

                    {/* 신고 사유 선택 */}
                    <View style={styles.reportReasonContainer}>
                      {[
                        { value: 'spam', label: '스팸 또는 광고' },
                        { value: 'inappropriate', label: '부적절한 내용' },
                        { value: 'violence', label: '폭력적 또는 혐오적 내용' },
                        { value: 'harassment', label: '괴롭힘 또는 혐오 발언' },
                        { value: 'other', label: '기타' },
                      ].map((reason) => (
                        <TouchableOpacity
                          key={reason.value}
                          style={[
                            styles.reportReasonOption,
                            selectedReportReason === reason.value && styles.reportReasonOptionSelected,
                          ]}
                          onPress={() => {
                            setSelectedReportReason(reason.value as any);
                            Keyboard.dismiss();
                          }}
                          disabled={isReporting}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.reportReasonText,
                              selectedReportReason === reason.value && styles.reportReasonTextSelected,
                            ]}
                          >
                            {reason.label}
                          </Text>
                          {selectedReportReason === reason.value && (
                            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* 추가 설명 입력 */}
                    <View style={styles.reportDescriptionContainer}>
                      <Text style={styles.reportDescriptionLabel}>추가 설명 (선택사항)</Text>
                      <TextInput
                        style={styles.reportDescriptionInput}
                        placeholder="상세한 신고 사유를 입력해주세요"
                        placeholderTextColor={colors.textLight}
                        value={reportDescription}
                        onChangeText={setReportDescription}
                        multiline
                        numberOfLines={4}
                        maxLength={200}
                        editable={!isReporting}
                        blurOnSubmit={true}
                        returnKeyType="done"
                      />
                      <Text style={styles.reportDescriptionCount}>
                        {reportDescription.length}/200
                      </Text>
                    </View>

                    {/* 신고 제출 버튼 */}
                    <TouchableOpacity
                      style={[
                        styles.reportSubmitButton,
                        (!selectedReportReason || isReporting) && styles.reportSubmitButtonDisabled,
                      ]}
                      onPress={() => {
                        Keyboard.dismiss();
                        handleReportSubmit();
                      }}
                      disabled={!selectedReportReason || isReporting}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.reportSubmitButtonText}>
                        {isReporting ? '신고 중...' : '신고 제출'}
                      </Text>
                    </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 30,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  participantText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  dailyLimitInfo: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dailyLimitInfoWarning: {
    backgroundColor: '#FFF4E6',
    borderColor: colors.warning,
  },
  dailyLimitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dailyLimitText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  dailyLimitTextWarning: {
    color: colors.warning,
    fontWeight: '700',
  },
  dailyLimitWarning: {
    fontSize: 12,
    color: colors.warning,
    marginTop: 6,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 80,
    justifyContent: 'center',
  },
  optionCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionCardDisabled: {
    opacity: 0.7,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  optionTextSelected: {
    color: 'white',
  },
  optionPercent: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
  },
  resultBar: {
    height: 12,
    backgroundColor: colors.accent,
    borderRadius: 6,
    marginBottom: 24,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  resultBarEmpty: {
    backgroundColor: colors.border,
  },
  resultFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  optionPercentLeft: {
    color: colors.primary,
  },
  optionPercentRight: {
    color: colors.accent,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  gameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameModalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 12,
    width: '90%',
    maxWidth: 500,
    maxHeight: '85%', // 한 화면에 맞게 높이 제한
    alignItems: 'center',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },
  reportButtonDisabled: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    opacity: 0.8,
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalKeyboardView: {
    width: '100%',
    maxWidth: 500,
  },
  reportModalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '85%',
  },
  reportModalScrollView: {
    maxHeight: 450,
  },
  reportModalScrollContent: {
    paddingBottom: 8,
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  reportModalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  reportReasonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  reportReasonOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportReasonOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reportReasonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  reportReasonTextSelected: {
    color: 'white',
    fontWeight: '700',
  },
  reportDescriptionContainer: {
    marginBottom: 24,
  },
  reportDescriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  reportDescriptionInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  reportDescriptionCount: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'right',
    marginTop: 4,
  },
  goToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 20,
  },
  goToListButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  reportSubmitButton: {
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportSubmitButtonDisabled: {
    opacity: 0.5,
  },
  reportSubmitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
});
