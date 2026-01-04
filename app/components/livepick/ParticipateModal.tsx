import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../src/styles/colors';

interface ParticipateModalProps {
  visible: boolean;
  selectedOption: string; // 선택한 선택지 텍스트
  onReceive: () => void; // 10P 받기 선택
  onWatchAd: () => void; // 광고 시청 후 게임 참여 선택
  onClose?: () => void; // 모달 닫기 (선택사항)
  todayParticipationCount?: number; // 오늘 참여 횟수 (선택사항)
}

export default function ParticipateModal({
  visible,
  selectedOption,
  onReceive,
  onWatchAd,
  onClose,
  todayParticipationCount = 0,
}: ParticipateModalProps) {
  // 모달이 표시될 때는 이미 선택지를 선택한 상태
  // 하지만 아직 실제 참여 기록은 생성되지 않았으므로,
  // 현재까지의 참여 횟수만 기준으로 남은 횟수 계산
  // 예: 1번 참여했다면 남은 횟수는 3회 (4 - 1 = 3)
  const remainingCount = Math.max(0, 4 - todayParticipationCount);
  const isLastChance = remainingCount === 1;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            <Text style={styles.title}>선택 완료!</Text>
            <Text style={styles.selectedText}>"{selectedOption}" 선택</Text>
          </View>

          {/* 보상 안내 */}
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardLabel}>기본 보상</Text>
            <Text style={styles.rewardAmount}>10P</Text>
          </View>

          {/* 선택 버튼 */}
          <View style={styles.buttonContainer}>
            {/* 즉시 수령 버튼 */}
            <TouchableOpacity
              style={[styles.button, styles.receiveButton]}
              onPress={onReceive}
              activeOpacity={0.7}
            >
              <Ionicons name="cash" size={24} color="white" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonText}>즉시 받기</Text>
                <Text style={styles.buttonSubtext}>10P 즉시 지급</Text>
              </View>
            </TouchableOpacity>

            {/* 광고 시청 후 게임 버튼 */}
            <TouchableOpacity
              style={[styles.button, styles.gameButton]}
              onPress={() => {
                console.log('🔵 [ParticipateModal] "광고 보고 더 받기" 버튼 클릭됨');
                onWatchAd();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="gift" size={24} color="white" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonText}>광고 보고 더 받기</Text>
                <Text style={styles.buttonSubtext}>10P ~ 300P 획득 가능</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 일일 참여 제한 안내 */}
          {todayParticipationCount !== undefined && (
            <View style={[
              styles.participationInfo,
              isLastChance && styles.participationInfoWarning
            ]}>
              <Ionicons 
                name={remainingCount === 0 ? "alert-circle" : "time"} 
                size={16} 
                color={remainingCount === 0 ? colors.warning : colors.textSecondary} 
              />
              <Text style={[
                styles.participationInfoText,
                isLastChance && styles.participationInfoTextWarning
              ]}>
                {remainingCount === 0 
                  ? '오늘 참여 가능 횟수를 모두 사용했습니다'
                  : isLastChance
                  ? `오늘 남은 참여: ${remainingCount}회 (마지막 기회!)`
                  : `오늘 남은 참여: ${remainingCount}/4회`}
              </Text>
            </View>
          )}

          {/* 안내 텍스트 */}
          <Text style={styles.infoText}>
            💡 광고를 시청하면 사다리 게임을 통해 더 많은 포인트를 획득할 수 있어요!
          </Text>

          {/* 닫기 버튼 (선택사항) */}
          {onClose && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>나중에</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  selectedText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  rewardInfo: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.border,
  },
  rewardLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  rewardAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonTextContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  receiveButton: {
    backgroundColor: colors.primary,
  },
  gameButton: {
    backgroundColor: colors.accent,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  buttonSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  closeButtonText: {
    fontSize: 14,
    color: colors.textLight,
  },
  participationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  participationInfoWarning: {
    backgroundColor: '#FFF4E6',
    borderColor: colors.warning,
  },
  participationInfoText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  participationInfoTextWarning: {
    color: colors.warning,
    fontWeight: '700',
  },
});

