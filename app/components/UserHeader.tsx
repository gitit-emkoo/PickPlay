import LottieView from 'lottie-react-native';
import React from 'react';
import { Text, View } from 'react-native';
import colors from '../styles/colors';

interface UserHeaderProps {
  userData: {
    points: number;
    streakCount: number;
    nickname: string;
  };
}

export default function UserHeader({ userData }: UserHeaderProps) {
  return (
    <View style={{
      position: 'absolute',
      top: 22,
      right: 24,
      zIndex: 10,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4
    }}>
      {/* 닉네임 표시 */}
      <View style={{marginBottom: 8}}>
        <Text style={{
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center'
        }}>
          {userData.nickname}
        </Text>
      </View>
      
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
          <View style={{width: 24, height: 24}}>
            <LottieView
              source={{ uri: "https://lottie.host/c691c7ab-e2e2-4a77-a50e-cef6c130dce1/GjbXQZOTda.lottie" }}
              loop={true}
              autoPlay={true}
              style={{ width: 30, height: 30 }}
            />
          </View>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.primary
          }}>
            {userData.points}P
          </Text>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
          <View style={{width: 24, height: 24}}>
            <LottieView
              source={{ uri: "https://lottie.host/951ea34e-ef87-45ee-90f2-ac796963312f/NUCSZs3eid.lottie" }}
              loop={true}
              autoPlay={true}
              style={{ width: 24, height: 24 }}
            />
          </View>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.textSecondary
          }}>
            {userData.streakCount}일 연속
          </Text>
        </View>
      </View>
    </View>
  );
}

