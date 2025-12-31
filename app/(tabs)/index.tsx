import React, { useEffect, useState, useRef } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, StyleSheet, Image, Share, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadData, ensureUser, getTodayQuestionForUser, saveAnswerAndProcessLogic, saveAnswerQuick, aggregate, getTodayAnswer, rewardWithMajority } from '../../src/services/store';
import { Question, UserData } from '../../src/types';
import { watchAuth } from '../../src/services/firebase';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import TutorialScreen from '../components/TutorialScreen';
import NotificationModal from '../components/NotificationModal';
import AnimaCodeRevealModal from '../components/AnimaCodeRevealModal';
import TutorialTooltip from '../components/TutorialTooltip';
import colors from '../../src/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import { subscribeUnreadCount } from '../../src/services/notificationsList';
import { getTutorialStatus, updateTutorialProgress } from '../../src/services/tutorial';
import * as WebBrowser from 'expo-web-browser';
import LottieView from 'lottie-react-native';
import BannerAdComponent from '../components/BannerAdComponent';
import { createRewardedInterstitial, attachRewardedInterstitial, initAds } from '../../src/services/ads';
import PermissionIntroScreen from '../components/PermissionIntroScreen';
import MaintenanceScreen from '../components/MaintenanceScreen';
import UpdateModal from '../components/UpdateModal';
import { getServiceStatusConfig, getAppVersionConfig, ServiceStatusConfig, AppVersionConfig } from '../../src/services/config';
import { isVersionBelowMinimum, isVersionBelowCurrent } from '../../src/utils/version';
import Constants from 'expo-constants';

