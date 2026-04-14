import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, BackHandler, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import colors from '../src/styles/colors';
import { PointHistory } from '../src/types';
import { getPointHistory } from '../src/services/pointHistory';
import { watchAuth } from '../src/services/firebase';

export default function PointHistoryScreen() {
  const router = useRouter();
  const [userUid, setUserUid] = useState<string | null>(null);
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  useEffect(() => {
    const unsubscribe = watchAuth(async (user) => {
      if (user?.uid) {
        setUserUid(user.uid);
        await loadHistory(user.uid);
      } else {
        setUserUid(null);
        setHistory([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // 안드로이드 하드웨어 뒤로가기 버튼 처리
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // 마이페이지로 이동
        router.push('/(tabs)/mypage');
        return true; // 기본 동작 방지
      });

      return () => backHandler.remove();
    }
  }, [router]);

  const loadHistory = async (uid: string) => {
    try {
      setLoading(true);
      setError(null);
      const list = await getPointHistory(uid, 100);
      setHistory(list);
      // 초기에는 최신 PAGE_SIZE개만 표시
      setVisibleCount(PAGE_SIZE);
    } catch (e) {
      console.error('포인트 상세 내역 로드 실패:', e);
      setError('포인트 내역을 불러오지 못했어요.');
    } finally {
      setLoading(false);
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

  const reasonMap: Record<string, string> = {
    basic_reward: '라이브픽 기본 보상',
    ladder_reward: '라이브픽 사다리 게임',
    creator_reward: '라이브픽 질문자 보상',
    top_reward: '라이브픽 TOP 질문 보상',
    weekly_top_reward: '주간 TOP 질문 보상',
    majority_reward: '메인 질문 보상',
    ad_bonus: '광고 보너스',
    livepick_question_creation: '라이브픽 질문 생성',
    manual: '수동 지급',
    etc: '기타',
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/(tabs)/mypage')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>포인트 내역</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !userUid ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.infoText}>로그인 후 포인트 내역을 확인할 수 있어요.</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!error && history.length === 0 && (
            <Text style={styles.emptyText}>포인트 내역이 아직 없어요.</Text>
          )}
          {!error &&
            history.length > 0 &&
            history.slice(0, visibleCount).map((item) => {
              const reasonText = reasonMap[item.reason] || item.reason;
              const rawText = item.description || reasonText;
              const displayText = rawText.replace('(광고 미시청)', '(영상 미시청)');
              return (
                <View key={item.id} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowTitle}>{displayText}</Text>
                    <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text>
                  </View>
                  <Text
                    style={[
                      styles.rowAmount,
                      item.amount >= 0 ? styles.plus : styles.minus,
                    ]}
                  >
                    {item.amount >= 0 ? `+${item.amount}P` : `${item.amount}P`}
                  </Text>
                </View>
              );
            })}
          {!error && history.length > visibleCount && (
            <TouchableOpacity
              style={styles.moreButton}
              activeOpacity={0.7}
              onPress={() =>
                setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, history.length))
              }
            >
              <Text style={styles.moreButtonText}>더보기 (다음 {PAGE_SIZE}개)</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </ScrollView>
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
  headerPlaceholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: colors.error || '#d00',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flexShrink: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  rowDate: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  plus: {
    color: colors.primary,
  },
  minus: {
    color: '#d9534f',
  },
  moreButton: {
    marginTop: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  moreButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});


