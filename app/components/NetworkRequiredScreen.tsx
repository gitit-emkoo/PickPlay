import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../src/styles/colors';

interface NetworkRequiredScreenProps {
  onRetry: () => void;
}

export default function NetworkRequiredScreen({ onRetry }: NetworkRequiredScreenProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline" size={80} color={colors.textSecondary} style={styles.icon} />
      <Text style={styles.title}>인터넷 연결이 필요합니다</Text>
      <Text style={styles.message}>
        픽플레이는 인터넷 연결이 필요합니다.{'\n'}
        Wi-Fi 또는 모바일 데이터에 연결해주세요.
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>다시 시도</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

