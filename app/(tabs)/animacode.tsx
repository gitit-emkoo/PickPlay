import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Share, Clipboard, Alert, Image as RNImage } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import colors from '../../src/styles/colors';
import { watchAuth } from '../../src/services/firebase';
import { ensureUser } from '../../src/services/store';
import { UserData } from '../../src/types';
import CharacterCard from '../components/CharacterCard';
import { getDispositionDescription } from '../../src/services/animaDispositionDescriptions';
import firestore from '@react-native-firebase/firestore';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

export default function AnimaCodeScreen() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);

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

  const currentDispositionDescription = useMemo(() => {
    if (!userData?.adjective1 || !userData?.adjective2) return '';
    return getDispositionDescription(userData.adjective1, userData.adjective2);
  }, [userData?.adjective1, userData?.adjective2]);

  const handleShareAnimaCode = async () => {
    if (isSharing) return;
    if (!userData?.characterId || !userData?.adjective1 || !userData?.adjective2) {
      Alert.alert('공유할 수 없습니다.', '애니마코드 결과(동물/성향)가 아직 생성되지 않았습니다.');
      return;
    }

    if (!currentDispositionDescription) {
      Alert.alert('공유할 수 없습니다.', '성향 설명을 만들 수 없습니다.');
      return;
    }

    const SHARE_BASE_URL =
      'https://asia-northeast3-today-balance-fa0a5.cloudfunctions.net/animacodeSharePage';

    setIsSharing(true);
    try {
      const characters = require('../../assets/data/characters_19.json');
      const character = characters.find((c: any) => c.character_id === userData.characterId);
      const characterName = character?.name ? String(character.name) : String(userData.characterId);

      const characterImages: Record<string, any> = {
        fox: require('../../assets/images/fox.png'),
        lion: require('../../assets/images/lion.png'),
        owl: require('../../assets/images/owl.png'),
        dolphin: require('../../assets/images/dolphin.png'),
        cat: require('../../assets/images/cat.png'),
        dog: require('../../assets/images/dog.png'),
        panda: require('../../assets/images/panda.png'),
        giraffe: require('../../assets/images/giraffe.png'),
        deer: require('../../assets/images/deer.png'),
        polar_bear: require('../../assets/images/polar_bear.png'),
        rabbit: require('../../assets/images/rabbit.png'),
        horse: require('../../assets/images/horse.png'),
        otter: require('../../assets/images/otter.png'),
        leopard: require('../../assets/images/leopard.png'),
        camel: require('../../assets/images/camel.png'),
        meerkat: require('../../assets/images/meerkat.png'),
        sheep: require('../../assets/images/sheep.png'),
        tiger: require('../../assets/images/tiger.png'),
      };

      // 이미지 base64는 공유 순간 앱에서만 계산해서 저장합니다.
      // 웹에서는 재계산하지 않고 snapshot에 저장된 base64만 렌더링합니다.
      let characterImageBase64 = '';
      const charKey = String(userData.characterId || '');
      const imageModule = characterImages[charKey];
      if (imageModule) {
        const asset = Asset.fromModule(imageModule);
        // static require 이미지라도 안전하게 download 호출(이미 로컬이면 빠르게 끝납니다)
        await asset.downloadAsync();
        const resolved = RNImage.resolveAssetSource(imageModule as any);
        const resolvedUri = resolved?.uri;
        const localUri = asset.localUri || asset.uri || resolvedUri;
        if (localUri) {
          const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          characterImageBase64 = base64 || '';
        }
      }

      // UID 등 민감 데이터는 저장하지 않고, 필요한 결과만 스냅샷으로 저장합니다.
      const snapRef = firestore().collection('animacode_snapshots').doc();
      await snapRef.set({
        isPublic: true,
        snapshotVersion: 1,
        createdAt: firestore.FieldValue.serverTimestamp(),
        characterId: String(userData.characterId),
        characterName,
        characterImageBase64,
        adjective1: String(userData.adjective1),
        adjective2: String(userData.adjective2),
        previousAdjective1: userData.previousAdjective1 ? String(userData.previousAdjective1) : '',
        previousAdjective2: userData.previousAdjective2 ? String(userData.previousAdjective2) : '',
        dispositionDescription: String(currentDispositionDescription),
      });

      const snapshotId = snapRef.id;
      const shareUrl = `${SHARE_BASE_URL}?snapshotId=${encodeURIComponent(snapshotId)}`;

      // 클립보드 복사는 보조 기능이므로 실패해도 공유 자체는 계속 진행합니다.
      try {
        if (Clipboard && typeof Clipboard.setString === 'function') {
          Clipboard.setString(shareUrl);
        }
      } catch (clipboardError) {
        console.warn('[AnimaCode][Share] 클립보드 복사 실패:', clipboardError);
      }

      await Share.share({ message: shareUrl });

      Alert.alert('공유 링크 생성 완료', '공유 페이지 링크가 복사되었습니다.');
    } catch (e: any) {
      console.error('[AnimaCode][Share] 스냅샷 저장/공유 실패:', e?.message || e);
      Alert.alert('공유에 실패했습니다.', '잠시 후 다시 시도해주세요.');
    } finally {
      setIsSharing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!user?.uid) return;
      (async () => {
        try {
          const data = await ensureUser(user.uid);
          setUserData(data);
        } catch (e) {
          console.warn('[AnimaCode] 화면 포커스 시 사용자 데이터 갱신 실패:', e);
        }
      })();
    }, [user?.uid])
  );

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
                  내 진짜 성향 애니마코드가 깨어나는 중{'\n'}
                  애니마코드 탄생까지{' '}
                    <Text style={styles.highlight}>{remainingForAnima}번의 선택</Text>
                    이 남았습니다.
                  </Text>
                </View>
              )}

              {/* 성향 변화 / 성향 설명 — 캐릭터 카드( CharacterCard ) 아래에만 추가. 카드 컴포넌트는 변경 없음 */}
              {userData.characterId && userData.adjective1 && userData.adjective2 && (
                <>
                  {userData.previousAdjective1 && userData.previousAdjective2 && (
                    <View style={styles.dispositionSection}>
                      <View style={styles.dispositionSectionHeader}>
                        <View style={styles.dispositionIconBox}>
                          <Ionicons name="sync" size={18} color="#fff" />
                        </View>
                        <Text style={styles.dispositionSectionTitle}>성향 변화</Text>
                      </View>
                      <View style={styles.dispositionCard}>
                        <Text style={styles.dispositionCardLabel}>지난번 성향 → 현재 성향</Text>
                        <View style={styles.dispositionChangeRow}>
                          <Text style={styles.dispositionPrevText} numberOfLines={2}>
                            {`${userData.previousAdjective1} ${userData.previousAdjective2}`}
                          </Text>
                          <Text style={styles.dispositionArrow}>→</Text>
                          <Text style={styles.dispositionCurrText} numberOfLines={2}>
                            {`${userData.adjective1} ${userData.adjective2}`}
                          </Text>
                        </View>
                        <Text style={styles.dispositionFootnote}>
                          캐릭터는 그대로, 성향은 선택에 따라 계속 변화해요!
                        </Text>
                      </View>
                    </View>
                  )}

                  <View
                    style={[
                      styles.dispositionSection,
                      userData.previousAdjective1 && userData.previousAdjective2
                        ? { marginTop: 4 }
                        : null,
                    ]}
                  >
                    <View style={styles.dispositionSectionHeader}>
                      <View style={[styles.dispositionIconBox, { backgroundColor: '#FF6699' }]}>
                        <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                      </View>
                      <Text style={styles.dispositionSectionTitle}>요즘 나의 성향</Text>
                    </View>
                    <View style={styles.dispositionCard}>
                      <Text style={styles.dispositionCardLabel}>요즘 나의 내면은 이런 모습이에요</Text>
                      <Text style={styles.dispositionDescriptionText}>{currentDispositionDescription}</Text>
                    </View>
                  </View>
                </>
              )}

              {/* 공유 버튼: 결과 스냅샷을 저장하고, 공유 페이지 링크를 생성합니다. */}
              {userData.characterId && userData.adjective1 && userData.adjective2 && (
                <View style={styles.shareRow}>
                  <TouchableOpacity
                    style={[styles.shareButton, isSharing ? { opacity: 0.7 } : null]}
                    onPress={handleShareAnimaCode}
                    disabled={isSharing}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="share-social" size={18} color="#fff" />
                    <Text style={styles.shareButtonText}>{isSharing ? '공유 생성 중...' : '공유하기'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.shareSubText}>나를 잘 아는 친구도 이 애니마코드에 공감할까요?</Text>
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
            애니마코드는{'\n'}
            내 선택으로 완성되는 내면 성향 캐릭터예요.{'\n'}
            매일 나의 선택을 분석해 나만의 캐릭터로 완성돼요.{'\n'}
            고정된 결과가 아니라 선택을 더할수록 선명해지는 나의 기록이에요.
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
              캐릭터 카드와 성향 키워드를 확인하세요
              </Text>
            </View>
          </View>
        </View>

        {/* 형용사 갱신 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sync" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>성향 키워드 변화</Text>
          </View>
          <Text style={styles.description}>
          30번의 선택마다 나를 보여주는 성향 키워드가 바뀌어요.{'\n'}
            <Text style={styles.highlight}>처음 완성된 캐릭터를 바탕으로 </Text>
             나의 성향이 어떻게 달라지는지도 확인해보세요.
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
              <Text style={styles.featureTitle}>성향 키워드</Text>
              <Text style={styles.featureDescription}>
                나의 선택 패턴을 분석한 성향 키워드 2개가 표시됩니다
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Ionicons name="trending-up" size={20} color={colors.primary} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>진화 시스템</Text>
              <Text style={styles.featureDescription}>
                계속해서 답변하면 성향 키워드가 업데이트되어 성장하는 모습을 볼 수 있습니다
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
              • 매일 꾸준히 답할수록 더 빠르게 애니마코드를 만날 수 있어요{'\n\n'}
              • 억지로 고르기보다 진짜 내 생각대로 선택하는 게 중요해요{'\n\n'}
              • 캐릭터는 나를 보여주는 시작점이고, 성향 키워드는 계속 달라질 수 있어요
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
            <Text style={styles.faqQuestion}>Q. 캐릭터는 몇 가지인가요?</Text>
            <Text style={styles.faqAnswer}>
              A. 다양한 애니마코드가 준비되어 있어요.
              내가 어떤 선택을 자주 하는지에 따라 다른 캐릭터가 완성돼요.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Q. 성향 키워드는 어떻게 바뀌나요?</Text>
            <Text style={styles.faqAnswer}>
              A. 30번의 선택마다 나를 더 잘 표현하는 키워드로 업데이트돼요.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Q. 캐릭터는 바뀌나요?</Text>
            <Text style={styles.faqAnswer}>
              A. 처음 완성된 캐릭터는 유지되고,
              그 이후에는 성향 키워드가 달라지며 변화하는 나를 보여줘요.
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
  dispositionSection: {
    width: '100%',
    marginBottom: 16,
  },
  dispositionSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  dispositionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispositionSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  dispositionCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dispositionCardLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 10,
    fontWeight: '600',
  },
  dispositionChangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  dispositionPrevText: {
    fontSize: 15,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
    flexShrink: 1,
  },
  dispositionArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  dispositionCurrText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  dispositionFootnote: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textLight,
  },
  dispositionDescriptionText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
  },
  shareRow: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  shareSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#94a3b8',
    width: '100%',
    paddingHorizontal: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
});
