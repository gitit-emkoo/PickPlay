import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, Clipboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import LottieView from 'lottie-react-native';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import colors from '../../src/styles/colors';
import { watchAuth, ensureAnonymousAuth } from '../../src/services/firebase';
import auth from '@react-native-firebase/auth';
import { ensureUser } from '../../src/services/store';
import { PointHistory, UserData } from '../../src/types';
import { getPointHistory } from '../../src/services/pointHistory';
import { prepareDeviceTransfer, executeDeviceTransfer, watchDeviceTransferCompletion, cleanupAfterDeviceTransfer } from '../../src/services/deviceTransfer';
import { useToast } from '../../app/components/Toast';

export default function MyPageScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  // 기기 이전 관련 상태
  const [showPrepareModal, setShowPrepareModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTransferCompletedModal, setShowTransferCompletedModal] = useState(false);
  const [transferPassword, setTransferPassword] = useState('');
  const [transferUID, setTransferUID] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [preparedPassword, setPreparedPassword] = useState<string | null>(null);
  const transferWatchUnsubscribeRef = useRef<(() => void) | null>(null); // ref로 관리하여 불필요한 cleanup 방지
  const [isWaitingForTransfer, setIsWaitingForTransfer] = useState(false); // 연동 대기 중 상태

  // 사용자 인증 및 데이터 로드
  useEffect(() => {
    const unsubscribe = watchAuth(async (user) => {
      setUser(user);
      if (user) {
        try {
          const data = await ensureUser(user.uid);
          setUserData(data);
        } catch (error) {
          console.error('사용자 데이터 로드 실패:', error);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // 컴포넌트 언마운트 시 연동 감시 리스너 해제
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시에만 리스너 해제
      if (transferWatchUnsubscribeRef.current) {
        transferWatchUnsubscribeRef.current();
        console.log('[MyPage] 컴포넌트 언마운트: 연동 감시 리스너 해제');
      }
    };
  }, []); // 빈 배열: 컴포넌트 언마운트 시에만 실행

  // 화면이 포커스될 때마다 사용자 데이터 갱신 (메인페이지에서 투표 후 업데이트된 데이터 반영)
  // useFocusEffect 대신 useEffect로 처리 (expo-router 호환성 문제로 인해)
  useEffect(() => {
    if (user) {
      ensureUser(user.uid)
        .then((data) => {
          setUserData(data);
          console.log('✅ [MyPage] 사용자 데이터 갱신 완료:', {
            streakCount: data.streakCount,
            points: data.points,
            totalSelections: data.totalSelections,
          });
        })
        .catch((error) => {
          console.error('❌ [MyPage] 사용자 데이터 갱신 실패:', error);
        });
    }
  }, [user]);

  const openLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, { enableBarCollapsing: true });
    } catch (error) {
      console.error('링크 열기 실패:', error);
    }
  };

  const loadHistory = async (uid: string) => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const list = await getPointHistory(uid, 30);
      setHistory(list);
    } catch (error: any) {
      console.error('포인트 내역 로드 실패:', error);
      setHistoryError('포인트 내역을 불러오지 못했어요.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleToggleHistory = async () => {
    if (!user) return;
    const next = !historyOpen;
    setHistoryOpen(next);
    // 항상 최신 데이터를 가져오도록 수정 (history.length === 0 조건 제거)
    if (next && !historyLoading) {
      await loadHistory(user.uid);
    }
  };

  const formatDate = (value: any) => {
    try {
      const date =
        value?.toDate?.() instanceof Date
          ? value.toDate()
          : value instanceof Date
          ? value
          : new Date(value);
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      const hours = `${date.getHours()}`.padStart(2, '0');
      const minutes = `${date.getMinutes()}`.padStart(2, '0');
      return `${month}/${day} ${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  // 연동 준비 핸들러
  const handlePrepareTransfer = async () => {
    if (!user) return;
    
    try {
      setTransferLoading(true);
      
      // 이전 리스너가 있으면 먼저 해제 (중복 방지)
      if (transferWatchUnsubscribeRef.current) {
        transferWatchUnsubscribeRef.current();
        transferWatchUnsubscribeRef.current = null;
      }
      
      const password = await prepareDeviceTransfer(user.uid);
      setPreparedPassword(password);
      setShowPrepareModal(true);
      
      // 연동 완료 감시 시작
      setIsWaitingForTransfer(true); // 연동 대기 중 상태로 변경
      const unsubscribe = watchDeviceTransferCompletion(user.uid, () => {
        console.log('[MyPage] 연동 완료 감지! 팝업 표시');
        setIsWaitingForTransfer(false); // 연동 대기 중 상태 해제
        setShowPrepareModal(false); // 연동 준비 모달 닫기
        // 연동 완료 모달 표시 전에 토스트 메시지 표시
        showToast('연동이 완료되었습니다. 기존 정보는 삭제되었고 새 유저를 생성했습니다.', 'success');
        // 약간의 딜레이 후 모달 표시 (토스트가 먼저 보이도록)
        setTimeout(() => {
          setShowTransferCompletedModal(true);
        }, 500);
      });
      
      transferWatchUnsubscribeRef.current = unsubscribe;
    } catch (error: any) {
      console.error('연동 준비 실패:', error);
      showToast(error.message || '연동 준비에 실패했습니다.', 'error');
    } finally {
      setTransferLoading(false);
    }
  };

  // 연동 준비 모달 닫기 핸들러
  const handlePrepareModalClose = () => {
    setShowPrepareModal(false);
    // 리스너는 유지 (연동 완료까지 감시 필요)
    // 연동 대기 중 상태는 유지 (백그라운드에서 계속 감시)
  };

  // 연동 준비 취소 핸들러 (연동 감시 중단)
  const handleCancelTransfer = () => {
    if (transferWatchUnsubscribeRef.current) {
      transferWatchUnsubscribeRef.current();
      transferWatchUnsubscribeRef.current = null;
    }
    setIsWaitingForTransfer(false);
    setShowPrepareModal(false);
    setPreparedPassword(null);
  };

  // 연동 완료 모달 닫기 및 새 유저 생성
  const handleTransferCompletedModalClose = async () => {
    setShowTransferCompletedModal(false);
    setIsWaitingForTransfer(false); // 연동 대기 중 상태 해제
    
    // 감시 리스너 해제
    if (transferWatchUnsubscribeRef.current) {
      transferWatchUnsubscribeRef.current();
      transferWatchUnsubscribeRef.current = null;
    }
    
    // 새 유저 생성 (기존 사용자 로그아웃 후 watchAuth가 자동으로 새 유저 생성)
    try {
      console.log('[MyPage] 새 유저 생성 시작...');
      
      // 현재 사용자 UID 저장 (AsyncStorage 정리용)
      const authInstance = auth();
      const currentUser = authInstance.currentUser;
      const oldUID = currentUser?.uid;
      
      if (currentUser) {
        console.log('[MyPage] 기존 사용자 로그아웃:', oldUID);
        
        // 연동 완료 후 AsyncStorage 정리 (복구 로직이 실행되지 않도록)
        if (oldUID) {
          await cleanupAfterDeviceTransfer(oldUID);
        }
        
        // 로그아웃 (watchAuth가 자동으로 새 익명 유저를 생성함)
        await authInstance.signOut();
        console.log('[MyPage] 로그아웃 완료 - watchAuth가 자동으로 새 유저 생성');
      }
      
      // watchAuth의 onAuthStateChanged가 null을 감지하고 자동으로 새 유저를 생성함
      // 새 유저가 생성되면 watchAuth가 자동으로 콜백을 호출하여 setUser가 업데이트됨
      // watchAuth가 새 유저를 생성할 시간을 충분히 확보 (최대 3초 대기)
      let waitCount = 0;
      const maxWait = 6; // 0.5초 * 6 = 3초
      const checkNewUser = setInterval(() => {
        waitCount++;
        const newUser = authInstance.currentUser;
        if (newUser && newUser.uid !== oldUID) {
          // 새 유저가 생성되었으면 자동으로 앱 리로드 시도
          clearInterval(checkNewUser);
          console.log('[MyPage] 새 유저 생성 확인:', newUser.uid);
          
          // 자동 리로드 시도 (약간의 지연 후)
          setTimeout(async () => {
            try {
              console.log('[MyPage] 자동 앱 리로드 시작...');
              await Updates.reloadAsync();
            } catch (error) {
              console.error('[MyPage] 자동 앱 리로드 실패, 팝업 표시:', error);
              // 자동 리로드 실패 시 팝업 표시
              Alert.alert(
                '연동 완료',
                '기기 연동이 완료되었습니다.\n\n앱을 새로고침하세요.',
                [
                  {
                    text: '확인',
                    onPress: async () => {
                      try {
                        console.log('[MyPage] 수동 앱 리로드 시작...');
                        await Updates.reloadAsync();
                      } catch (reloadError) {
                        console.error('[MyPage] 수동 앱 리로드 실패:', reloadError);
                        router.replace('/(tabs)/');
                      }
                    },
                  },
                ]
              );
            }
          }, 500); // 0.5초 지연 후 리로드
        } else if (waitCount >= maxWait) {
          // 최대 대기 시간 초과 시 자동 리로드 시도
          clearInterval(checkNewUser);
          console.log('[MyPage] 새 유저 생성 대기 시간 초과, 자동 리로드 시도');
          
          // 자동 리로드 시도 (약간의 지연 후)
          setTimeout(async () => {
            try {
              console.log('[MyPage] 자동 앱 리로드 시작...');
              await Updates.reloadAsync();
            } catch (error) {
              console.error('[MyPage] 자동 앱 리로드 실패, 팝업 표시:', error);
              // 자동 리로드 실패 시 팝업 표시
              Alert.alert(
                '연동 완료',
                '기기 연동이 완료되었습니다.\n\n앱을 새로고침하세요.',
                [
                  {
                    text: '확인',
                    onPress: async () => {
                      try {
                        console.log('[MyPage] 수동 앱 리로드 시작...');
                        await Updates.reloadAsync();
                      } catch (reloadError) {
                        console.error('[MyPage] 수동 앱 리로드 실패:', reloadError);
                        router.replace('/(tabs)/');
                      }
                    },
                  },
                ]
              );
            }
          }, 500); // 0.5초 지연 후 리로드
        }
      }, 500); // 0.5초마다 확인
    } catch (error) {
      console.error('[MyPage] 새 유저 생성 실패:', error);
      Alert.alert('오류', '새 유저 생성 중 문제가 발생했습니다.');
    }
  };

  // 연동 실행 핸들러
  const handleExecuteTransfer = async () => {
    if (!user || !transferUID.trim() || !transferPassword.trim()) {
      showToast('UID와 비밀번호를 모두 입력해주세요.', 'warning');
      return;
    }

    Alert.alert(
      '기기 연동',
      '기기 연동을 진행하시겠습니까?\n\n기존 기기의 데이터는 삭제되고, 현재 기기로 모든 정보가 이전됩니다.\n\n⚠️ 네트워크 연결이 필요합니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '연동하기',
          style: 'destructive',
          onPress: async () => {
            try {
              setTransferLoading(true);
              const result = await executeDeviceTransfer(transferUID.trim(), transferPassword.trim(), user.uid);
              
              if (result.success) {
                showToast('기기 연동이 완료되었습니다.', 'success');
                // 사용자 데이터 새로고침 (B기기: 연동 완료 후 최신 데이터 로드)
                if (user) {
                  // 연동 완료 후 복구 로직 스킵 플래그 설정
                  await AsyncStorage.setItem('skipRecoveryAfterTransfer', 'true');
                  console.log('[MyPage] 연동 완료 - 복구 로직 스킵 플래그 설정');
                  
                  // 온라인 전용: 항상 Firestore에서 직접 로드
                  // 연동 직후이므로 약간의 지연을 두고 데이터 로드 (Cloud Functions 처리 시간 고려)
                  setTimeout(async () => {
                    try {
                      // 최신 데이터 로드 (서버에서 직접) - 복구 로직 스킵
                      const data = await ensureUser(user.uid);
                      
                      // 마이페이지 state 업데이트
                      setUserData(data);
                      
                      // 모달 닫기 및 입력 필드 초기화
                      setShowTransferModal(false);
                      setTransferUID('');
                      setTransferPassword('');
                      
                      // 자동 리로드 시도 (약간의 지연 후)
                      setTimeout(async () => {
                        try {
                          console.log('[MyPage] 자동 앱 리로드 시작...');
                          await Updates.reloadAsync();
                        } catch (error) {
                          console.error('[MyPage] 자동 앱 리로드 실패, 팝업 표시:', error);
                          // 자동 리로드 실패 시 팝업 표시
                          Alert.alert(
                            '연동 완료',
                            '기기 연동이 완료되었습니다.\n\n앱을 새로고침하세요.',
                            [
                              {
                                text: '확인',
                                onPress: async () => {
                                  try {
                                    console.log('[MyPage] 수동 앱 리로드 시작...');
                                    await Updates.reloadAsync();
                                  } catch (reloadError) {
                                    console.error('[MyPage] 수동 앱 리로드 실패:', reloadError);
                                    router.replace('/(tabs)/');
                                  }
                                },
                              },
                            ]
                          );
                        }
                      }, 500); // 0.5초 지연 후 리로드
                    } catch (error) {
                      console.error('사용자 데이터 새로고침 실패:', error);
                      // 에러가 발생해도 자동 리로드 시도
                      setTimeout(async () => {
                        try {
                          console.log('[MyPage] 자동 앱 리로드 시작...');
                          await Updates.reloadAsync();
                        } catch (error) {
                          console.error('[MyPage] 자동 앱 리로드 실패, 팝업 표시:', error);
                          // 자동 리로드 실패 시 팝업 표시
                          Alert.alert(
                            '연동 완료',
                            '기기 연동이 완료되었습니다.\n\n앱을 새로고침하세요.',
                            [
                              {
                                text: '확인',
                                onPress: async () => {
                                  try {
                                    console.log('[MyPage] 수동 앱 리로드 시작...');
                                    await Updates.reloadAsync();
                                  } catch (reloadError) {
                                    console.error('[MyPage] 수동 앱 리로드 실패:', reloadError);
                                    router.replace('/(tabs)/');
                                  }
                                },
                              },
                            ]
                          );
                        }
                      }, 500); // 0.5초 지연 후 리로드
                    }
                  }, 2000); // 2초 대기 (Cloud Functions 처리 시간 확보)
                }
              } else {
                showToast(result.error || '기기 연동에 실패했습니다.', 'error');
              }
            } catch (error: any) {
              console.error('연동 실행 실패:', error);
              showToast(error.message || '기기 연동 중 오류가 발생했습니다.', 'error');
            } finally {
              setTransferLoading(false);
            }
          },
        },
      ]
    );
  };


  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>마이페이지</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>마이페이지</Text>
      </View>
      
      {/* 연동 대기 중 배너 (모달이 닫혀있을 때 표시) */}
      {isWaitingForTransfer && !showPrepareModal && (
        <TouchableOpacity
          style={styles.transferWaitingBanner}
          onPress={() => setShowPrepareModal(true)}
          activeOpacity={0.8}
        >
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.transferWaitingBannerText}>
            연동 대기 중... 다른 기기에서 연동을 완료하면 알려드립니다.
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      )}
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* 프로필 섹션 */}
        {userData && (
          <View style={styles.profileSection}>
            <Text style={styles.profileName}>{userData.nickname}</Text>
            
            {/* 포인트 및 연속 참여 */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <LottieView
                    source={{ uri: "https://lottie.host/c691c7ab-e2e2-4a77-a50e-cef6c130dce1/GjbXQZOTda.lottie" }}
                    loop={true}
                    autoPlay={true}
                    style={styles.lottie}
                  />
                </View>
                <Text style={styles.statValue}>{userData.points}P</Text>
                <Text style={styles.statLabel}>포인트</Text>
              </View>
              
              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <LottieView
                    source={{ uri: "https://lottie.host/951ea34e-ef87-45ee-90f2-ac796963312f/NUCSZs3eid.lottie" }}
                    loop={true}
                    autoPlay={true}
                    style={styles.lottie}
                  />
                </View>
                <Text style={styles.statValue}>{userData.streakCount}일</Text>
                <Text style={styles.statLabel}>연속 참여</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle" size={32} color={colors.primary} />
                <Text style={styles.statValue}>{userData.totalSelections || 0}</Text>
                <Text style={styles.statLabel}>총 선택</Text>
              </View>
            </View>

            {/* 포인트 안내 */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                2,000P부터 자유롭게 사용할 수 있고, 연속 달성과 다양한 이벤트를 통해 더 많은 포인트를 획득할 수 있어요!
              </Text>
            </View>
          </View>
        )}

        {/* 메뉴 섹션 */}
        <View style={styles.menuSection}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleToggleHistory}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="wallet-outline" size={24} color={colors.primary} />
              <Text style={styles.menuText}>포인트 적립/소멸내역</Text>
            </View>
            <Ionicons
              name={historyOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textLight}
            />
          </TouchableOpacity>

          {historyOpen && (
            <View style={styles.historyContainer}>
              {historyLoading && (
                <View style={styles.historyLoadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.historyLoadingText}>불러오는 중...</Text>
                </View>
              )}
              {historyError && !historyLoading && (
                <Text style={styles.historyError}>{historyError}</Text>
              )}
              {!historyLoading && !historyError && history.length === 0 && (
                <Text style={styles.historyEmpty}>포인트 내역이 아직 없어요.</Text>
              )}
              {!historyLoading && history.length > 0 && (
                <View style={styles.historyList}>
                  {history.slice(0, 3).map((item) => {
                    // reason을 한국어로 변환
                    const reasonMap: Record<string, string> = {
                      'basic_reward': '라이브픽 기본 보상',
                      'ladder_reward': '라이브픽 사다리 게임',
                      'creator_reward': '라이브픽 질문자 보상',
                      'top_reward': '라이브픽 TOP 질문 보상',
                      'majority_reward': '메인 질문 보상',
                      'ad_bonus': '광고 보너스',
                      'livepick_question_creation': '라이브픽 질문 생성',
                      'manual': '수동 지급',
                      'etc': '기타',
                    };
                    const reasonText = reasonMap[item.reason] || item.reason;
                    const displayText = item.description || reasonText;
                    
                    return (
                    <View key={item.id} style={styles.historyRow}>
                      <View>
                          <Text style={styles.historyTitle}>{displayText}</Text>
                        <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                      </View>
                      <Text style={[styles.historyAmount, item.amount >= 0 ? styles.plus : styles.minus]}>
                        {item.amount >= 0 ? `+${item.amount}P` : `${item.amount}P`}
                      </Text>
                    </View>
                    );
                  })}
                </View>
              )}
              {!historyLoading && !historyError && history.length > 3 && (
                <TouchableOpacity
                  style={styles.historyMoreButton}
                  activeOpacity={0.7}
                  onPress={() => router.push('/point-history')}
                >
                  <Text style={styles.historyMoreText}>더보기</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => openLink('https://pickplay.waveon.me/pages/1757817752093')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="help-circle" size={24} color={colors.primary} />
              <Text style={styles.menuText}>고객센터</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => openLink('https://pickplay.waveon.me/pages/1757994427672')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
              <Text style={styles.menuText}>개인정보처리방침</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => openLink('https://pickplay.waveon.me/pages/1757994808102')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
              <Text style={styles.menuText}>이용약관</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          {/* 기기 연동 메뉴 */}
          <View style={styles.transferSection}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handlePrepareTransfer}
              activeOpacity={0.7}
              disabled={transferLoading || !user}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="phone-portrait-outline" size={24} color={colors.primary} />
                <Text style={styles.menuText}>연동준비</Text>
              </View>
              {transferLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => setShowTransferModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="sync-outline" size={24} color={colors.primary} />
                <Text style={styles.menuText}>연동하기</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 푸터 */}
        <View style={styles.footer}>
          <View style={styles.footerBorder} />
          <Text style={styles.footerText}>
            © 2025 PickPlay{`\n`}KWCC Co., Ltd. | Emkoo{`\n`}907, Dongtan-daero 646-2{`\n`}Hwaseong-si, Gyeonggi-do, Republic of Korea{`\n`}e-mail: cokwcc@gmail.com{`\n`}tel: +82-10-4857-4876{`\n`}version: {Constants.expoConfig?.version || '2.1.1'}
          </Text>
        </View>
      </ScrollView>

      {/* 연동 준비 모달 */}
      <Modal
        visible={showPrepareModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handlePrepareModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>연동 준비 완료</Text>
              <TouchableOpacity
                onPress={handlePrepareModalClose}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.transferInfoContainer}>
              <Text style={styles.transferInfoLabel}>사용자 ID</Text>
              <View style={styles.transferInfoBox}>
                <Text style={styles.transferInfoValue} selectable>{user?.uid || ''}</Text>
                <TouchableOpacity
                  onPress={async () => {
                    if (user?.uid) {
                      await Clipboard.setString(user.uid);
                      showToast('사용자 ID가 클립보드에 복사되었습니다.', 'success');
                    }
                  }}
                  style={styles.copyButton}
                >
                  <Ionicons name="copy-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.transferInfoLabel, { marginTop: 20 }]}>연동 비밀번호</Text>
              <View style={styles.transferInfoBox}>
                <Text style={styles.transferPasswordValue} selectable>{preparedPassword || ''}</Text>
                <TouchableOpacity
                  onPress={async () => {
                    if (preparedPassword) {
                      await Clipboard.setString(preparedPassword);
                      Alert.alert('복사 완료', '비밀번호가 클립보드에 복사되었습니다.');
                    }
                  }}
                  style={styles.copyButton}
                >
                  <Ionicons name="copy-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.transferWarningBox}>
                <Ionicons name="warning-outline" size={20} color="#FF9500" />
                <Text style={styles.transferWarningText}>
                  이 정보를 다른 기기에서 입력하면 현재 기기의 데이터가 삭제되고 새 기기로 이전됩니다.{'\n'}
                  비밀번호는 24시간 동안 유효합니다.{'\n\n'}
                  <Text style={{ fontWeight: '600' }}>⚠️ 네트워크 연결이 필요합니다.</Text>{'\n'}
                  연동을 진행하려면 와이파이 또는 모바일 데이터에 연결되어 있어야 합니다.
                </Text>
              </View>

              {/* 연동 대기 중 표시 */}
              {isWaitingForTransfer && (
                <View style={[styles.transferWarningBox, { backgroundColor: colors.primary + '15', borderColor: colors.primary, marginTop: 16 }]}>
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.transferWarningText, { color: colors.primary, flex: 1 }]}>
                    연동 대기 중... 다른 기기에서 연동을 완료하면 알려드립니다.
                  </Text>
                </View>
              )}
            </View>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {isWaitingForTransfer && (
                <TouchableOpacity
                  style={[styles.modalButton, { flex: 1, backgroundColor: colors.textLight }]}
                  onPress={handleCancelTransfer}
                >
                  <Text style={styles.modalButtonText}>취소</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalButton, isWaitingForTransfer && { flex: 1 }]}
                onPress={handlePrepareModalClose}
              >
                <Text style={styles.modalButtonText}>{isWaitingForTransfer ? '백그라운드 대기' : '확인'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 연동하기 모달 */}
      <Modal
        visible={showTransferModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowTransferModal(false);
          setTransferUID('');
          setTransferPassword('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>기기 연동</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTransferModal(false);
                  setTransferUID('');
                  setTransferPassword('');
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.transferInputContainer}>
              <Text style={styles.transferInputLabel}>사용자 ID</Text>
              <TextInput
                style={styles.transferInput}
                value={transferUID}
                onChangeText={setTransferUID}
                placeholder="연동할 기기의 사용자 ID를 입력하세요"
                placeholderTextColor={colors.textLight}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              <Text style={[styles.transferInputLabel, { marginTop: 16 }]}>연동 비밀번호</Text>
              <TextInput
                style={styles.transferInput}
                value={transferPassword}
                onChangeText={setTransferPassword}
                placeholder="기존 기기에서 확인한 연동 비밀번호를 입력"
                placeholderTextColor={colors.textLight}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={10}
              />
              
              <View style={styles.transferWarningBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.transferWarningText}>
                  연동하면 기존 기기의 데이터가 삭제되고 현재 기기로 모든 정보가 이전됩니다.{'\n\n'}
                  <Text style={{ fontWeight: '600' }}>⚠️ 네트워크 연결이 필요합니다.</Text>{'\n'}
                  연동을 진행하려면 와이파이 또는 모바일 데이터에 연결되어 있어야 합니다.
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.modalButton, transferLoading && styles.modalButtonDisabled]}
              onPress={handleExecuteTransfer}
              disabled={transferLoading}
            >
              {transferLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>연동하기</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 연동 완료 모달 (데이터를 보낸 기기에서 표시) */}
      <Modal
        visible={showTransferCompletedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleTransferCompletedModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>연동 완료</Text>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.transferCompletedBox}>
                <Ionicons name="checkmark-circle" size={48} color={colors.primary} style={{ marginBottom: 16 }} />
                <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 12 }]}>
                  연동이 완료되었습니다.
                </Text>
                <Text style={styles.transferCompletedText}>
                  기존 정보는 삭제되었고{'\n'}
                  새 유저를 생성합니다.
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleTransferCompletedModalClose}
            >
              <Text style={styles.modalButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    marginBottom: 32,
  },
  profileName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: 40,
    height: 40,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E6F2FF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
  menuSection: {
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  historyContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyLoadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  historyError: {
    color: colors.error || '#d00',
    fontSize: 14,
  },
  historyEmpty: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  historyList: {
    gap: 10,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  historyDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyDate: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  plus: {
    color: colors.primary,
  },
  minus: {
    color: '#d9534f',
  },
  historyMoreButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  historyMoreText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  footerBorder: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 16,
  },
  transferSection: {
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  uidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uidText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.text,
    marginRight: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginRight: 8,
    letterSpacing: 2,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF4E6',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'flex-start',
    gap: 8,
  },
  modalInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  transferInfoContainer: {
    marginBottom: 24,
  },
  transferInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  transferInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transferInfoValue: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    fontFamily: 'monospace',
  },
  transferPasswordValue: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  copyButton: {
    padding: 8,
    marginLeft: 8,
  },
  transferWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF4E6',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  transferWarningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
  transferCompletedBox: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  transferCompletedText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    textAlign: 'center',
  },
  transferInputContainer: {
    marginBottom: 24,
  },
  transferInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  transferInput: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCloseButton: {
    padding: 4,
  },
  transferWaitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '30',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  transferWaitingBannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: 4,
  },
});
