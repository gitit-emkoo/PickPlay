import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../src/styles/colors';
import { LivePickQuestion } from '../../src/types/livepick';
import { getLivePickQuestions, getTodayParticipationCount } from '../../src/services/livepick';
import { watchAuth } from '../../src/services/firebase';
import { getTutorialStatus } from '../../src/services/tutorial';
import TutorialTooltip from '../components/TutorialTooltip';

const CATEGORIES: Array<'일상' | '연애' | '가치관' | '엔터테인먼트' | '상상'> = ['일상', '연애', '가치관', '엔터테인먼트', '상상'];

export default function LivePickScreen() {
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [questions, setQuestions] = useState<LivePickQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;
  const [todayParticipationCount, setTodayParticipationCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<'전체' | '일상' | '연애' | '가치관' | '엔터테인먼트' | '상상'>('전체');
  const [tutorialStatus, setTutorialStatus] = useState<{
    mainAnswered: boolean;
    livepickParticipated: boolean;
    livepickCreated: boolean;
    rewardGiven500: boolean;
    allCompleted: boolean;
  } | null>(null);

  // 사용자 인증 확인
  useEffect(() => {
    const unsubscribe = watchAuth(async (user) => {
      setUser(user);
      if (user) {
        checkTodayParticipationCount(user.uid);
        // 튜토리얼 상태 로드
        try {
          const status = await getTutorialStatus(user.uid);
          setTutorialStatus(status);
        } catch (e) {
          console.warn('[Tutorial] 튜토리얼 상태 로드 실패:', e);
        }
      }
    });
    return unsubscribe;
  }, []);

  // 화면이 포커스될 때마다 튜토리얼 상태 갱신
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        getTutorialStatus(user.uid).then(status => {
          setTutorialStatus(status);
        }).catch(e => {
          console.warn('[Tutorial] 튜토리얼 상태 갱신 실패:', e);
        });
      }
    }, [user])
  );

  // 라이브픽 질문 초기 로드
  const loadInitialQuestions = async () => {
    try {
      setLoading(true);
      const list = await getLivePickQuestions(PAGE_SIZE);
      setQuestions(list);
      setHasMore(list.length === PAGE_SIZE);
    } catch (error) {
      console.error('❌ [LivePick] 질문 목록 초기 로드 실패:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 첫 마운트 시 질문 목록 로드
  useEffect(() => {
    loadInitialQuestions();
  }, []);

  // 추가 로드 (페이지네이션)
  const loadMoreQuestions = async () => {
    if (loadingMore || !hasMore || questions.length === 0) return;
    try {
      setLoadingMore(true);
      const last = questions[questions.length - 1];
      const lastCreatedAt = last.createdAt as Date;
      const more = await getLivePickQuestions(PAGE_SIZE, lastCreatedAt);
      if (more.length === 0) {
        setHasMore(false);
        return;
      }
      setQuestions(prev => [...prev, ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } catch (error) {
      console.error('❌ [LivePick] 추가 질문 로드 실패:', error);
    } finally {
      setLoadingMore(false);
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

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialQuestions();
  };

  // 시간 포맷팅 함수
  // - 24시간 이내: "N분 전" / "N시간 전"
  // - 24시간 이상: "YYYY.MM.DD"
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    // 24시간 이상 지난 경우: 날짜로 표시
    if (hours >= 24) {
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${year}.${month}.${day}`;
    }

    // 24시간 이내: "N시간 전" / "N분 전" / "방금 전"
    if (hours > 0) {
      return `${hours}시간 전`;
    } else if (minutes > 0) {
      return `${minutes}분 전`;
    } else {
      return '방금 전';
    }
  };

  // 질문 카드 컴포넌트
  const QuestionCard = ({ question }: { question: LivePickQuestion }) => {
    const timeAgo = formatTimeAgo(question.createdAt as Date);
    const option1Percent = question.participantCount > 0 
      ? Math.round((question.option1Count / question.participantCount) * 100)
      : 0;
    const option2Percent = question.participantCount > 0
      ? 100 - option1Percent
      : 0;
    const hasVotes = question.participantCount > 0;

    return (
      <TouchableOpacity
        style={styles.questionCard}
        activeOpacity={0.7}
        onPress={() => router.push(`/(tabs)/livepick/${question.id}`)}
      >
        <Text style={styles.questionTitle}>{question.title}</Text>
        
        <View style={styles.optionsContainer}>
          <View style={styles.optionItem}>
            <Text style={styles.optionText}>{question.option1}</Text>
            <Text style={[styles.optionPercent, styles.optionPercentLeft]}>{option1Percent}%</Text>
          </View>
          <View style={styles.optionDivider} />
          <View style={styles.optionItem}>
            <Text style={styles.optionText}>{question.option2}</Text>
            <Text style={[styles.optionPercent, styles.optionPercentRight]}>{option2Percent}%</Text>
          </View>
        </View>

        <View style={[styles.progressBar, !hasVotes && styles.progressBarEmpty]}>
          {hasVotes && (
            <View style={[styles.progressFill, { width: `${option1Percent}%` }]} />
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="people" size={16} color={colors.textSecondary} />
            <Text style={styles.footerText}>{question.participantCount}명 참여</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.footerText}>{timeAgo}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>라이브픽</Text>
          {/* 일일 참여 제한 표시 */}
          {user && (
            <View style={styles.participationBadge}>
              <Ionicons name="time" size={14} color={todayParticipationCount >= 4 ? colors.warning : colors.primary} />
              <Text style={[
                styles.participationText,
                todayParticipationCount >= 4 && styles.participationTextLimit
              ]}>
                오늘 {todayParticipationCount}/4회
              </Text>
            </View>
          )}
        </View>
        <View style={{ position: 'relative' }}>
        <TouchableOpacity
          style={styles.createButton}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/livepick/create')}
        >
          <Ionicons name="add-circle" size={24} color={colors.primary} />
          <Text style={styles.createButtonText}>질문 만들기</Text>
        </TouchableOpacity>
          {/* 튜토리얼 말풍선 (질문 만들기 안내) - 라이브픽 참여 후 표시 */}
          {tutorialStatus && tutorialStatus.livepickParticipated && !tutorialStatus.livepickCreated && (
            <TutorialTooltip
              message="나만의 라이브픽 질문을 만들어보세요"
              position="right"
              style={{ position: 'absolute', top: -10, right: '100%', marginRight: 8 }}
              width={200}
              color="#FF5722"
              blink={true}
            />
          )}
        </View>
      </View>

      {/* 카테고리 필터 */}
      <View style={styles.categoryFilter}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryFilterContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryButton,
              selectedCategory === '전체' && styles.categoryButtonActive,
            ]}
            onPress={() => setSelectedCategory('전체')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.categoryButtonText,
                selectedCategory === '전체' && styles.categoryButtonTextActive,
              ]}
            >
              전체
            </Text>
          </TouchableOpacity>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(category)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === category && styles.categoryButtonTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 질문 리스트 */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.emptyText}>질문 목록을 불러오는 중...</Text>
          </View>
        ) : (() => {
          // 카테고리로 필터링
          const filteredQuestions = selectedCategory === '전체'
            ? questions
            : questions.filter((q) => q.category === selectedCategory);

          if (filteredQuestions.length === 0) {
            return (
              <View style={styles.emptyState}>
                <Ionicons name="flame-outline" size={64} color={colors.textLight} />
                <Text style={styles.emptyText}>
                  {selectedCategory === '전체' ? '아직 질문이 없어요' : `${selectedCategory} 카테고리 질문이 없어요`}
                </Text>
                <Text style={styles.emptySubtext}>
                  {selectedCategory === '전체' ? '첫 번째 질문을 만들어보세요!' : '다른 카테고리를 확인해보세요!'}
                </Text>
              </View>
            );
          }

          return (
            <>
              {filteredQuestions.map((question) => (
            <QuestionCard key={question.id} question={question} />
              ))}
              {hasMore && !loadingMore && (
                <TouchableOpacity
                  style={{ marginTop: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center' }}
                  activeOpacity={0.7}
                  onPress={loadMoreQuestions}
                >
                  <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '600', marginRight: 4 }}>
                    더보기
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
              {loadingMore && (
                <View style={{ marginTop: 8, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
            </>
          );
        })()}
      </ScrollView>

      {/* 라이브픽 튜토리얼 말풍선 - 화면 최상단 오버레이로 표시 */}
      {tutorialStatus && !tutorialStatus.livepickParticipated && (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 140, // 헤더 + 카테고리 바로 아래 정도
            left: 0,
            right: 0,
            zIndex: 1000,
            alignItems: 'center',
          }}
        >
          <TutorialTooltip
            message="라이브픽 질문에 한 번 참여해보세요"
            position="bottom"
            style={{}}
            color="#FF5722"
            blink={true}
          />
        </View>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  participationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  participationText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  participationTextLimit: {
    color: colors.warning,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    gap: 16,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionItem: {
    flex: 1,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionPercent: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  optionPercentLeft: {
    color: colors.primary,
  },
  optionPercentRight: {
    color: colors.accent,
  },
  optionDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.accent,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarEmpty: {
    backgroundColor: colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  categoryFilter: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },
  categoryFilterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  categoryButtonTextActive: {
    color: 'white',
  },
});
