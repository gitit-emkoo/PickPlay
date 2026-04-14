import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import colors from '../src/styles/colors';
import { LivePickQuestion } from '../src/types/livepick';
import { getMyLivePickQuestions } from '../src/services/livepick';
import { watchAuth } from '../src/services/firebase';

export default function MyCreatedQuestionsScreen() {
  const router = useRouter();
  const [userUid, setUserUid] = useState<string | null>(null);
  const [questions, setQuestions] = useState<LivePickQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuestions = async (uid: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const list = await getMyLivePickQuestions(uid, 100);
      setQuestions(list);
    } catch (e) {
      console.error('내 질문 목록 로드 실패:', e);
      setError('질문 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = watchAuth(async (user) => {
      if (user?.uid) {
        setUserUid(user.uid);
        await loadQuestions(user.uid);
      } else {
        setUserUid(null);
        setQuestions([]);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        router.push('/(tabs)/mypage');
        return true;
      });
      return () => backHandler.remove();
    }
  }, [router]);

  const onRefresh = async () => {
    if (userUid) await loadQuestions(userUid, true);
  };

  const formatDate = (value: Date | any) => {
    try {
      const date = value?.toDate?.() instanceof Date ? value.toDate() : value instanceof Date ? value : new Date(value);
      const y = date.getFullYear();
      const m = `${date.getMonth() + 1}`.padStart(2, '0');
      const d = `${date.getDate()}`.padStart(2, '0');
      return `${y}.${m}.${d}`;
    } catch {
      return '';
    }
  };

  const renderCard = (question: LivePickQuestion) => {
    const total = question.participantCount || 0;
    const option1Count = question.option1Count || 0;
    const option1Percent = total > 0 ? Math.round((option1Count / total) * 100) : 50;
    const option2Percent = 100 - option1Percent;
    const hasVotes = total > 0;

    return (
      <TouchableOpacity
        key={question.id}
        style={styles.card}
        activeOpacity={0.7}
        onPress={() =>
          router.push({
            pathname: '/(tabs)/livepick/[id]',
            params: { id: question.id, from: 'my_created' },
          } as any)
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{formatDate(question.createdAt)}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{question.title}</Text>
        <View style={styles.optionsRow}>
          <Text style={[styles.optionText, styles.optionTextLeft]} numberOfLines={1}>{question.option1}</Text>
          <Text style={[styles.optionText, styles.optionTextRight]} numberOfLines={1}>{question.option2}</Text>
        </View>
        <View style={[styles.progressBar, !hasVotes && styles.progressBarEmpty]}>
          {hasVotes && (
            <>
              <View style={[styles.progressFillLeft, { width: `${option1Percent}%` }]} />
              <View style={[styles.progressFillRight, { width: `${option2Percent}%` }]} />
            </>
          )}
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="people" size={14} color={colors.textSecondary} />
            <Text style={styles.footerText}>{question.participantCount}명 참여</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)/mypage')} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내가 생성한 질문</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {!userUid ? (
        <View style={styles.centerBox}>
          <Text style={styles.infoText}>로그인 후 확인할 수 있어요.</Text>
        </View>
      ) : loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>불러오는 중...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!error && questions.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="create-outline" size={56} color={colors.textLight} />
              <Text style={styles.emptyText}>아직 생성한 질문이 없어요.</Text>
              <Text style={styles.emptySubtext}>라이브픽에서 질문을 만들면 여기에 모여요.</Text>
              <TouchableOpacity
                style={styles.goCreateButton}
                activeOpacity={0.7}
                onPress={() => router.replace('/(tabs)/livepick/create')}
              >
                <Text style={styles.goCreateButtonText}>질문 만들기</Text>
              </TouchableOpacity>
            </View>
          )}
          {!error && questions.length > 0 && questions.map(renderCard)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 24,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerPlaceholder: { width: 32 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: colors.error || '#d00',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
  },
  goCreateButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  goCreateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.primary + '18',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateText: {
    fontSize: 12,
    color: colors.textLight,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  optionText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  optionTextLeft: {
    textAlign: 'left',
  },
  optionTextRight: {
    textAlign: 'right',
  },
  progressBar: {
    height: 8,
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarEmpty: {
    backgroundColor: colors.border,
  },
  progressFillLeft: {
    height: '100%',
    backgroundColor: colors.primary,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  progressFillRight: {
    height: '100%',
    backgroundColor: '#FACC15',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
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
});
