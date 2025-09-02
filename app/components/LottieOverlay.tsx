import LottieView from 'lottie-react-native';
import React from 'react';
import { Text, View } from 'react-native';
import colors from '../styles/colors';

interface LottieOverlayProps {
  visible: boolean;
  title?: string;
  lottieUrl?: string;
}

export default function LottieOverlay({ 
  visible, 
  title = '포인트 획득!💎\n내일도 PickPlay에서 선택하세요',
  lottieUrl = "https://lottie.host/c691c7ab-e2e2-4a77-a50e-cef6c130dce1/GjbXQZOTda.lottie"
}: LottieOverlayProps) {
  if (!visible) return null;

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <View style={{
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8
      }}>
        <LottieView
          source={{ uri: lottieUrl }}
          loop={false}
          autoPlay={true}
          style={{ width: 200, height: 200 }}
        />
        <Text style={{
          fontSize: 18,
          fontWeight: '700',
          color: colors.primary,
          marginTop: 16,
          textAlign: 'center'
        }}>
          {title}
        </Text>
      </View>
    </View>
  );
}


