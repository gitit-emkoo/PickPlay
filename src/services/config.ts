import { getDb } from './firebase';

export interface AppVersionConfig {
  currentVersion: string;
  minRequiredVersion: string;
  forceUpdate: boolean;
  updateMessage: string;
}

export interface ServiceStatusConfig {
  status: 'normal' | 'maintenance';
  title: string;
  message: string;
  linkText?: string;
  linkUrl?: string;
}

/**
 * Firestore에서 앱 버전 설정을 조회합니다
 */
export async function getAppVersionConfig(): Promise<AppVersionConfig | null> {
  try {
    const doc = await getDb().collection('config').doc('appVersion').get();
    
    if (!doc.exists) {
      console.warn('[Config] appVersion 문서가 존재하지 않습니다.');
      return null;
    }
    
    const data = doc.data();
    if (!data) {
      console.warn('[Config] appVersion 문서 데이터가 없습니다.');
      return null;
    }
    
    return {
      currentVersion: data.currentVersion || '0.0.0',
      minRequiredVersion: data.minRequiredVersion || '0.0.0',
      forceUpdate: data.forceUpdate === true,
      updateMessage: data.updateMessage || '새로운 버전이 출시되었습니다. 업데이트해주세요.',
    };
  } catch (error) {
    console.error('[Config] appVersion 조회 실패:', error);
    return null;
  }
}

/**
 * Firestore에서 서비스 상태를 조회합니다
 */
export async function getServiceStatusConfig(): Promise<ServiceStatusConfig | null> {
  try {
    const doc = await getDb().collection('config').doc('serviceStatus').get();
    
    if (!doc.exists) {
      console.log('[Config] serviceStatus 문서가 존재하지 않습니다. 정상 상태로 간주합니다.');
      return {
        status: 'normal',
        title: '',
        message: '',
      };
    }
    
    const data = doc.data();
    if (!data) {
      console.log('[Config] serviceStatus 문서 데이터가 없습니다. 정상 상태로 간주합니다.');
      return {
        status: 'normal',
        title: '',
        message: '',
      };
    }
    
    return {
      status: data.status === 'maintenance' ? 'maintenance' : 'normal',
      title: data.title || '서비스 점검 안내',
      message: data.message || '서비스 점검 중입니다.',
      linkText: data.linkText,
      linkUrl: data.linkUrl,
    };
  } catch (error) {
    console.error('[Config] serviceStatus 조회 실패:', error);
    // 에러 발생 시 정상 상태로 간주
    return {
      status: 'normal',
      title: '',
      message: '',
    };
  }
}

