import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../src/styles/colors';
import { requestVerificationCode, verifyCode } from '../../../src/services/phoneVerification';
import { linkPhoneToCurrentUser } from '../../../src/services/userProfile';

export default function PhoneVerifyScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    return cleaned.slice(0, 11);
  };

  const handleSendCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('알림', '올바른 전화번호를 입력해주세요.');
      return;
    }

    try {
      setIsSending(true);
      const e164Phone = `+82${phoneNumber.replace(/^0/, '')}`;
      const result = await requestVerificationCode(e164Phone);

      if (result.success) {
        setCodeSent(true);
        Alert.alert('알림', result.message || '인증번호가 발송되었습니다.');
      } else {
        Alert.alert('알림', result.message || '인증번호 발송에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('[PhoneVerify] 인증번호 발송 실패:', error);
      Alert.alert('알림', '인증번호 발송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length < 4) {
      Alert.alert('알림', '인증번호를 입력해주세요.');
      return;
    }

    try {
      setIsVerifying(true);
      const e164Phone = `+82${phoneNumber.replace(/^0/, '')}`;
      
      const result = await verifyCode(e164Phone, verificationCode);

      if (result.success) {
        await linkPhoneToCurrentUser(e164Phone);
        
        Alert.alert(
          '인증 완료',
          '인증이 완료되었어요.\n이제 상품을 교환할 수 있어요.',
          [
            {
              text: '확인',
              onPress: () => router.replace('/(tabs)/point-exchange'),
            },
          ]
        );
      } else {
        Alert.alert('알림', result.message || '인증번호가 일치하지 않습니다.');
      }
    } catch (error: any) {
      console.error('[PhoneVerify] 인증 실패:', error);
      Alert.alert('알림', error.message || '인증에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>전화번호 인증</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>안전한 보상 교환을 위해{'\n'}전화번호 인증이 필요해요</Text>
        <Text style={styles.subtitle}>
          인증 후 기존 포인트와 기록은 그대로 유지됩니다.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>전화번호</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, codeSent && styles.inputDisabled]}
              placeholder="01012345678"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
              maxLength={11}
              editable={!codeSent}
            />
            <TouchableOpacity
              style={[styles.sendButton, codeSent && styles.sendButtonDisabled]}
              onPress={handleSendCode}
              activeOpacity={0.7}
              disabled={codeSent || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.sendButtonText}>
                  {codeSent ? '발송완료' : '인증번호 받기'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {codeSent && (
            <>
              <Text style={[styles.label, { marginTop: 20 }]}>인증번호</Text>
              <TextInput
                style={styles.input}
                placeholder="인증번호 입력"
                keyboardType="number-pad"
                value={verificationCode}
                onChangeText={setVerificationCode}
                maxLength={6}
              />
              <TouchableOpacity
                style={styles.verifyButton}
                onPress={handleVerify}
                activeOpacity={0.7}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.verifyButtonText}>인증하기</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.devNote}>
                💡 개발 모드: 인증번호 "1234"를 입력하세요.
              </Text>
            </>
          )}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={16} color={colors.primary} />
          <Text style={styles.infoText}>
            전화번호는 보상 교환 시 본인 확인 용도로만 사용되며, 외부에 공개되지 않습니다.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputDisabled: {
    backgroundColor: colors.background,
    color: colors.textLight,
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  verifyButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  devNote: {
    fontSize: 12,
    color: colors.accent,
    textAlign: 'center',
    marginTop: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
