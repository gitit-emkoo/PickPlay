import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import colors from '../../src/styles/colors';

interface ErrorScreenProps {
  title?: string;
  subtitle?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorScreen({ 
  title = '오늘의 질문이 없습니다', 
  subtitle = '잠시 후 다시 시도해주세요',
  message,
  onRetry
}: ErrorScreenProps) {
  const displayTitle = message ? '연결 오류' : title;
  const displaySubtitle = message || subtitle;
  
  return (
    <View style={{flex:1, backgroundColor: colors.background, alignItems:'center', justifyContent:'center'}}>
      <View style={{alignItems: 'center', padding: 20}}>
        <Text style={{fontSize: 18, color: colors.textSecondary, textAlign: 'center'}}>{displayTitle}</Text>
        <Text style={{fontSize: 14, color: colors.textLight, textAlign: 'center', marginTop: 8}}>{displaySubtitle}</Text>
        {onRetry && (
          <TouchableOpacity 
            onPress={onRetry}
            style={{
              marginTop: 24,
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 24
            }}
          >
            <Text style={{fontSize: 16, color: 'white', fontWeight: '600'}}>다시 시도</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}


