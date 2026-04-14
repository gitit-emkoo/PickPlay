import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../src/styles/colors';
import { LivePickQuestion } from '../../../src/types/livepick';
import { getArchivedLivePickQuestions, getWeeklyWinner, getWeeklyWinners } from '../../../src/services/livepick';
import { currentWeekKeyKST, getKoreanWeekKeyFromDate } from '../../../src/utils/date';


const CATEGORIES: Array<'일상' | '연애' | '가치관' | '엔터테인먼트' | '상상'> = ['일상', '연애', '가치관', '엔터테인먼트', '상상'];

function toCreatedAtDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number);
}

/**
 * 지난 라이브픽: 서버에서 `createdAt < 이번 주 KST 월요일 00:00` 인 질문만 대상으로 최신순 최대 N건(= 저번 주 일요일 23:59 이전과 동일 경계).
 * 인기순은 같은 목록을 `participantCount`로만 재정렬(추가 읽기 없음).
 */
const ARCHIVE_BATCH_SIZE = 100;

/** 지난 주 TOP이 없을 때(아직 한 주가 안 지났거나 해당 주 질문 없음) 보여줄 더미 카드용 데이터. 다음 주부터 실제 TOP으로 교체됨. */
const DUMMY_WEEKLY_TOP: Pick<LivePickQuestion, 'title' | 'participantCount' | 'category'> = {
  title: '이곳에는 매주 가장 많은 투표를 받은 질문이 표시됩니다.',
  participantCount: 0,
  category: '일상',
};

