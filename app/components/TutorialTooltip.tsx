import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../src/styles/colors';

interface TutorialTooltipProps {
  message: string;
  title?: string; // 제목 (선택)
  position?: 'top' | 'bottom' | 'left' | 'right';
  style?: any;
  width?: number; // 말풍선 너비 지정 (선택)
  color?: string; // 테두리 및 꼬리 색상 (선택, 기본값: primary)
  blink?: boolean; // 깜빡임 효과 (선택, 주황-파랑 전환)
  onDismiss?: () => void; // 말풍선이 표시될 때 호출되는 콜백 (한 번만 표시하기 위해)
}

export default function TutorialTooltip({ message, title, position = 'bottom', style, width, color, blink = false, onDismiss }: TutorialTooltipProps) {
  const themeColor = color || colors.primary;
  const blinkAnim = useRef(new Animated.Value(0)).current;

  // 말풍선이 표시될 때 onDismiss 콜백 호출 (한 번만 표시하기 위해)
  useEffect(() => {
    if (onDismiss) {
      // 약간의 딜레이를 주어 말풍선이 표시된 후 호출
      const timer = setTimeout(() => {
        onDismiss();
      }, 1000); // 1초 후 호출
      return () => clearTimeout(timer);
    }
  }, [onDismiss]);

  // 깜빡임 애니메이션 (주황-파랑 전환)
  useEffect(() => {
    if (blink) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(blinkAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [blink, blinkAnim]);

  // 깜빡임 색상 (설정한 색상 ↔ 파랑)
  const animatedColor = blink
    ? blinkAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [themeColor, colors.primary], // 설정한 색상 → 파랑
      })
    : themeColor;
  // 말풍선 꼬리 스타일 선택 (TypeScript 에러 방지)
  const getTailStyle = () => {
    const baseStyle = { borderStyle: 'solid' as const };
    switch (position) {
      case 'top':
        return { ...baseStyle, ...styles.tailTop, borderBottomColor: animatedColor };
      case 'bottom':
        return { ...baseStyle, ...styles.tailBottom, borderTopColor: animatedColor };
      case 'left':
        return { ...baseStyle, ...styles.tailLeft, borderRightColor: animatedColor };
      case 'right':
        return { ...baseStyle, ...styles.tailRight, borderLeftColor: animatedColor };
      default:
        return { ...baseStyle, ...styles.tailBottom, borderTopColor: animatedColor };
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[
        styles.tooltip, 
        width ? { maxWidth: width, minWidth: width } : {},
        { borderColor: animatedColor }
      ]}>
        <Ionicons name="chatbubble-ellipses" size={20} color={themeColor} style={styles.icon} />
        <View style={styles.textContainer}>
          {title && <Animated.Text style={[styles.title, { color: animatedColor }]}>{title}</Animated.Text>}
          <Text style={styles.text}>{message}</Text>
        </View>
      </Animated.View>
      {/* 말풍선 꼬리 */}
      <Animated.View style={[styles.tail, getTailStyle()]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  tooltip: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    maxWidth: 280,
    minWidth: 200,
  },
  icon: {
    marginRight: 8,
    marginTop: 2,
  },
  textContainer: {
    flexShrink: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  tail: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  },
  tailBottom: {
    bottom: -8,
    left: 20,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tailTop: {
    top: -8,
    left: 20,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tailLeft: {
    left: -8,
    top: 12,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  tailRight: {
    right: -8,
    top: 12,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});

