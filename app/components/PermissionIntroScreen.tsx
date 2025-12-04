import React from 'react';
import { Image, Platform, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import * as TrackingTransparency from 'expo-tracking-transparency';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../../src/styles/colors';

interface PermissionIntroScreenProps {
  onFinish: () => void;
}

export default function PermissionIntroScreen({ onFinish }: PermissionIntroScreenProps) {
  const handleNext = async () => {
    try {
      // iOS 광고 추적 권한 요청
      if (Platform.OS === 'ios') {
        try {
          await TrackingTransparency.requestTrackingPermissionsAsync();
          console.log('[Permission] 광고 추적 권한 요청 완료');
        } catch (error) {
          console.warn('[Permission] 광고 추적 권한 요청 실패:', error);
        }
      }

      // 알림 권한 요청
      try {
        await Notifications.requestPermissionsAsync();
        console.log('[Permission] 알림 권한 요청 완료');
      } catch (error) {
        console.warn('[Permission] 알림 권한 요청 실패:', error);
      }

      // 권한 안내 화면을 봤다는 플래그 저장
      await AsyncStorage.setItem('hasSeenPermissionIntro', 'true');
      
      // 완료 콜백 호출
      onFinish();
    } catch (error) {
      console.error('[Permission] 권한 요청 중 오류:', error);
      // 에러가 발생해도 진행
      await AsyncStorage.setItem('hasSeenPermissionIntro', 'true');
      onFinish();
    }
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>시작하기 전에</Text>
        <Text style={styles.subtitle}>
          보다 나은 서비스 이용을 위해{'\n'}
          동의가 필요한 내용을 확인해 주세요.
        </Text>
      </View>

      {/* 권한 안내 카드들 */}
      <View style={styles.content}>
        {/* 광고 추적 허용 */}
        <View style={styles.permissionCard}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: '#0060CD' }]}>
              <Text style={styles.iconText}>📄</Text>
            </View>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>광고 추적 허용</Text>
            <Text style={styles.cardDescription}>
              추적 허용 시 원치 않는 광고 대신{'\n'}
              관심사에 맞는 광고가 보여요.
            </Text>
          </View>
        </View>

        {/* 알림 */}
        <View style={styles.permissionCard}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: '#0060CD' }]}>
              <Text style={styles.iconText}>🔔</Text>
            </View>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>알림</Text>
            <Text style={styles.cardDescription}>
              특별 이벤트 및 중요한 소식을{'\n'}
              알려드려요.
            </Text>
          </View>
        </View>
      </View>

      {/* 다음 버튼 */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.nextButtonText}>다음</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    gap: 24,
  },
  permissionCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    marginRight: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    paddingTop: 24,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
});

