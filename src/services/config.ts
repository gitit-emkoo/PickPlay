import { getDb } from './firebase';
import type { Notice } from '../types';

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

/**
 * Firestore에서 공지사항을 조회합니다
 */
export async function getNoticeConfig(): Promise<Notice | null> {
  try {
    const doc = await getDb().collection('config').doc('notice').get();
    
    if (!doc.exists) {
      console.log('[Config] notice 문서가 존재하지 않습니다.');
      return null;
    }
    
    const data = doc.data();
    if (!data) {
      console.log('[Config] notice 문서 데이터가 없습니다.');
      return null;
    }

    // 활성화되지 않은 공지사항은 null 반환
    if (!data.isActive) {
      return null;
    }
    
    const notice: Notice = {
      title: data.title || '',
      content: data.content || '',
      imageUrl: data.imageUrl,
      deepLink: data.deepLink,
      showDontShowToday: data.showDontShowToday ?? true,
      isActive: data.isActive ?? false,
      startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : undefined),
      endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined),
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
    };

    console.log('[Config] notice 데이터:', {
      title: notice.title,
      hasImageUrl: !!notice.imageUrl,
      imageUrl: notice.imageUrl,
      deepLink: notice.deepLink,
    });

    // 활성화 여부 및 게시 기간 체크
    if (!notice.isActive) {
      return null;
    }

    const now = new Date();
    
    // 시작일 체크
    if (notice.startDate) {
      const startDate = notice.startDate instanceof Date ? notice.startDate : new Date(notice.startDate as any);
      if (now < startDate) {
        console.log('[Config] notice 게시 시작일 이전');
        return null;
      }
    }

    // 종료일 체크
    if (notice.endDate) {
      const endDate = notice.endDate instanceof Date ? notice.endDate : new Date(notice.endDate as any);
      // 종료일의 하루 끝까지 (23:59:59)
      endDate.setHours(23, 59, 59, 999);
      if (now > endDate) {
        console.log('[Config] notice 게시 종료일 경과');
        return null;
      }
    }

    return notice;
  } catch (error) {
    console.error('[Config] notice 조회 실패:', error);
    return null;
  }
}

