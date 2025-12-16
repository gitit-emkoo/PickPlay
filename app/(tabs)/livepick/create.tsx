import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../src/styles/colors';
import { watchAuth } from '../../../src/services/firebase';
import { createLivePickQuestion } from '../../../src/services/livepick';

export default function CreateQuestionScreen() {
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [title, setTitle] = useState('');
  const [option1, setOption1] = useState('');
  const [option2, setOption2] = useState('');
  const [category, setCategory] = useState<'일상' | '연애' | '가치관' | '엔터테인먼트' | '상상'>('일상');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const CATEGORIES: Array<'일상' | '연애' | '가치관' | '엔터테인먼트' | '상상'> = ['일상', '연애', '가치관', '엔터테인먼트', '상상'];
  
  const MAX_TITLE_LENGTH = 40;
  const MAX_OPTION_LENGTH = 20;

  // 사용자 인증 확인
  useEffect(() => {
    const unsubscribe = watchAuth((user) => {
      setUser(user);
    });
    return unsubscribe;
  }, []);

  // 포인트 소멸 확인 모달 표시
  const handleSubmitPress = () => {
    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    if (!title.trim() || !option1.trim() || !option2.trim() || !category) {
      Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
      return;
    }

    if (title.length > MAX_TITLE_LENGTH || option1.length > MAX_OPTION_LENGTH || option2.length > MAX_OPTION_LENGTH) {
      Alert.alert('입력 오류', '글자 수 제한을 초과했습니다.');
      return;
    }

    setShowConfirmModal(true);
  };

  // 질문 등록 확인
  const handleConfirmSubmit = async () => {
    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    setShowConfirmModal(false);
    setIsSubmitting(true);

    try {
      // Firebase에 질문 생성 (포인트 차감 포함)
      const questionId = await createLivePickQuestion(
        user.uid,
        title.trim(),
        option1.trim(),
        option2.trim(),
        category
      );

      console.log('✅ 질문 생성 성공:', questionId);

      // 성공적으로 등록되었으므로 입력값 초기화
      setTitle('');
      setOption1('');
      setOption2('');
      setCategory('일상');

      Alert.alert('성공', '질문이 등록되었습니다!', [
        {
          text: '확인',
          onPress: () => {
            // 질문 상세 화면으로 이동
            router.replace(`/(tabs)/livepick/${questionId}`);
          },
        },
      ]);
    } catch (error: any) {
      console.error('❌ 질문 등록 실패:', error);
      
      // 에러 메시지에 따라 다른 안내 표시
      const errorMessage = error?.message || '질문 등록에 실패했습니다.';
      if (errorMessage.includes('포인트가 부족')) {
        Alert.alert('포인트 부족', '질문을 등록하려면 10P 이상 필요합니다.');
      } else {
        Alert.alert('오류', errorMessage + '\n다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>질문 만들기</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* 상단 안내 문구 */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            질문을 만들고 다른 유저들의 선택을 받아보세요!
          </Text>
        </View>

        {/* 카테고리 선택 */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>카테고리</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.dropdownButtonText}>{category}</Text>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 질문 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>질문 내용</Text>
          <TextInput
            style={[
              styles.textInput,
              title.length > MAX_TITLE_LENGTH && styles.textInputError
            ]}
            placeholder="예: 오늘 저녁 뭐 먹을까?"
            placeholderTextColor={colors.textLight}
            value={title}
            onChangeText={setTitle}
            multiline
            maxLength={MAX_TITLE_LENGTH}
          />
          <Text style={[
            styles.helperText,
            title.length > MAX_TITLE_LENGTH && styles.helperTextError
          ]}>
            {title.length > MAX_TITLE_LENGTH ? `글자 수 초과 (최대 ${MAX_TITLE_LENGTH}자)` : `${title.length}/${MAX_TITLE_LENGTH}`}
          </Text>
        </View>

        {/* 선택지 1 */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>선택지 1</Text>
          <TextInput
            style={[
              styles.textInput,
              option1.length > MAX_OPTION_LENGTH && styles.textInputError
            ]}
            placeholder="예: 파스타"
            placeholderTextColor={colors.textLight}
            value={option1}
            onChangeText={setOption1}
            maxLength={MAX_OPTION_LENGTH}
          />
          <Text style={[
            styles.helperText,
            option1.length > MAX_OPTION_LENGTH && styles.helperTextError
          ]}>
            {option1.length > MAX_OPTION_LENGTH ? `글자 수 초과 (최대 ${MAX_OPTION_LENGTH}자)` : `${option1.length}/${MAX_OPTION_LENGTH}`}
          </Text>
        </View>

        {/* 선택지 2 */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>선택지 2</Text>
          <TextInput
            style={[
              styles.textInput,
              option2.length > MAX_OPTION_LENGTH && styles.textInputError
            ]}
            placeholder="예: 치킨"
            placeholderTextColor={colors.textLight}
            value={option2}
            onChangeText={setOption2}
            maxLength={MAX_OPTION_LENGTH}
          />
          <Text style={[
            styles.helperText,
            option2.length > MAX_OPTION_LENGTH && styles.helperTextError
          ]}>
            {option2.length > MAX_OPTION_LENGTH ? `글자 수 초과 (최대 ${MAX_OPTION_LENGTH}자)` : `${option2.length}/${MAX_OPTION_LENGTH}`}
          </Text>
        </View>

        {/* 포인트 소멸 안내 */}
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={20} color={colors.warning} />
          <Text style={styles.warningText}>
            질문을 등록하면 <Text style={styles.warningHighlight}>10P가 소멸</Text>됩니다.
          </Text>
        </View>

        {/* 업로드 버튼 */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!title.trim() || !option1.trim() || !option2.trim() || !category || 
             title.length > MAX_TITLE_LENGTH || option1.length > MAX_OPTION_LENGTH || option2.length > MAX_OPTION_LENGTH || 
             isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitPress}
          disabled={!title.trim() || !option1.trim() || !option2.trim() || !category || 
                   title.length > MAX_TITLE_LENGTH || option1.length > MAX_OPTION_LENGTH || option2.length > MAX_OPTION_LENGTH || 
                   isSubmitting}
          activeOpacity={0.7}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? '등록 중...' : '질문 업로드하기'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 카테고리 선택 모달 */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModalContent}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>카테고리 선택</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryModalItem,
                  category === cat && styles.categoryModalItemSelected,
                ]}
                onPress={() => {
                  setCategory(cat);
                  setShowCategoryModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryModalItemText,
                    category === cat && styles.categoryModalItemTextSelected,
                  ]}
                >
                  {cat}
                </Text>
                {category === cat && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* 포인트 소멸 확인 모달 */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={48} color={colors.warning} />
            </View>
            <Text style={styles.modalTitle}>포인트 소멸 안내</Text>
            <Text style={styles.modalMessage}>
              질문을 등록하면 <Text style={styles.modalHighlight}>10P가 소멸</Text>됩니다.{'\n'}
              계속하시겠어요?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonTextCancel}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleConfirmSubmit}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonTextConfirm}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 30,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  infoBanner: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  infoBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 24,
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
  },
  helperText: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'right',
    marginTop: 4,
  },
  helperTextError: {
    color: colors.error || '#e53e3e',
    fontWeight: '600',
  },
  textInputError: {
    borderColor: colors.error || '#e53e3e',
    borderWidth: 2,
  },
  dropdownButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFE4B5',
  },
  warningText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  warningHighlight: {
    fontWeight: '700',
    color: colors.warning,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textLight,
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalHighlight: {
    fontWeight: '700',
    color: colors.warning,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonConfirm: {
    backgroundColor: colors.primary,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  categoryModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  categoryModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryModalItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: colors.primary,
  },
  categoryModalItemText: {
    fontSize: 16,
    color: colors.text,
  },
  categoryModalItemTextSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
});

