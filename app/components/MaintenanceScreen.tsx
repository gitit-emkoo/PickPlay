import React from 'react';
import { Image, Text, TouchableOpacity, View, StyleSheet, Linking } from 'react-native';
import colors from '../../src/styles/colors';
import * as WebBrowser from 'expo-web-browser';

interface MaintenanceScreenProps {
  title: string;
  message: string;
  linkText?: string;
  linkUrl?: string;
}

export default function MaintenanceScreen({ 
  title, 
  message, 
  linkText, 
  linkUrl 
}: MaintenanceScreenProps) {
  const handleLinkPress = async () => {
    if (linkUrl) {
      try {
        await WebBrowser.openBrowserAsync(linkUrl, { enableBarCollapsing: true });
      } catch (error) {
        console.error('[Maintenance] 링크 열기 실패:', error);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* 로고 */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/logo_pickplay.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
        </View>

        {/* 제목 */}
        <Text style={styles.title}>{title}</Text>

        {/* 메시지 */}
        <Text style={styles.message}>{message}</Text>

        {/* 링크 버튼 (옵션) */}
        {linkText && linkUrl && (
          <TouchableOpacity 
            style={styles.linkButton} 
            onPress={handleLinkPress}
            activeOpacity={0.7}
          >
            <Text style={styles.linkButtonText}>{linkText}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logo: {
    width: 160,
    height: 54,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  message: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  linkButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  linkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});

