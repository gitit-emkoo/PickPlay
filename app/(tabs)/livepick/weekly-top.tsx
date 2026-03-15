import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../src/styles/colors';
import { LivePickQuestion } from '../../../src/types/livepick';
import { getWeeklyWinners } from '../../../src/services/livepick';

/** 주차 라벨 포맷 (예: 2026-03-02 → "3월 1주", 2026-03-09 → "3월 2주") */
function formatWeekLabel(weekKey: string): string {
  const parts = weekKey.split('-');
  if (parts.length !== 3) return weekKey;
  const [, month, day] = parts;
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (Number.isNaN(m) || Number.isNaN(d)) return weekKey;
  const weekOfMonth = Math.ceil(d / 7); // 해당 월의 몇 주차 (월요일 기준)
  return `${m}월 ${weekOfMonth}주`;
}

export default function WeeklyTopScreen() {
  const router = useRouter();
  const [list, setList] = useState<LivePickQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await getWeeklyWinners();
      setList(data);
    } catch (error) {
      console.error('[WeeklyTop] 로드 실패:', error);
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  // 지난 질문 보기와 동일: 제목 + 선택지 2개 + 비율 + 그래프 + 참여 수
  const renderCard = (question: LivePickQuestion, weekKey: string) => {
    const total = question.participantCount || 0;
    const option1Count = question.option1Count ?? 0;
    const option2Count = question.option2Count ?? 0;
    const option1Percent = total > 0 ? Math.round((option1Count / total) * 100) : 50;
    const option2Percent = 100 - option1Percent;
    const hasVotes = total > 0;
    const opt1 = (question.option1?.trim() ?? '') || '—';
    const opt2 = (question.option2?.trim() ?? '') || '—';

    return (
      <View key={`${weekKey}-${question.id}`} style={styles.cardWrapper}>
        <Text style={styles.weekLabel}>{formatWeekLabel(weekKey)} TOP</Text>
        <View style={styles.questionCard}>
          <Text style={styles.questionTitle}>{question.title}</Text>
          <View style={styles.optionsContainer}>
            <View style={styles.optionItem}>
              <Text style={styles.optionText}>{opt1}</Text>
              <Text style={[styles.optionPercent, styles.optionPercentLeft]}>{option1Percent}%</Text>
            </View>
            <View style={styles.optionDivider} />
            <View style={styles.optionItem}>
              <Text style={styles.optionText}>{opt2}</Text>
              <Text style={[styles.optionPercent, styles.optionPercentRight]}>{option2Percent}%</Text>
            </View>
          </View>
          <View style={[styles.progressBar, !hasVotes && styles.progressBarEmpty]}>
            {hasVotes && <View style={[styles.progressFill, { width: `${option1Percent}%` }]} />}
          </View>
          <View style={styles.cardFooter}>
            <View style={styles.footerItem}>
              <Ionicons name="people" size={16} color={colors.textSecondary} />
              <Text style={styles.footerText}>{question.participantCount}명 참여</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)/livepick/archive')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>주간 TOP 질문</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>불러오는 중...</Text>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>저장된 주간 TOP이 없어요</Text>
            <Text style={styles.emptySubtext}>
              지난 질문 보기에서 해당 주를 조회하면{'\n'}자동으로 저장됩니다.
            </Text>
          </View>
        ) : (
          list.map((q) => renderCard(q, q.weekKey ?? ''))
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    gap: 16,
  },
  cardWrapper: {
    marginBottom: 8,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
    marginLeft: 4,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyState: {
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
});
