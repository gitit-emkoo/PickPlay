import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../src/styles/colors';
import { watchAuth } from '../../src/services/firebase';
import { ensureUser } from '../../src/services/store';
import { UserData } from '../../src/types';
import CharacterCard from '../components/CharacterCard';

export default function AnimaCodeScreen() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

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

  const remainingForAnima = userData ? Math.max(0, 30 - (userData.totalSelections || 0)) : 30;

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>애니마코드 안내</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* 현재 애니마코드 카드 */}
        <View style={styles.myAnimaCodeSection}>
          <Text style={styles.myAnimaCodeTitle}>나의 애니마코드</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : userData ? (
            <>
              <View style={styles.cardContainer}>
                <CharacterCard 
                  userData={{
                    uid: userData.uid,
                    createdAt: userData.createdAt,
                    totalSelections: userData.totalSelections ?? 0,
                    characterId: userData.characterId ?? null,
                    adjective1: userData.adjective1 ?? null,
                    adjective2: userData.adjective2 ?? null,
                    points: userData.points,
                    streakCount: userData.streakCount,
                    lastAnswerDate: userData.lastAnswerDate,
                    nickname: userData.nickname,
                  } as UserData}
                />
              </View>
              
              {/* 안내 문구 - 캐릭터가 없을 때만 표시 */}
              {!userData.characterId && (
                <View style={styles.infoCard}>
                  <Ionicons name="information-circle" size={20} color={colors.primary} />
                  <Text style={styles.infoText}>
                    AnimaCode 생성을 위한{' '}
                    <Text style={styles.highlight}>{remainingForAnima}번의 선택</Text>
                    이 쌓이면, 너의 내면의 캐릭터가 탄생하고 진짜 이름과 여정이 시작돼!
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>로그인이 필요합니다.</Text>
            </View>
          )}
        </View>

        {/* 구분선 */}
        <View style={styles.divider} />
        {/* 소개 섹션 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>애니마코드란?</Text>
          </View>
          <Text style={styles.description}>
            애니마코드는 나의 선택을 통해 탄생하는 내면의 캐릭터입니다.{'\n'}
            매일의 질문에 답하며 자신을 알아가고,{'\n'}
            당신만의 캐릭터와 형용사 태그를 얻어보세요!
          </Text>
        </View>

        {/* 획득 방법 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>캐릭터 획득</Text>
          </View>
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>질문에 답하기</Text>
              <Text style={styles.stepDescription}>
                홈 화면에서 매일 새로운 질문에 답해주세요
              </Text>
            </View>
          </View>
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>30번 선택 완료</Text>
              <Text style={styles.stepDescription}>
                총 30번의 질문에 답하면 당신만의 캐릭터가 탄생합니다!
              </Text>
            </View>
          </View>
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>애니마코드 확인</Text>
              <Text style={styles.stepDescription}>
                캐릭터 카드와 형용사 태그를 확인하세요
              </Text>
            </View>
          </View>
        </View>

        {/* 형용사 갱신 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sync" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>형용사 갱신</Text>
          </View>
          <Text style={styles.description}>
            캐릭터를 획득한 후에도 계속해서 질문에 답하면{'\n'}
            <Text style={styles.highlight}>30번마다 형용사 태그가 갱신</Text>됩니다.{'\n\n'}
            예시: 60번, 90번, 120번...{'\n\n'}
            새로운 선택을 통해 당신의 성향이 진화하는 모습을 확인해보세요!
          </Text>
        </View>

        {/* 주요 기능 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>주요 기능</Text>
          </View>
          
          <View style={styles.featureCard}>
            <Ionicons name="images" size={20} color={colors.primary} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>캐릭터 카드</Text>
              <Text style={styles.featureDescription}>
                카드를 탭하면 뒤집어져 상세 정보를 확인할 수 있습니다
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Ionicons name="pricetags" size={20} color={colors.primary} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>형용사 태그</Text>
              <Text style={styles.featureDescription}>
                나의 선택 패턴을 분석한 형용사 태그 2개가 표시됩니다
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Ionicons name="trending-up" size={20} color={colors.primary} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>진화 시스템</Text>
              <Text style={styles.featureDescription}>
                계속해서 답변하면 형용사가 업데이트되어 성장하는 모습을 볼 수 있습니다
              </Text>
            </View>
          </View>
        </View>

        {/* 팁 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb" size={24} color={colors.accent} />
            <Text style={styles.sectionTitle}>팁</Text>
          </View>
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              • 매일 꾸준히 답변하면 더 빠르게 캐릭터를 획득할 수 있어요{'\n\n'}
              • 자신의 진짜 생각을 선택하는 것이 중요합니다{'\n\n'}
              • 형용사는 나의 선택 패턴에 따라 달라질 수 있어요{'\n\n'}
              • 캐릭터 카드를 홈 화면에서도 확인할 수 있습니다
            </Text>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="help-circle" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>자주 묻는 질문</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Q. 캐릭터는 몇 개나 있나요?</Text>
            <Text style={styles.faqAnswer}>
              A. 다양한 캐릭터가 준비되어 있습니다. 나의 선택 패턴에 따라 다른 캐릭터가 배정됩니다.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Q. 형용사 태그는 어떻게 결정되나요?</Text>
            <Text style={styles.faqAnswer}>
              A. AI가 나의 선택 패턴을 분석하여 가장 적합한 형용사를 추천합니다.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Q. 이미 획득한 캐릭터를 바꿀 수 있나요?</Text>
            <Text style={styles.faqAnswer}>
              A. 캐릭터는 처음 배정된 것을 유지하지만, 형용사 태그는 계속해서 갱신됩니다.
            </Text>
          </View>
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
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  highlight: {
    fontWeight: '700',
    color: colors.primary,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  featureContent: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  tipCard: {
    backgroundColor: '#FFF4E6',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  faqItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  myAnimaCodeSection: {
    marginBottom: 24,
    paddingBottom: 24,
  },
  myAnimaCodeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E6F2FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
});
