import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../src/styles/colors';
import type { Notice } from '../../src/types';

interface NoticeModalProps {
  visible: boolean;
  notice: Notice | null;
  onClose: () => void;
  onDontShowToday?: () => void;
}

export default function NoticeModal({ visible, notice, onClose, onDontShowToday }: NoticeModalProps) {
  const [isChecked, setIsChecked] = useState(false);
  const router = useRouter();

  // 모달이 닫힐 때 체크박스 상태 초기화
  useEffect(() => {
    if (!visible) {
      setIsChecked(false);
    }
  }, [visible]);

  if (!visible || !notice) return null;

  console.log('[NoticeModal] 렌더링:', {
    title: notice.title,
    hasImageUrl: !!notice.imageUrl,
    imageUrl: notice.imageUrl,
  });

  const handleClose = () => {
    // 체크박스가 체크되어 있으면 오늘 그만보기 실행
    if (isChecked && onDontShowToday) {
      onDontShowToday();
    }
    setIsChecked(false); // 체크박스 상태 초기화
    onClose();
  };

  const handleContentPress = async () => {
    if (!notice.deepLink) return;

    try {
      // 앱 내부 딥링크인지 확인 (pickplay://로 시작하는 경우)
      if (notice.deepLink.startsWith('pickplay://')) {
        // scheme을 제거하고 경로만 추출
        const path = notice.deepLink.replace('pickplay://', '');
        console.log('[Notice] 앱 내부 딥링크:', path);
        router.push(path as any);
        handleClose(); // 모달 닫기
      } else {
        // 외부 링크인 경우 (http://, https://)
        const canOpen = await Linking.canOpenURL(notice.deepLink);
        if (canOpen) {
          await Linking.openURL(notice.deepLink);
          console.log('[Notice] 외부 링크 열기 성공:', notice.deepLink);
          handleClose(); // 모달 닫기
        } else {
          console.warn('[Notice] 링크를 열 수 없습니다:', notice.deepLink);
        }
      }
    } catch (error) {
      console.error('[Notice] 링크 열기 실패:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.container}>
          {/* 닫기 버튼 */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          {/* 이미지 */}
          {notice.imageUrl && (
            <TouchableOpacity
              style={styles.imageContainer}
              onPress={handleContentPress}
              activeOpacity={notice.deepLink ? 0.8 : 1}
              disabled={!notice.deepLink}
            >
              <Image
                source={{ uri: notice.imageUrl }}
                style={styles.image}
                resizeMode="cover"
                onError={(error) => {
                  console.error('[NoticeModal] 이미지 로드 실패:', error.nativeEvent.error, notice.imageUrl);
                }}
                onLoad={() => {
                  console.log('[NoticeModal] 이미지 로드 성공:', notice.imageUrl);
                }}
              />
            </TouchableOpacity>
          )}

          {/* 체크박스 영역 */}
          {notice.showDontShowToday && onDontShowToday && (
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsChecked(!isChecked)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isChecked ? 'checkbox' : 'checkbox-outline'}
                  size={24}
                  color={isChecked ? colors.primary : colors.textSecondary}
                />
                <Text style={styles.checkboxLabel}>오늘 그만보기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 20,
  },
  imageContainer: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3, // 800x600 비율 유지
  },
  checkboxContainer: {
    padding: 16,
    paddingRight: 56, // 닫기 버튼과 겹치지 않도록 오른쪽 패딩 추가
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
});

