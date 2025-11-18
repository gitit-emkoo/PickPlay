import React from 'react';
import { Text, View } from 'react-native';
import colors from '../../src/styles/colors';

interface ErrorScreenProps {
  title?: string;
  subtitle?: string;
}

export default function ErrorScreen({ 
  title = '오늘의 질문이 없습니다', 
  subtitle = '잠시 후 다시 시도해주세요' 
}: ErrorScreenProps) {
  return (
    <View style={{flex:1, backgroundColor: colors.background, alignItems:'center', justifyContent:'center'}}>
      <View style={{alignItems: 'center', padding: 20}}>
        <Text style={{fontSize: 18, color: colors.textSecondary, textAlign: 'center'}}>{title}</Text>
        <Text style={{fontSize: 14, color: colors.textLight, textAlign: 'center', marginTop: 8}}>{subtitle}</Text>
      </View>
    </View>
  );
}


