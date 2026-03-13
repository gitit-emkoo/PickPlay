import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../src/styles/colors';
import { LivePickQuestion } from '../../../src/types/livepick';
import { getLivePickQuestions, getWeeklyWinner } from '../../../src/services/livepick';
import { currentWeekKeyKST, getKoreanWeekKeyFromDate } from '../../../src/utils/date';

const CATEGORIES: Array<'일상' | '연애' | '가치관' | '엔터테인먼트' | '상상'> = ['일상', '연애', '가치관', '엔터테인먼트', '상상'];

const PAGE_SIZE = 50;

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

  // 지난 주 weekKey 계산 (KST 기준)
  const [lastWeekKey] = useState<string>(() => {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return getKoreanWeekKeyFromDate(lastWeek);
  });

  const loadArchivedQuestions = async (isRefresh: boolean = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      const all = await getLivePickQuestions(PAGE_SIZE, undefined, sortBy);
      const currentWeekKey = currentWeekKeyKST();
      const archived = all.filter(q => q.weekKey !== currentWeekKey);
      setQuestions(archived);
    } catch (error) {
      console.error('[LivePickArchive] 지난 질문 로드 실패:', error);
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadArchivedQuestions(false);
  }, [sortBy]);

  const onRefresh = () => {
    setRefreshing(true);
    loadArchivedQuestions(true);
  };

  // 지난 주 Weekly TOP 질문 로드
  useEffect(() => {
    const loadWeeklyWinner = async () => {
      try {
        setWeeklyWinnerLoading(true);
        const winner = await getWeeklyWinner(lastWeekKey);
        setWeeklyWinner(winner);
      } catch (error) {
        console.error('[LivePickArchive] Weekly TOP 질문 로드 실패:', error);
      } finally {
        setWeeklyWinnerLoading(false);
      }
    };

    loadWeeklyWinner();
  }, [lastWeekKey]);

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
          <Text style={styles.headerTitle}>지난질문</Text>
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

          {/* 정렬 버튼 */}
          <View style={{ position: 'relative', zIndex: 1000 }}>
            <TouchableOpacity
              style={styles.sortButton}
              activeOpacity={0.7}
              onPress={() => setShowSortDropdown(!showSortDropdown)}
            >
              <Ionicons name="menu" size={20} color={colors.primary} />
            </TouchableOpacity>

            {/* 정렬 드롭다운 */}
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
          </View>

          {/* 닫기 버튼 */}
          <TouchableOpacity
            style={styles.closeButton}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/livepick')}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 지난 질문 안내 */}
      <View style={styles.infoBox}>
        <Ionicons name="time-outline" size={16} color={colors.primary} />
        <Text style={styles.infoText}>
          지난 주까지 진행된 라이브픽 질문의 결과를 확인할 수 있어요.
        </Text>
      </View>

      {/* 지난 주 Weekly TOP 질문 하이라이트 */}
      <View style={styles.weeklyWinnerContainer}>
        <Text style={styles.weeklyWinnerTitle}>지난 주 Weekly TOP 질문</Text>
        {weeklyWinnerLoading ? (
          <View style={styles.weeklyWinnerLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.weeklyWinnerLoadingText}>불러오는 중...</Text>
          </View>
        ) : !weeklyWinner ? (
          <Text style={styles.weeklyWinnerEmptyText}>
            지난 주에는 선정된 Weekly TOP 질문이 없습니다.
          </Text>
        ) : (
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
          </View>
        )}
      </View>

      {/* 카테고리 필터 (라이브픽과 동일) */}
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

      {/* 리스트 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>지난 질문을 불러오는 중...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredQuestions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>아직 지난 질문이 없어요.</Text>
              <Text style={styles.emptySubtext}>
                이번 주 라이브픽 질문이 종료되면 이곳에서 확인하실 수 있어요.
              </Text>
            </View>
          ) : (
            filteredQuestions.map(renderCard)
          )}
        </ScrollView>
      )}

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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
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
  sortButton: {
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
    top: 48,
    right: 0,
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
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
    zIndex: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  weeklyWinnerContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: colors.background,
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
  weeklyWinnerEmptyText: {
    fontSize: 12,
    color: colors.textSecondary,
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: colors.background,
  },
  categoryFilterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  categoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: 'white',
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

