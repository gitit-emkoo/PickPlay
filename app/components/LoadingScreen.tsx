import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import colors from '../../src/styles/colors';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = '질문을 불러오는 중...' }: LoadingScreenProps) {
  return (
    <View style={{flex:1, backgroundColor: colors.background, alignItems:'center', justifyContent:'center'}}>
      <View style={{alignItems: 'center', padding: 20}}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{marginTop: 16, fontSize: 16, color: colors.textSecondary}}>{message}</Text>
      </View>
    </View>
  );
}


