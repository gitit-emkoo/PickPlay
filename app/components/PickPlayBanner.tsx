import React from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import colors from '../../src/styles/colors';

interface PickPlayBannerProps {
  style?: any;
}

const PICKPLAY_WEBSITE_URL = 'https://pickplay.waveon.me/';

export default function PickPlayBanner({ style }: PickPlayBannerProps) {
  const handlePress = async () => {
    try {
      const canOpen = await Linking.canOpenURL(PICKPLAY_WEBSITE_URL);
      if (canOpen) {
        await Linking.openURL(PICKPLAY_WEBSITE_URL);
        console.log('[PickPlayBanner] 웹사이트 열기 성공:', PICKPLAY_WEBSITE_URL);
      } else {
        console.error('[PickPlayBanner] URL을 열 수 없습니다:', PICKPLAY_WEBSITE_URL);
      }
    } catch (error) {
      console.error('[PickPlayBanner] 웹사이트 열기 실패:', error);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.container, style]}
      activeOpacity={0.8}
      onPress={handlePress}
    >
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/notification-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Play</Text>
          <Text style={styles.subtitle}>나를 위한 루틴 만들기</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 50,
    width: '100%',
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  logo: {
    width: 50,
    height: 45,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.9,
  },
});

