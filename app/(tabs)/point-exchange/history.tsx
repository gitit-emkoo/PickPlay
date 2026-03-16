import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import colors from '../../../src/styles/colors';
import { watchAuth } from '../../../src/services/firebase';
import { ExchangeRequest, ExchangeRequestStatus } from '../../../src/types';
import { getExchangeHistory } from '../../../src/services/rewardStore';

const STATUS_LABELS: Record<ExchangeRequestStatus, string> = {
  requested: '신청완료',
  pending: '발송대기',
  completed: '발송완료',
  cancelled: '취소',
};

const STATUS_COLORS: Record<ExchangeRequestStatus, string> = {
  requested: '#22c55e', // 신청완료: 초록
  pending: colors.accent,
  completed: colors.primary, // 발송완료: 파란색(기존 primary)
  cancelled: colors.textLight,
};

export default function ExchangeHistoryScreen() {
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<ExchangeRequest[]>([]);

  const formatPoints = (value: number | undefined | null) =>
    typeof value === 'number' ? value.toLocaleString('ko-KR') : '0';

  const loadHistory = useCallback(async () => {
    try {
      const history = await getExchangeHistory();
      setRequests(history);
    } catch (error) {
      console.error('[ExchangeHistory] 내역 로드 실패:', error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = watchAuth(async (authUser) => {
      setUser(authUser);
      if (authUser) {
        try {
          const history = await getExchangeHistory();
          setRequests(history);
        } catch (error) {
          console.error('[ExchangeHistory] 내역 로드 실패:', error);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [loadHistory]);

  const formatDate = (value: any) => {
    try {
      const date =
        value?.toDate?.() instanceof Date
          ? value.toDate()
          : value instanceof Date
          ? value
          : new Date(value);
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      const hours = `${date.getHours()}`.padStart(2, '0');
      const minutes = `${date.getMinutes()}`.padStart(2, '0');
      return `${year}.${month}.${day} ${hours}:${minutes}`;
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/point-exchange')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>교환 내역</Text>
          <View style={{ width: 24 }} />
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
        <TouchableOpacity onPress={() => router.push('/(tabs)/point-exchange')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>교환 내역</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={colors.textLight} />
            <Text style={styles.emptyText}>교환 내역이 없습니다.</Text>
            <Text style={styles.emptySubtext}>
              포인트 교환소에서 상품을 교환해보세요.
            </Text>
          </View>
        ) : (
          requests.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <Text style={styles.requestTitle}>{request.rewardTitle}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_COLORS[request.status] + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: STATUS_COLORS[request.status] },
                    ]}
                  >
                    {STATUS_LABELS[request.status]}
                  </Text>
                </View>
              </View>
              <View style={styles.requestInfo}>
                <View style={styles.requestRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.requestLabel}>신청일시</Text>
                  <Text style={styles.requestValue}>{formatDate(request.createdAt)}</Text>
                </View>
                <View style={styles.requestRow}>
                  <View style={styles.pointsLottieWrapper}>
                    <LottieView
                      source={{ uri: "https://lottie.host/c691c7ab-e2e2-4a77-a50e-cef6c130dce1/GjbXQZOTda.lottie" }}
                      loop
                      autoPlay
                      style={styles.pointsLottie}
                    />
                  </View>
                  <Text style={styles.requestLabel}>사용 포인트</Text>
                  <Text style={styles.requestValue}>{formatPoints(request.usedPoints)}P</Text>
                </View>
              </View>
            </View>
          ))
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestInfo: {
    gap: 8,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsLottieWrapper: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointsLottie: {
    width: 20,
    height: 20,
  },
  requestLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  requestValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
