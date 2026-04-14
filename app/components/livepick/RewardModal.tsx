import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import LottieView from 'lottie-react-native';
import colors from '../../../src/styles/colors';

interface RewardModalProps {
  visible: boolean;
  points: number;
  isLadderReward?: boolean; // 사다리 게임 보상인지
  onClose: () => void;
}

export default function RewardModal({
  visible,
  points,
  isLadderReward = false,
  onClose,
}: RewardModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // iOS: 광고/다른 Modal 직후에 보상 Modal이 안 보이거나 터치가 막히는 경우 완화
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* 애니메이션 */}
          <View style={styles.animationContainer}>
            <LottieView
              source={{ uri: 'https://lottie.host/c691c7ab-e2e2-4a77-a50e-cef6c130dce1/GjbXQZOTda.lottie' }}
              autoPlay
              loop={false}
              style={styles.animation}
            />
          </View>

          {/* 제목 */}
          <Text style={styles.title}>
            {isLadderReward ? '🎉 사다리 게임 성공!' : '보상 획득!'}
          </Text>

          {/* 포인트 표시 */}
          <View style={styles.pointsContainer}>
            <Text style={styles.pointsLabel}>획득한 포인트</Text>
            <Text style={styles.pointsAmount}>{points}P</Text>
          </View>

          {/* 안내 메시지 */}
          <Text style={styles.message}>
            {isLadderReward
              ? '축하합니다! 추가 포인트를 획득했어요!'
              : '포인트가 정상적으로 적립되었습니다.'}
          </Text>

          {/* 확인 버튼 */}
          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>확인</Text>
          </TouchableOpacity>
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
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    width: '88%',
    maxWidth: 420,
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  animationContainer: {
    width: 150,
    height: 150,
    marginBottom: 24,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  pointsContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pointsLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  pointsAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
});

