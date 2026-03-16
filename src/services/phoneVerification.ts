/**
 * 전화번호 인증 서비스 (Cloud Functions + 솔라피 SMS 연동)
 * - 인증번호 발송/검증은 서버(sendPhoneVerificationCode, verifyPhoneCode)에서 수행
 * - 검증 성공 시 서버가 users/{uid}에 phoneNumber, phoneVerified, phoneVerifiedAt 저장
 */

import { getFunctions } from './firebase';

const FUNCTIONS_BASE = 'https://asia-northeast3-today-balance-fa0a5.cloudfunctions.net';

export interface PhoneVerificationResult {
  success: boolean;
  errorCode?: string;
  message?: string;
}

/**
 * 전화번호로 인증번호를 발송합니다.
 * Cloud Functions가 6자리 코드 생성 후 솔라피 SMS 발송.
 *
 * @param phoneNumber E.164 포맷 전화번호 (예: +821012345678)
 */
export async function requestVerificationCode(phoneNumber: string): Promise<PhoneVerificationResult> {
  try {
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 10) {
      return {
        success: false,
        errorCode: 'INVALID_PHONE',
        message: '올바른 전화번호를 입력해주세요.',
      };
    }

    const functions = getFunctions();
    const sendCode = functions.httpsCallableFromUrl(
      `${FUNCTIONS_BASE}/sendPhoneVerificationCode`
    );
    const result = await sendCode({ phoneNumber });
    const data = result.data as { success?: boolean; message?: string };
    return {
      success: data.success === true,
      message: data.message || '인증번호가 발송되었습니다.',
    };
  } catch (error: any) {
    const code = error?.code || error?.details?.code;
    const msg = error?.message || error?.details?.message;
    console.error('[PhoneVerification] 인증번호 발송 실패:', error);
    return {
      success: false,
      errorCode: code || 'SEND_FAILED',
      message: msg || '인증번호 발송에 실패했습니다. 다시 시도해주세요.',
    };
  }
}

/**
 * 인증번호를 검증합니다.
 * 성공 시 서버에서 users/{uid}에 phoneNumber, phoneVerified, phoneVerifiedAt 저장.
 *
 * @param phoneNumber E.164 포맷 전화번호
 * @param code 사용자가 입력한 인증번호
 */
export async function verifyCode(phoneNumber: string, code: string): Promise<PhoneVerificationResult> {
  try {
    if (!phoneNumber || !code || code.length < 4) {
      return {
        success: false,
        errorCode: 'INVALID_CODE',
        message: '인증번호를 정확히 입력해주세요.',
      };
    }

    const functions = getFunctions();
    const verify = functions.httpsCallableFromUrl(
      `${FUNCTIONS_BASE}/verifyPhoneCode`
    );
    const result = await verify({ phoneNumber, code: code.trim() });
    const data = result.data as { success?: boolean; message?: string };
    return {
      success: data.success === true,
      message: data.message || '인증이 완료되었습니다.',
    };
  } catch (error: any) {
    const code = error?.code || error?.details?.code;
    const msg = error?.message || error?.details?.message;
    console.error('[PhoneVerification] 인증 실패:', error);
    return {
      success: false,
      errorCode: code || 'VERIFY_FAILED',
      message: msg || '인증에 실패했습니다. 다시 시도해주세요.',
    };
  }
}
