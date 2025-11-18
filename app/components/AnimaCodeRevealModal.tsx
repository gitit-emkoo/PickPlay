import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import colors from '../../src/styles/colors';
import CharacterCard from './CharacterCard';
import { UserData } from '@/src/types';

interface AnimaCodeRevealModalProps {
  visible: boolean;
  onClose: () => void;
  userData: UserData;
  isNewCharacter: boolean; // true: 캐릭터 배정, false: 형용사 갱신
}

const AnimaCodeRevealModal: React.FC<AnimaCodeRevealModalProps> = ({
  visible,
  onClose,
  userData,
  isNewCharacter,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* 축하 애니메이션 */}
          <View style={styles.lottieContainer}>
            <LottieView
              source={{ uri: "https://lottie.host/df96f2a7-284f-4197-ba3c-5b8388c46299/ykDKnFMp3l.lottie" }}
              loop={true}
              autoPlay={true}
              speed={1}
              style={styles.lottie}
            />
          </View>

          {/* 메시지 */}
          <Text style={styles.title}>
            {isNewCharacter ? '애니마코드가 깨어났어요!' : '나의 애니마 코드에 변화가 생겼어요!'}
          </Text>

          {isNewCharacter && (
            <Text style={styles.subtitle}>
              30번의 선택을 통해 당신의 내면 캐릭터가 탄생했습니다
            </Text>
          )}

          {!isNewCharacter && (
            <Text style={styles.subtitle}>
              새로운 선택을 통해 당신의 성향이 진화했습니다
            </Text>
          )}

          {/* 캐릭터 카드 */}
          <View style={styles.characterCardContainer}>
            <CharacterCard userData={userData} />
          </View>

          {/* 확인 버튼 */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.button}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  lottieContainer: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  characterCardContainer: {
    width: '100%',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AnimaCodeRevealModal;