export default function LivePickArchiveScreen() {
  const router = useRouter();
  const [questions, setQuestions] = useState<LivePickQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'전체' | '일상' | '연애' | '가치관' | '엔터테인먼트' | '상상'>('전체');
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchModalAnim = useRef(new Animated.Value(0)).current;
  const [weeklyWinner, setWeeklyWinner] = useState<LivePickQuestion | null>(null);
  const [weeklyWinnerLoading, setWeeklyWinnerLoading] = useState(false);
  /** 최신순 페이지네이션: 다음 페이지는 이 createdAt보다 더 오래된 문서부터 */
  const latestCursorRef = useRef<Date | null>(null);
  const [hasMoreArchive, setHasMoreArchive] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 지난 주 weekKey 계산 (KST 기준)
  const [lastWeekKey] = useState<string>(() => {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return getKoreanWeekKeyFromDate(lastWeek);
  });

  const dedupeAppend = (prev: LivePickQuestion[], next: LivePickQuestion[]) => {
    const ids = new Set(prev.map((q) => q.id));
    return [...prev, ...next.filter((q) => !ids.has(q.id))];
  };

  /** 초기 로드·당겨서 새로고침 (정렬 전환 시에는 재요청하지 않음) */
  const loadArchivedQuestions = async (isRefresh: boolean = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      latestCursorRef.current = null;

      const batch = await getArchivedLivePickQuestions(ARCHIVE_BATCH_SIZE, undefined);
      setHasMoreArchive(batch.length === ARCHIVE_BATCH_SIZE);
      if (batch.length > 0) {
        latestCursorRef.current = toCreatedAtDate(batch[batch.length - 1].createdAt);
      }
      setQuestions(batch);
    } catch (error) {
      console.error('[LivePickArchive] 지난 질문 로드 실패:', error);
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  /** 이전 시점(더 오래된) 질문 추가 로드 — 정렬과 무관하게 동일 데이터 소스 */
  const loadMoreArchived = async () => {
    if (loadingMore || !hasMoreArchive) return;
    setLoadingMore(true);
    try {
      const after = latestCursorRef.current ?? undefined;
      const batch = await getArchivedLivePickQuestions(ARCHIVE_BATCH_SIZE, after);
      setHasMoreArchive(batch.length === ARCHIVE_BATCH_SIZE);
      if (batch.length > 0) {
        latestCursorRef.current = toCreatedAtDate(batch[batch.length - 1].createdAt);
      }
      setQuestions((prev) => dedupeAppend(prev, batch));
    } catch (error) {
      console.error('[LivePickArchive] 지난 질문 추가 로드 실패:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadArchivedQuestions(false);
  }, []);

  const loadWeeklyWinner = useCallback(async () => {
    try {
      setWeeklyWinnerLoading(true);
      let winner = await getWeeklyWinner(lastWeekKey);
      if (!winner || (winner.title?.trim() ?? '') === '') {
        const all = await getWeeklyWinners();
        if (all.length > 0 && all[0].weekKey && all[0].weekKey < currentWeekKeyKST()) {
          winner = all[0];
        }
      }
      setWeeklyWinner(winner);
    } catch (error) {
      console.error('[LivePickArchive] Weekly TOP 질문 로드 실패:', error);
      setWeeklyWinner(null);
    } finally {
      setWeeklyWinnerLoading(false);
    }
  }, [lastWeekKey]);

  const onRefresh = () => {
    setRefreshing(true);
    loadArchivedQuestions(true);
    loadWeeklyWinner(); // 당겨서 새로고침 시 위클리 탑도 다시 불러옴
  };

  // 지난 주 Weekly TOP 질문 초기 로드
  useEffect(() => {
    loadWeeklyWinner();
  }, [loadWeeklyWinner]);

  // 검색 모달 애니메이션
  useEffect(() => {
    if (showSearchModal) {
      Animated.spring(searchModalAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(searchModalAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [showSearchModal, searchModalAnim]);

  const filteredQuestions = useMemo(() => {
    let list = questions;

    // 카테고리 필터
    if (selectedCategory !== '전체') {
      list = list.filter((q) => q.category === selectedCategory);
    }

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      list = list.filter((q) =>
        q.title.toLowerCase().includes(query) ||
        q.option1.toLowerCase().includes(query) ||
        q.option2.toLowerCase().includes(query)
      );
    }

    // 정렬
    if (sortBy === 'popular') {
      return [...list].sort((a, b) => (b.participantCount || 0) - (a.participantCount || 0));
    }
    // latest: createdAt 기준 내림차순
    return [...list].sort((a, b) => {
      const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt as any);
      const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt as any);
      return bDate.getTime() - aDate.getTime();
    });
  }, [questions, selectedCategory, searchQuery, sortBy]);

  const renderCard = (question: LivePickQuestion) => {
    const total = question.participantCount || 0;
    const option1Count = question.option1Count || 0;
    const option2Count = question.option2Count || 0;
    const option1Percent = total > 0 ? Math.round((option1Count / total) * 100) : 50;
    const option2Percent = 100 - option1Percent;
    const hasVotes = total > 0;

    return (
      <View key={question.id} style={styles.questionCard}>
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
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.headerBackButton}
            activeOpacity={0.7}
            onPress={() => router.replace('/(tabs)/livepick')}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            지난 라이브픽
          </Text>
        </View>
        <View style={styles.headerActions}>
          {/* 검색 버튼 */}
          <TouchableOpacity
            style={styles.searchButton}
            activeOpacity={0.7}
            onPress={() => setShowSearchModal(true)}
          >
            <Ionicons name="search" size={20} color={colors.primary} />
          </TouchableOpacity>

          {/* 정렬: 최신순/인기순 드롭다운 트리거 */}
          <View style={styles.archiveSortWrap}>
            <TouchableOpacity
              style={styles.archivePillButton}
              activeOpacity={0.4}
              onPress={() => setShowSortDropdown(!showSortDropdown)}
            >
              <Text style={styles.archivePillText}>
                {sortBy === 'latest' ? '최신순' : '인기순'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={colors.primary}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 카테고리: 텍스트 탭 + 하단 디비전, 활성 = 파란 글씨 + 굵은 밑줄 */}
      <View style={styles.categoryFilter}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryFilterContent}
        >
          <TouchableOpacity
            style={styles.categoryTab}
            onPress={() => setSelectedCategory('전체')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.categoryTabLabel,
                selectedCategory === '전체' && styles.categoryTabLabelActive,
              ]}
            >
              전체
            </Text>
            <View
              style={[
                styles.categoryTabUnderline,
                selectedCategory === '전체' && styles.categoryTabUnderlineActive,
              ]}
            />
          </TouchableOpacity>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={styles.categoryTab}
              onPress={() => setSelectedCategory(category)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryTabLabel,
                  selectedCategory === category && styles.categoryTabLabelActive,
                ]}
              >
                {category}
              </Text>
              <View
                style={[
                  styles.categoryTabUnderline,
                  selectedCategory === category && styles.categoryTabUnderlineActive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.categoryFilterDivider} />
      </View>

      {/* 정렬 드롭다운: 화면 전체 기준 오버레이 (항상 맨 위) */}
      {showSortDropdown && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowSortDropdown(false)}
          />
          <View style={styles.sortDropdown}>
            <TouchableOpacity
              style={[
                styles.sortOption,
                sortBy === 'latest' && styles.sortOptionActive,
              ]}
              onPress={() => {
                setSortBy('latest');
                setShowSortDropdown(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortBy === 'latest' && styles.sortOptionTextActive,
                ]}
              >
                최신순
              </Text>
              {sortBy === 'latest' && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sortOption,
                sortBy === 'popular' && styles.sortOptionActive,
              ]}
              onPress={() => {
                setSortBy('popular');
                setShowSortDropdown(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortBy === 'popular' && styles.sortOptionTextActive,
                ]}
              >
                인기순
              </Text>
              {sortBy === 'popular' && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* 스크롤 영역: 안내 텍스트 → 지난주 TOP → 리스트 */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.infoBox}>
          <Ionicons name="time-outline" size={16} color={colors.primary} />
          <Text style={styles.infoText}>
            지난 주까지 진행된 라이브픽 질문의 결과를 확인할 수 있어요.
          </Text>
        </View>

        {/* 지난 주 Weekly TOP: 클릭 시 주간 TOP 전체 목록 페이지로 이동 (스크롤에 포함) */}
        <View style={styles.weeklyWinnerContainer}>
          <Text style={styles.weeklyWinnerTitle}>지난 주 Weekly TOP 질문</Text>
          {weeklyWinnerLoading ? (
            <View style={styles.weeklyWinnerLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.weeklyWinnerLoadingText}>불러오는 중...</Text>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/livepick/weekly-top')}
            >
              {(weeklyWinner != null && (weeklyWinner.title?.trim() ?? '') !== '') ? (
                <View style={styles.weeklyWinnerCard}>
                  <Text style={styles.weeklyWinnerQuestionTitle} numberOfLines={2}>
                    {weeklyWinner.title}
                  </Text>
                  <View style={styles.weeklyWinnerMeta}>
                    <View style={styles.weeklyWinnerMetaItem}>
                      <Ionicons name="people" size={14} color={colors.textSecondary} />
                      <Text style={styles.weeklyWinnerMetaText}>
                        {weeklyWinner.participantCount || 0}명 참여
                      </Text>
                    </View>
                    <View style={styles.weeklyWinnerMetaItem}>
                      <Ionicons name="pricetag" size={14} color={colors.textSecondary} />
                      <Text style={styles.weeklyWinnerMetaText}>{weeklyWinner.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.weeklyWinnerTapHint}>탭하면 지난 모든 주간 TOP 보기</Text>
                </View>
              ) : (
                <View style={styles.weeklyWinnerCard}>
                  <View style={styles.weeklyWinnerDummyBadge}>
                    <Text style={styles.weeklyWinnerDummyBadgeText}>샘플</Text>
                  </View>
                  <Text style={styles.weeklyWinnerQuestionTitle} numberOfLines={2}>
                    {DUMMY_WEEKLY_TOP.title}
                  </Text>
                  <View style={styles.weeklyWinnerMeta}>
                    <View style={styles.weeklyWinnerMetaItem}>
                      <Ionicons name="people" size={14} color={colors.textSecondary} />
                      <Text style={styles.weeklyWinnerMetaText}>
                        {DUMMY_WEEKLY_TOP.participantCount}명 참여
                      </Text>
                    </View>
                    <View style={styles.weeklyWinnerMetaItem}>
                      <Ionicons name="pricetag" size={14} color={colors.textSecondary} />
                      <Text style={styles.weeklyWinnerMetaText}>{DUMMY_WEEKLY_TOP.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.weeklyWinnerDummyNote}>
                    다음 주부터 실제 주간 TOP 질문이 표시됩니다.
                  </Text>
                  <Text style={styles.weeklyWinnerTapHint}>탭하면 주간 TOP 목록 보기</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* 리스트 */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>지난 질문을 불러오는 중...</Text>
          </View>
        ) : filteredQuestions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={colors.textLight} />
            <Text style={styles.emptyText}>아직 지난 질문이 없어요.</Text>
            <Text style={styles.emptySubtext}>
              이번 주 라이브픽 질문이 종료되면 이곳에서 확인하실 수 있어요.
            </Text>
            {hasMoreArchive && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                activeOpacity={0.7}
                onPress={loadMoreArchived}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>이전 질문 더보기</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View>
            {filteredQuestions.map(renderCard)}
            {hasMoreArchive && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                activeOpacity={0.7}
                onPress={loadMoreArchived}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Text style={styles.loadMoreText}>이전 질문 더보기</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* 검색 모달 */}
      <Modal
        visible={showSearchModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <TouchableOpacity
          style={styles.searchModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSearchModal(false)}
        >
          <Animated.View
            style={[
              styles.searchModalContent,
              {
                transform: [
                  {
                    translateY: searchModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-300, 0],
                    }),
                  },
                ],
                opacity: searchModalAnim,
              },
            ]}
          >
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>지난 질문 검색</Text>
              <TouchableOpacity
                onPress={() => setShowSearchModal(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search"
                size={20}
                color={colors.textSecondary}
                style={styles.searchInputIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="질문 제목이나 선택지를 검색하세요"
                placeholderTextColor={colors.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  activeOpacity={0.7}
                  style={styles.searchClearButton}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            {searchQuery.trim() && (
              <Text style={styles.searchResultText}>
                {filteredQuestions.length}개의 지난 질문을 찾았습니다
              </Text>
            )}
          </Animated.View>
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 22,
    backgroundColor: colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  archiveSortWrap: {
    position: 'relative',
    zIndex: 10000,
  },
  archivePillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.69)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  archivePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
    marginRight: 8,
  },
  headerBackButton: {
    paddingVertical: 4,
    paddingRight: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortDropdown: {
    position: 'absolute',
    top: 74,
    right: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 8,
    minWidth: 120,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  sortOptionActive: {
    backgroundColor: colors.primary,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sortOptionTextActive: {
    color: 'white',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 2,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  weeklyWinnerContainer: {
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
  },
  weeklyWinnerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  weeklyWinnerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weeklyWinnerLoadingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  weeklyWinnerDummyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  weeklyWinnerDummyBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  weeklyWinnerDummyNote: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 6,
  },
  weeklyWinnerTapHint: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 8,
  },
  weeklyWinnerCard: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  weeklyWinnerQuestionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  weeklyWinnerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weeklyWinnerMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weeklyWinnerMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  categoryFilter: {
    backgroundColor: colors.background,
    position: 'relative',
  },
  categoryFilterContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 0,
  },
  categoryTab: {
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 36,
  },
  categoryTabLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
    paddingBottom: 10,
  },
  categoryTabLabelActive: {
    color: colors.primary,
  },
  categoryTabUnderline: {
    height: 3,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  categoryTabUnderlineActive: {
    backgroundColor: colors.primary,
  },
  categoryFilterDivider: {
    height: 1,
    backgroundColor: colors.border,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadMoreButton: {
    marginTop: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  loadMoreText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  searchModalContent: {
    backgroundColor: colors.background,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 30,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInputIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 14,
  },
  searchClearButton: {
    marginLeft: 8,
    padding: 4,
  },
  searchResultText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
});