export default function HomeScreen() {
  // 화면 흐름 상태
  const [showPermissionIntro, setShowPermissionIntro] = useState(false);
  const [permissionIntroChecked, setPermissionIntroChecked] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialChecked, setTutorialChecked] = useState(false);

  // 서비스 점검 상태
  const [serviceStatus, setServiceStatus] = useState<ServiceStatusConfig | null>(null);
  const [checkingServiceStatus, setCheckingServiceStatus] = useState(true);

  // 업데이트 상태
  const [updateConfig, setUpdateConfig] = useState<AppVersionConfig | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isForceUpdate, setIsForceUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

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
  const [error, setError] = useState<string | null>(null);
  const [showTomorrowModal, setShowTomorrowModal] = useState(false);
  const [msg, setMsg] = useState('');
  const [rewardCompleted, setRewardCompleted] = useState(false);
  const [showRewardInfoModal, setShowRewardInfoModal] = useState(false);
  const [showRewardDoneModal, setShowRewardDoneModal] = useState(false);
  const [showLivePickGuideModal, setShowLivePickGuideModal] = useState(false);
  const [lastRewardMultiplier, setLastRewardMultiplier] = useState<number | null>(null);
  
  // 애니마코드 팝업 상태
  const [showAnimaCodeModal, setShowAnimaCodeModal] = useState(false);
  const [isNewCharacter, setIsNewCharacter] = useState(false);
  
  // 광고 관련 상태
  const [adLoaded, setAdLoaded] = useState(false);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const rewardedAdRef = useRef<any>(null);
  
  // 알림 관련 상태
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // 튜토리얼 관련 상태
  const [tutorialStatus, setTutorialStatus] = useState<{
    mainAnswered: boolean;
    livepickParticipated: boolean;
    livepickCreated: boolean;
    rewardGiven500: boolean;
    allCompleted: boolean;
  } | null>(null);
  
  // 튜토리얼 말풍선 표시 여부 (한 번만 표시)
  const [hasSeenMainTooltip, setHasSeenMainTooltip] = useState(false);

  const navigation = useNavigation();

  // 권한/튜토리얼 첫 로드 체크 (스플래시와 분리된 초기 진입 로직)
  useEffect(() => {
    const checkIntroAndTutorial = async () => {
      try {
        // 1) 권한 안내 노출 여부
        const hasSeenPermissionIntro = await AsyncStorage.getItem('hasSeenPermissionIntro');
        if (!hasSeenPermissionIntro) {
          // 권한 안내 화면을 아직 보지 않은 경우: 권한 인트로부터 시작
          setShowPermissionIntro(true);
          return;
        }
        setPermissionIntroChecked(true);

        // 2) 튜토리얼 노출 여부
        const hasSeenTutorial = await AsyncStorage.getItem('hasSeenTutorial');
        if (!hasSeenTutorial) {
          setShowTutorial(true);
        }
        setTutorialChecked(true);
      } catch (e) {
        console.warn('[App] 권한/튜토리얼 초기 체크 실패:', (e as any)?.message || e);
        // 문제가 있어도 메인 화면은 볼 수 있도록 체크 완료로 처리
        setPermissionIntroChecked(true);
        setTutorialChecked(true);
      }
    };

    checkIntroAndTutorial();
  }, []);

  // 권한 안내 / 튜토리얼 시에는 하단 탭 네비게이션 숨기기
  useEffect(() => {
    // 탭 네비게이션은 HomeScreen의 부모(Stack)의 부모에 위치
    const tabNavigator = navigation.getParent()?.getParent();
    if (!tabNavigator) return;

    const shouldHideTabBar =
      (showPermissionIntro && !permissionIntroChecked) ||
      showTutorial;

    if (shouldHideTabBar) {
      tabNavigator.setOptions({
        tabBarStyle: {
          display: 'none',
        },
      });
    } else {
      tabNavigator.setOptions({
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
      });
    }
  }, [navigation, showPermissionIntro, permissionIntroChecked, showTutorial]);


  // 서비스 점검 상태 체크 (앱 시작 시 최우선)
  useEffect(() => {
    const checkServiceStatus = async () => {
      try {
        const status = await getServiceStatusConfig();
        setServiceStatus(status);
        setCheckingServiceStatus(false);
      } catch (error) {
        console.error('[App] 서비스 상태 체크 실패:', error);
        // 에러 발생 시 정상 상태로 간주
        setServiceStatus({ status: 'normal', title: '', message: '' });
        setCheckingServiceStatus(false);
      }
    };

    checkServiceStatus();
  }, []);

  // 업데이트 체크
  useEffect(() => {
    const checkUpdate = async () => {
      if (checkingServiceStatus) return; // 서비스 상태 체크 완료 후 실행
      if (serviceStatus?.status === 'maintenance') return; // 점검 중이면 업데이트 체크 스킵

      try {
        const config = await getAppVersionConfig();
        if (!config) return;

        setUpdateConfig(config);
        const currentVersion = Constants.expoConfig?.version || '0.0.0';
        console.log('[Update] 현재 버전:', currentVersion);
        console.log('[Update] 최신 버전:', config.currentVersion);
        console.log('[Update] 최소 필수 버전:', config.minRequiredVersion);

        // 강제 업데이트 체크
        if (isVersionBelowMinimum(currentVersion, config.minRequiredVersion)) {
          console.log('[Update] 강제 업데이트 필요');
          setIsForceUpdate(true);
          setUpdateMessage(config.updateMessage);
          setShowUpdateModal(true);
          return;
        }

        // 선택 업데이트 체크 (한 번 무시한 버전은 다시 안 띄움)
        if (isVersionBelowCurrent(currentVersion, config.currentVersion)) {
          const dismissedKey = `dismissedUpdate_for_${config.currentVersion}`;
          const dismissed = await AsyncStorage.getItem(dismissedKey);
          
          if (!dismissed) {
            console.log('[Update] 선택 업데이트 안내');
            setIsForceUpdate(false);
            setUpdateMessage(config.updateMessage);
            setShowUpdateModal(true);
          }
        }
      } catch (error) {
        console.error('[App] 업데이트 체크 실패:', error);
      }
    };

    checkUpdate();
  }, [checkingServiceStatus, serviceStatus]);

  // 권한 안내 화면 완료
  const handlePermissionIntroComplete = async () => {
    setShowPermissionIntro(false);
    setPermissionIntroChecked(true);

    // 튜토리얼을 본 적이 있는지 확인
    const hasSeenTutorial = await AsyncStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
    setTutorialChecked(true);
  };

  // 튜토리얼 완료
  const handleTutorialFinish = async () => {
    try {
      await AsyncStorage.setItem('hasSeenTutorial', 'true');
      setShowTutorial(false);
    } catch (error) {
      console.error('[App] 튜토리얼 완료 처리 실패:', error);
      // 에러가 발생해도 튜토리얼은 닫기
      setShowTutorial(false);
    }
  };

  // 업데이트 모달 닫기 (선택 업데이트만)
  const handleUpdateDismiss = async () => {
    if (updateConfig) {
      const dismissedKey = `dismissedUpdate_for_${updateConfig.currentVersion}`;
      await AsyncStorage.setItem(dismissedKey, 'true');
    }
    setShowUpdateModal(false);
  };

  useEffect(() => {
    loadData();
    
    // AdMob 초기화
    initAds().catch((error) => {
      console.error('[App] AdMob 초기화 실패:', error);
    });
    
    // watchAuth가 실패해도 앱이 계속 실행되도록 에러 처리
    try {
      const unsub = watchAuth((user) => {
        console.log('[App] watchAuth 콜백 호출:', user ? `사용자 있음 (${user.uid})` : '사용자 없음');
        setUser(user);
      });
    return unsub;
    } catch (error) {
      console.error('[App] watchAuth 초기화 실패:', error);
      // 에러가 발생해도 앱이 계속 실행되도록 null 설정
      setUser(null);
      return () => {};
    }
  }, []);

  // 광고 초기화 및 이벤트 리스너 설정
  useEffect(() => {
    if (!user || !question || userChoice === null) return;

    console.log('🎬 보상형 광고 초기화 시작');
    
    let unsubscribe: (() => void) | null = null;
    
    const setupAd = async () => {
      try {
        const ad = await createRewardedInterstitial();
        rewardedAdRef.current = ad;

        unsubscribe = attachRewardedInterstitial(ad, {
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
          },
          onFailedToLoad: (error: any) => {
            console.error('❌ 보상형 광고 로드 실패:', error);
            setAdLoaded(false);
            setIsLoadingAd(false);
          }
        });
      } catch (error) {
        console.error('❌ 보상형 광고 초기화 실패:', error);
      }
    };
    
    setupAd();

    return () => {
      if (unsubscribe) {
        console.log('🔌 광고 리스너 해제');
        unsubscribe();
      }
    };
  }, [user, question, userChoice]);

  // 알림 개수 구독
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const unsubscribe = subscribeUnreadCount(user.uid, (count) => {
      setUnreadCount(count);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    let retryCount = 0;
    const MAX_RETRIES = 5; // 최대 5회 재시도 (약 5초)
    
    const init = async () => {
      if (!user) return;
      setLoading(true);
      try {
      const data = await ensureUser(user.uid);
      setUserData(data);
      
      // 튜토리얼 상태 로드
      try {
        const status = await getTutorialStatus(user.uid);
        setTutorialStatus(status);
        
        // 메인 튜토리얼 말풍선 표시 여부 확인
        const hasSeenMain = await AsyncStorage.getItem('hasSeenMainTutorialTooltip');
        setHasSeenMainTooltip(hasSeenMain === 'true');
      } catch (e) {
        console.warn('[Tutorial] 튜토리얼 상태 로드 실패:', e);
      }
      
      const q = getTodayQuestionForUser(data);
      setQuestion(q);

      if (q) {
          try {
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
          } catch (error: any) {
            console.warn('[App] getTodayAnswer 실패:', error?.message || error);
          setUserChoice(null);
          setRewardCompleted(false);
        }
        
          try {
        const result = await aggregate(q.question_id);
        setAgg(result);
          } catch (error: any) {
            console.warn('[App] aggregate 실패:', error?.message || error);
            // 기본값 유지
          }
      } else {
        setUserChoice(null);
        }
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes("No Firebase App '[DEFAULT]'") || 
            errorMessage.includes("Firebase") ||
            errorMessage.includes("firestore")) {
          retryCount++;
          if (retryCount < MAX_RETRIES) {
            console.warn(`[App] Firebase 초기화 대기 중, 잠시 후 재시도... (${retryCount}/${MAX_RETRIES})`);
            // Firebase 초기화 대기 후 재시도
            setTimeout(() => {
              if (user) {
                init();
              }
            }, 1000);
            return; // setLoading(false) 호출 전에 return
          } else {
            console.error('[App] Firebase 초기화 실패: 최대 재시도 횟수 초과');
            console.error('[App] Firebase가 초기화되지 않아 앱을 사용할 수 없습니다.');
            console.error('[App] GoogleService-Info.plist가 앱 번들에 포함되었는지 확인하세요.');
            setError('Firebase 연결에 실패했습니다.\n앱을 다시 시작해주세요.');
            setLoading(false);
            return;
          }
        } else {
          console.error('[App] 초기화 실패:', error);
          setError('데이터를 불러오는 중 오류가 발생했습니다.');
          // 에러가 발생해도 앱이 계속 실행되도록
        }
      }
      setLoading(false);
    };
    init();
  }, [user]);


  const handleVote = async (index: 0 | 1) => {
    if (!user || !userData || !question) return;
    
    // 테스트 유저는 UI 제한 없음
    const TEST_UIDS = ['vUlyeAhYmneB5Ii6oPNR8OFCQZg1', 'C1iSsR85GoTnvVRSY2nIn9y6ZFz1'];
    if (!TEST_UIDS.includes(user.uid) && userChoice !== null) {
      setShowTomorrowModal(true);
      return;
    }

    // 1. 즉시 UI 업데이트 (사용자 경험 우선)
    setUserChoice(index);
    setRewardCompleted(false);
    setMsg('');
  
  // 1-1. 옵티미스틱 집계 업데이트 (즉시 파란 바 반영)
  setAgg(prev => {
    const nextTotal = (prev?.total ?? 0) + 1;
    const nextC0 = (prev?.c0 ?? 0) + (index === 0 ? 1 : 0);
    const nextC1 = (prev?.c1 ?? 0) + (index === 1 ? 1 : 0);
    const p0 = nextTotal > 0 ? Math.round((nextC0 / nextTotal) * 100) : 50;
    const p1 = 100 - p0;
    return { total: nextTotal, c0: nextC0, c1: nextC1, p0, p1 };
  });
    
    // 2. 빠르게 답변 저장 (AI 태그 없이, 보상받기 버튼 즉시 표시를 위해)
    setTimeout(async () => {
      try {
        // 빠르게 답변 저장 (AI 태그는 백그라운드에서 생성)
        await saveAnswerQuick(userData, question, index);
        console.log('✅ 빠른 답변 저장 완료');
        
        // 튜토리얼 상태 즉시 업데이트 (보상받기 버튼 표시를 위해)
        try {
          await updateTutorialProgress(user.uid, 'mainAnswered');
          const updatedStatus = await getTutorialStatus(user.uid);
          if (updatedStatus) {
            setTutorialStatus(updatedStatus);
          }
        } catch (e) {
          console.warn('[Tutorial] 메인 질문 답변 튜토리얼 업데이트 실패:', e);
        }
        
        // 집계 데이터 업데이트
        const result = await aggregate(question.question_id);
        setAgg(result);
        
        // 3. 백그라운드에서 전체 로직 처리 (연속 참여일수, 캐릭터 로직 등)
        try {
          const previousTotalSelections = userData.totalSelections;
          const updatedUserData = await saveAnswerAndProcessLogic(userData, question, index);
          setUserData(updatedUserData);
          console.log('✅ 백그라운드 전체 로직 처리 완료');
          
          // 집계 데이터 다시 업데이트 (정확한 수치를 위해)
          const finalResult = await aggregate(question.question_id);
          setAgg(finalResult);
          
          // 애니마코드 팝업 표시 체크
          const newTotalSelections = updatedUserData.totalSelections;
          await checkAndShowAnimaCodeModal(previousTotalSelections, newTotalSelections, updatedUserData);
          
          // 테스트 유저는 투표 후 다음 질문으로 넘어감
          if (TEST_UIDS.includes(user.uid)) {
            const nextQuestion = getTodayQuestionForUser(updatedUserData);
            if (nextQuestion) {
              setQuestion(nextQuestion);
              setUserChoice(null);
              setRewardCompleted(false);
              setMsg('');
              // 새로운 질문의 집계 데이터 로드
              const nextAgg = await aggregate(nextQuestion.question_id);
              setAgg(nextAgg);
              console.log(`🧪 [Test] 다음 질문으로 이동: Q${nextQuestion.question_id}`);
            }
          }
        } catch (e: any) {
          console.error('❌ 백그라운드 전체 로직 처리 실패:', e);
          // 에러 발생 시에도 UI는 이미 업데이트됨 (사용자 경험 유지)
        }
      } catch (e: any) {
        console.error('❌ 빠른 답변 저장 실패:', e);
        // 에러 발생 시에도 UI는 이미 업데이트됨 (사용자 경험 유지)
      }
    }, 0);
  };

  // 애니마코드 팝업 표시 체크 함수 (중복 표시 방지 복원)
  const checkAndShowAnimaCodeModal = async (previousTotal: number, newTotal: number, userData: UserData) => {
    const storageKey = `animaCodeShown_${user?.uid}_${newTotal}`;
    console.log(`[AnimaCode] 🎯 팝업 조건 체크:`, {
      previousTotal,
      newTotal,
      characterId: userData.characterId,
      adjective1: userData.adjective1,
      adjective2: userData.adjective2,
      storageKey,
    });

    try {
      const alreadyShown = await AsyncStorage.getItem(storageKey);
      if (alreadyShown === 'true') {
        console.log(`[AnimaCode] ⏭️ 이미 표시한 팝업: ${newTotal}번`);
        return;
      }
    } catch (e) {
      console.warn('[AnimaCode] AsyncStorage 조회 실패(무시 가능):', (e as any)?.message || e);
    }

    // 캐릭터 배정 (30번째)
    if (newTotal === 30 && userData.characterId) {
      console.log('[AnimaCode] 🎉 캐릭터 배정 팝업 표시');
      setIsNewCharacter(true);
      setShowAnimaCodeModal(true);
      try { await AsyncStorage.setItem(storageKey, 'true'); } catch {}
      return;
    }
    
    // 형용사 갱신 (60, 90, 120...)
    if (newTotal >= 60 && newTotal % 30 === 0 && userData.characterId) {
      console.log(`[AnimaCode] 🔄 형용사 갱신 팝업 표시: ${newTotal}번`);
      setIsNewCharacter(false);
      setShowAnimaCodeModal(true);
      try { await AsyncStorage.setItem(storageKey, 'true'); } catch {}
      return;
    }
    
    console.log(`[AnimaCode] ❌ 팝업 조건 미충족: newTotal=${newTotal}, characterId=${userData.characterId}`);
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
    
    console.log('🎬 [광고 표시 시도] 상태 확인:');
    console.log('   - adLoaded:', adLoaded);
    console.log('   - rewardedAdRef.current 존재:', !!rewardedAdRef.current);
    console.log('   - isLoaded() 결과:', rewardedAdRef.current?.isLoaded?.());
    
    if (adLoaded && rewardedAdRef.current) {
      const isAdActuallyLoaded = rewardedAdRef.current.isLoaded?.();
      console.log('🎬 광고 표시 시작');
      console.log('   - adLoaded 상태:', adLoaded);
      console.log('   - isLoaded() 결과:', isAdActuallyLoaded);
      
      if (!isAdActuallyLoaded) {
        console.warn('⚠️ 광고가 로드되지 않았지만 표시 시도');
      }
      
      try {
        rewardedAdRef.current.show();
        console.log('✅ show() 메서드 호출 완료');
      } catch (error: any) {
        console.error('❌ 광고 표시 실패:');
        console.error('   에러:', error);
        console.error('   에러 메시지:', error?.message);
        console.error('   에러 코드:', error?.code);
        Alert.alert('광고 오류', `광고 표시 실패: ${error?.message || '알 수 없는 오류'}`);
      }
    } else {
      console.log('⏳ 광고가 아직 로드되지 않음');
      console.log('   - adLoaded:', adLoaded);
      console.log('   - rewardedAdRef.current:', !!rewardedAdRef.current);
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

  // 1. 서비스 점검 화면 (최우선, 점검 중이면 여기서 멈춤)
  if (checkingServiceStatus) {
    return <LoadingScreen />;
  }

  if (serviceStatus?.status === 'maintenance') {
    return (
      <MaintenanceScreen
        title={serviceStatus.title}
        message={serviceStatus.message}
        linkText={serviceStatus.linkText}
        linkUrl={serviceStatus.linkUrl}
      />
    );
  }

  // 3. 권한 안내 화면 (첫 방문자만)
  if (showPermissionIntro && !permissionIntroChecked) {
    return <PermissionIntroScreen onFinish={handlePermissionIntroComplete} />;
  }

  // 4. 튜토리얼 화면 (첫 방문자만)
  if (showTutorial) {
    return <TutorialScreen onFinish={handleTutorialFinish} />;
  }

  // 5. 튜토리얼 체크 완료 전까지 로딩
  if (!tutorialChecked || !permissionIntroChecked) {
    return <LoadingScreen />;
  }

  // 4. 에러 화면 (Firebase 초기화 실패 등)
  if (error) {
    return <ErrorScreen message={error} onRetry={() => {
      setError(null);
      setLoading(true);
      // 앱 재시작을 위해 user 상태를 초기화하고 다시 시도
      if (user) {
        // useEffect가 다시 실행되도록 user를 재설정
        setUser(null);
        setTimeout(() => setUser(user), 100);
      }
    }} />;
  }

  // 5. 메인 화면 로딩
  if (loading) return <LoadingScreen />;
  if (!question) return <ErrorScreen title="오늘의 질문을 불러오지 못했습니다." />;

  // 5. 메인 화면
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 5, paddingBottom: 20, justifyContent: 'center' }}>

          {/* 우측 상단 알림 아이콘 */}
          {user && (
            <TouchableOpacity
              style={{ position: 'absolute', top: 18, right: 24, zIndex: 10 }}
              onPress={() => setShowNotificationModal(true)}
              activeOpacity={0.7}
            >
              <View style={{ position: 'relative' }}>
                <Ionicons name="notifications-outline" size={28} color={colors.text} />
                {unreadCount > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    backgroundColor: colors.primary,
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 6,
                  }}>
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* 좌측 상단 로고 */}
          <View style={{ position: 'absolute', top: 18, left: 24, zIndex: 10 }}>
            <Image source={require('../../assets/images/logo_pickplay.png')} style={{ width: 120, height: 40, resizeMode: 'contain' }} />
        </View>

          {/* 중앙 서브타이틀 */}
          <View style={{ alignItems: 'center', marginTop: 100, marginBottom: 32 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' }}>
              매일 나의 선택을 가치로 바꾸는 <Text style={{ color: colors.primary }}> 30초 루틴</Text>{'\n'}취향? 직감? <Text style={{ color: colors.primary }}> 픽플</Text>에서는 모든 선택을 보상합니다.
          </Text>
        </View>

          {/* 질문 카드 */}
          {question ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, marginBottom: 24, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4, position: 'relative' }}>
            {/* 튜토리얼 말풍선 (메인 질문 안내) - 튜토리얼 미완료 시 한 번만 표시 */}
            {tutorialStatus && !tutorialStatus.mainAnswered && userChoice === null && !hasSeenMainTooltip && (
              <TutorialTooltip
                title="튜토리얼 하기!"
                message="보상 : 500P!"
                position="bottom"
                style={{ top: -50, left: 100, right: 20 }}
                color="#FF5722"
                blink={true}
                onDismiss={async () => {
                  await AsyncStorage.setItem('hasSeenMainTutorialTooltip', 'true');
                  setHasSeenMainTooltip(true);
                }}
              />
            )}
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
                    <Image source={require('../../assets/images/img_stamp.png')} style={{ width: 50, height: 50, resizeMode: 'contain' }} />
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
                    <Image source={require('../../assets/images/img_stamp.png')} style={{ width: 50, height: 50, resizeMode: 'contain' }} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
          ) : null}

          {/* 정보 카드 */}
          <View style={{ backgroundColor: 'transparent', paddingVertical: 20, paddingHorizontal: 15, marginBottom: 24, borderRadius: 16, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 8, width: '100%' }}>
              <Image source={require('../../assets/images/img_calendar.png')} style={{ width: 60, height: 60, borderRadius: 8, marginRight: 16 }} resizeMode="contain" />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', fontSize: 18, color: colors.accent, lineHeight: 24, marginBottom: 8 }}>1연속참여 보상 강화!</Text>
                <Text style={{ fontWeight: '700', fontSize: 12, color: colors.text, lineHeight: 20 }}> 11일 연속 참여부터 보상 2배로 UP!{`\n`}31일 연속 참여 부터 보상 3배로 UP!</Text>
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
            {tutorialStatus && tutorialStatus.mainAnswered && userChoice !== null && !rewardCompleted && (
              <View style={{ position: 'relative', alignSelf: 'center' }}>
                {/* 튜토리얼 말풍선 (보상 받기 안내) */}
                <TutorialTooltip
                  message="보상을 받아보세요"
                  position="bottom"
                  style={{ top: -40, left: 50, right: 60 }}
                  width={160}
                  color="#FF5722"
                  blink={true}
                />
              <TouchableOpacity onPress={handleGrantReward} style={{
                  marginTop: 8,
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
              </View>
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

          </View>
        </ScrollView>

      {/* 애니마코드 팝업 */}
      {showAnimaCodeModal && userData && (
        <AnimaCodeRevealModal
          visible={showAnimaCodeModal}
          onClose={() => setShowAnimaCodeModal(false)}
          userData={userData}
          isNewCharacter={isNewCharacter}
        />
      )}

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
            <TouchableOpacity onPress={() => {
              setShowRewardDoneModal(false);
              setShowLivePickGuideModal(true);
            }} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 16, color: 'white', fontWeight: '600', textAlign: 'center' }}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 라이브픽 안내 팝업 */}
      {showLivePickGuideModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 28, alignItems: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginHorizontal: 40 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.primary, textAlign: 'center', marginBottom: 12 }}>애니마코드 생성을 위한{'\n'}선택을 완료했습니다!</Text>
            <Text style={{ fontSize: 16, color: colors.text, textAlign: 'center', lineHeight: 24, marginBottom: 8 }}>매일 참여해서 나만의{'\n'}애니마코드를 깨워보세요!</Text>
            {/* 애니마코드 알 애니메이션 */}
            <View style={{ width: 100, height: 100 }}>
              <LottieView
                source={{ uri: 'https://lottie.host/df96f2a7-284f-4197-ba3c-5b8388c46299/ykDKnFMp3l.lottie' }}
                autoPlay
                loop={true}
                style={{ width: 100, height: 100 }}
              />
            </View>
            <View style={{ width: '100%', height: 1, backgroundColor: colors.border, marginBottom: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.accent, textAlign: 'center', lineHeight: 24, marginBottom: 8 }}>지금 핫한 라이브픽에서{'\n'}더 많은 보상을 받아보세요 🎁</Text>
            
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity 
                onPress={() => setShowLivePickGuideModal(false)} 
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
                  setShowLivePickGuideModal(false);
                  // 라이브픽 페이지로 이동
                  if (typeof window !== 'undefined') {
                    require('expo-router').router.push('/(tabs)/livepick');
                  }
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

      {/* 업데이트 모달 */}
      <UpdateModal
        visible={showUpdateModal}
        isForce={isForceUpdate}
        message={updateMessage}
        onDismiss={isForceUpdate ? undefined : handleUpdateDismiss}
      />

      {/* 알림 모달 */}
      <NotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />

        </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  content: { padding: 16 },
});
