import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import LottieView from 'lottie-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import colors from '../../src/styles/colors';
import { watchAuth } from '../../src/services/firebase';
import { ensureUser } from '../../src/services/store';
import { PointHistory, UserData } from '../../src/types';
import { getPointHistory } from '../../src/services/pointHistory';

export default function MyPageScreen() {
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  // 화면이 포커스될 때마다 사용자 데이터 갱신 (메인페이지에서 투표 후 업데이트된 데이터 반영)
  useFocusEffect(
    React.useCallback(() => {
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
    }, [user])
  );

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
        </View>

        {/* 푸터 */}
        <View style={styles.footer}>
          <View style={styles.footerBorder} />
          <Text style={styles.footerText}>
            © 2025 PickPlay{`\n`}KWCC Co., Ltd. | Emkoo{`\n`}907, Dongtan-daero 646-2{`\n`}Hwaseong-si, Gyeonggi-do, Republic of Korea{`\n`}e-mail: cokwcc@gmail.com{`\n`}tel: +82-10-4857-4876{`\n`}version: {Constants.expoConfig?.version || '2.1.1'}
          </Text>
        </View>
      </ScrollView>
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
});
