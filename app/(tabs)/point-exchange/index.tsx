import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, RefreshControl, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../src/styles/colors';
import { watchAuth } from '../../../src/services/firebase';
import { ensureUser } from '../../../src/services/store';
import { UserData, RewardItem } from '../../../src/types';
import { getActiveRewardItems, createExchangeRequest } from '../../../src/services/rewardStore';
import { isPhoneVerified } from '../../../src/services/userProfile';

export default function PointExchangeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rewardItems, setRewardItems] = useState<RewardItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RewardItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubscribe = watchAuth(async (user) => {
      setUser(user);
      if (user) {
        try {
          const data = await ensureUser(user.uid);
          setUserData(data);
          const verified = await isPhoneVerified();
          setPhoneVerified(verified);
        } catch (error) {
          console.error('[PointExchange] 사용자 데이터 로드 실패:', error);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setItemsLoading(true);
      const items = await getActiveRewardItems();
      setRewardItems(items);
    } catch (error) {
      console.error('[PointExchange] 상품 목록 로드 실패:', error);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  // 포인트 교환소 화면에 들어올 때마다 상품 목록 다시 불러오기 (관리자에서 등록한 상품 바로 반영)
  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const handleExchangePress = async (item: RewardItem) => {
    if (!user || !userData) return;

    setSelectedItem(item);

    if (!phoneVerified) {
      setShowAuthModal(true);
    } else {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmExchange = async () => {
    if (!selectedItem || !user || !userData || isProcessing) return;

    if (userData.points < selectedItem.requiredPoints) {
      Alert.alert('알림', `포인트가 부족합니다.\n(보유: ${userData.points}P, 필요: ${selectedItem.requiredPoints}P)`);
      setShowConfirmModal(false);
      return;
    }

    try {
      setIsProcessing(true);
      await createExchangeRequest(selectedItem);
      
      setShowConfirmModal(false);
      Alert.alert(
        '교환 신청 완료',
        `${selectedItem.title} 교환 신청이 완료되었습니다.\n교환 내역에서 확인하실 수 있습니다.`,
        [{ text: '확인' }]
      );

      const refreshedData = await ensureUser(user.uid);
      setUserData(refreshedData);
    } catch (error: any) {
      console.error('[PointExchange] 교환 신청 실패:', error);
      Alert.alert('알림', error.message || '교환 신청에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>포인트 교환소</Text>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>포인트 교환소</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={itemsLoading} onRefresh={loadItems} colors={[colors.primary]} />
        }
      >
        {userData && (
          <View style={styles.topSection}>
            <Text style={styles.nickname}>{userData.nickname}</Text>
            <View style={styles.pointsContainer}>
              <Ionicons name="diamond" size={32} color={colors.primary} />
              <Text style={styles.points}>{userData.points}P</Text>
            </View>
            <TouchableOpacity
              style={styles.historyButton}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/point-exchange/history')}
            >
              <Text style={styles.historyButtonText}>교환 내역 보기</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>교환 가능한 상품</Text>
          {itemsLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : rewardItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="gift-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>현재 교환 가능한 상품이 없습니다.</Text>
            </View>
          ) : (
            rewardItems.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                {item.imageUrl?.trim() ? (
                  <Image
                    source={{ uri: item.imageUrl.trim() }}
                    style={styles.itemImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                    <Ionicons name="gift-outline" size={28} color={colors.textLight} />
                  </View>
                )}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.description ? (
                    <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
                  ) : null}
                  <View style={styles.itemPoints}>
                    <Ionicons name="diamond" size={16} color={colors.primary} />
                    <Text style={styles.itemPointsText}>{item.requiredPoints}P</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.exchangeButton,
                    userData && userData.points < item.requiredPoints && styles.exchangeButtonDisabled,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleExchangePress(item)}
                  disabled={!userData || userData.points < item.requiredPoints}
                >
                  <Text
                    style={[
                      styles.exchangeButtonText,
                      userData && userData.points < item.requiredPoints && styles.exchangeButtonTextDisabled,
                    ]}
                  >
                    교환하기
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 전화번호 인증 필요 모달 */}
      <Modal
        visible={showAuthModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAuthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="shield-checkmark" size={48} color={colors.primary} style={{ marginBottom: 16 }} />
            <Text style={styles.modalTitle}>전화번호 인증이 필요해요</Text>
            <Text style={styles.modalBody}>
              안전한 보상 교환을 위해{'\n'}전화번호 인증이 필요합니다.
            </Text>
            <Text style={styles.modalSubtext}>
              인증 후 기존 포인트와 기록은{'\n'}그대로 유지됩니다.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowAuthModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={() => {
                  setShowAuthModal(false);
                  router.push('/(tabs)/auth/phone-verify');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalConfirmText}>인증하러 가기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 포인트 차감 확인 모달 */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isProcessing && setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="card" size={48} color={colors.primary} style={{ marginBottom: 16 }} />
            <Text style={styles.modalTitle}>교환하시겠습니까?</Text>
            {selectedItem && userData && (
              <>
                <View style={styles.confirmInfo}>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>상품</Text>
                    <Text style={styles.confirmValue}>{selectedItem.title}</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>사용 포인트</Text>
                    <Text style={styles.confirmValue}>{selectedItem.requiredPoints}P</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>현재 보유</Text>
                    <Text style={styles.confirmValue}>{userData.points}P</Text>
                  </View>
                  <View style={[styles.confirmRow, styles.confirmRowHighlight]}>
                    <Text style={styles.confirmLabel}>차감 후</Text>
                    <Text style={[styles.confirmValue, styles.confirmValueHighlight]}>
                      {userData.points - selectedItem.requiredPoints}P
                    </Text>
                  </View>
                </View>
              </>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.7}
                disabled={isProcessing}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleConfirmExchange}
                activeOpacity={0.7}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalConfirmText}>확인하고 교환하기</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  topSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  nickname: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  points: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  itemsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: colors.border,
  },
  itemImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  itemPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemPointsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  exchangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  exchangeButtonDisabled: {
    backgroundColor: colors.border,
  },
  exchangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  exchangeButtonTextDisabled: {
    color: colors.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  modalSubtext: {
    fontSize: 13,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  confirmInfo: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmRowHighlight: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 0,
  },
  confirmLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  confirmValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  confirmValueHighlight: {
    fontSize: 16,
    color: colors.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalConfirmButton: {
    backgroundColor: colors.primary,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
});
