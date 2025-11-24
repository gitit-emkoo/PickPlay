import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import colors from '../../src/styles/colors';

interface LoadingScreenProps {
  message?: string;
  details?: string[];
}

export default function LoadingScreen({ message = '질문을 불러오는 중...', details }: LoadingScreenProps) {
  return (
    <View style={{flex:1, backgroundColor: colors.background, alignItems:'center', justifyContent:'center', paddingHorizontal: 24}}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{marginTop: 16, fontSize: 16, color: colors.textSecondary, textAlign: 'center'}}>{message}</Text>
      {details && details.length > 0 && (
        <View style={{marginTop: 24, padding: 12, borderRadius: 12, backgroundColor: '#f4f6fb', width: '100%'}}>
          {details.map((line, idx) => (
            <Text
              key={`${line}-${idx}`}
              style={{fontSize: 12, color: colors.textLight, marginBottom: 6}}
            >
              • {line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}


