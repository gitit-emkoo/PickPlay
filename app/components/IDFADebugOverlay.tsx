import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Settings } from 'react-native';
import * as Tracking from 'expo-tracking-transparency';

/**
 * 개발 환경에서만 표시되는 IDFA 디버그 오버레이
 * 화면 오른쪽 아래에 작은 플로팅 버튼이 표시되고,
 * 탭하면 IDFA를 확인할 수 있는 모달이 표시됩니다.
 */
export default function IDFADebugOverlay() {
  const [visible, setVisible] = useState(false);
  const [idfa, setIdfa] = useState<string | null>(null);
  const [attStatus, setAttStatus] = useState<string>('확인 중...');
  const [showFloatingButton, setShowFloatingButton] = useState(__DEV__ && Platform.OS === 'ios');

  // 개발 환경이 아니거나 iOS가 아니면 표시하지 않음
  if (!__DEV__ || Platform.OS !== 'ios') {
    return null;
  }

  const checkIDFA = async () => {
    try {
      // ATT 권한 상태 확인
      const trackingStatus = await Tracking.getTrackingPermissionsAsync();
      let statusText = '알 수 없음';
      switch (trackingStatus.status) {
        case 'granted':
          statusText = '✅ 허용됨';
          break;
        case 'denied':
          statusText = '❌ 거부됨';
          break;
        case 'restricted':
          statusText = '🚫 제한됨';
          break;
        case 'undetermined':
          statusText = '⏳ 미결정';
          break;
      }
      setAttStatus(statusText);

      // IDFA 가져오기
      const idfaFromNative = Settings.get?.('PickPlayIDFA');
      if (typeof idfaFromNative === 'string' && idfaFromNative.length > 0) {
        setIdfa(idfaFromNative === 'LIMITED_AD_TRACKING' ? '제한된 광고 추적 (0으로 고정됨)' : idfaFromNative);
      } else {
        setIdfa('IDFA를 가져올 수 없음 (네이티브 빌드 필요 또는 ATT 미허용)');
      }
    } catch (error: any) {
      setAttStatus('오류 발생');
      setIdfa(`오류: ${error?.message || '알 수 없는 오류'}`);
    }
  };

  useEffect(() => {
    // 모달이 열릴 때마다 IDFA 확인
    if (visible) {
      checkIDFA();
      // 주기적으로 다시 확인 (1초마다)
      const interval = setInterval(checkIDFA, 1000);
      return () => clearInterval(interval);
    }
  }, [visible]);

  return (
    <>
      {/* 플로팅 버튼 */}
      {showFloatingButton && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.floatingButtonText}>📱</Text>
        </TouchableOpacity>
      )}

      {/* IDFA 확인 모달 */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📱 IDFA 디버그 정보</Text>
            
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>ATT 권한 상태:</Text>
              <Text style={styles.infoValue}>{attStatus}</Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>IDFA:</Text>
              <Text style={[styles.infoValue, styles.idfaValue]} selectable>
                {idfa || '로딩 중...'}
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.refreshButton]}
                onPress={checkIDFA}
              >
                <Text style={styles.buttonText}>🔄 다시 확인</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.closeButton]}
                onPress={() => setVisible(false)}
              >
                <Text style={styles.buttonText}>닫기</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>
              💡 ATT 권한을 허용한 후에도 IDFA가 표시되지 않으면{'\n'}
              네이티브 빌드를 다시 해야 할 수 있습니다.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0060CD',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 9999,
  },
  floatingButtonText: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#0060CD',
  },
  infoSection: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  idfaValue: {
    fontSize: 12,
    wordBreak: 'break-all',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: '#0060CD',
  },
  closeButton: {
    backgroundColor: '#999',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 18,
  },
});


