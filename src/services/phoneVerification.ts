/**
 * 전화번호 인증 서비스 (Solapi 연동 준비)
 * 
 * 현재는 개발용 stub 구현.
 * 실제 Solapi API 연동 시, 이 파일의 함수들만 수정하면 됨.
 */

export interface PhoneVerificationResult {
  success: boolean;
  errorCode?: string;
  message?: string;
}

/**
 * 전화번호로 인증번호를 발송합니다.
 * 
 * TODO: Solapi API 연동
 * - Solapi 문자 발송 API 호출
 * - 또는 Cloud Functions를 통해 서버에서 발송
 * 
 * @param phoneNumber E.164 포맷 전화번호 (예: +821012345678)
 * @returns 발송 성공 여부
 */
export async function requestVerificationCode(phoneNumber: string): Promise<PhoneVerificationResult> {
  try {
    // 전화번호 형식 기본 검증
    if (!phoneNumber || phoneNumber.length < 10) {
      return {
        success: false,
        errorCode: 'INVALID_PHONE',
        message: '올바른 전화번호를 입력해주세요.',
      };
    }

    // TODO: 실제 Solapi API 연동
    // 예시:
    // const response = await fetch('https://api.solapi.com/messages/v4/send', {
    //   method: 'POST',
    //   headers: { ... },
    //   body: JSON.stringify({ to: phoneNumber, text: `인증번호: ${code}` })
    // });

    console.log('[PhoneVerification] 인증번호 발송 요청 (stub):', phoneNumber);
    
    // 개발용: 항상 성공 반환
    return {
      success: true,
      message: '인증번호가 발송되었습니다.',
    };
  } catch (error: any) {
    console.error('[PhoneVerification] 인증번호 발송 실패:', error);
    return {
      success: false,
      errorCode: 'SEND_FAILED',
      message: '인증번호 발송에 실패했습니다. 다시 시도해주세요.',
    };
  }
}

/**
 * 인증번호를 검증합니다.
 * 
 * TODO: Solapi API 연동
 * - Solapi 인증번호 검증 API 호출
 * - 또는 Cloud Functions를 통해 서버에서 검증
 * 
 * @param phoneNumber 전화번호
 * @param code 사용자가 입력한 인증번호
 * @returns 검증 성공 여부
 */
export async function verifyCode(phoneNumber: string, code: string): Promise<PhoneVerificationResult> {
  try {
    // 기본 검증
    if (!phoneNumber || !code || code.length < 4) {
      return {
        success: false,
        errorCode: 'INVALID_CODE',
        message: '인증번호를 정확히 입력해주세요.',
      };
    }

    // TODO: 실제 Solapi API 연동
    // 예시:
    // const response = await fetch('https://api.solapi.com/verify', {
    //   method: 'POST',
    //   headers: { ... },
    //   body: JSON.stringify({ phoneNumber, code })
    // });

    console.log('[PhoneVerification] 인증번호 검증 요청 (stub):', { phoneNumber, code });
    
    // 개발용: 인증번호가 "1234"이면 성공, 아니면 실패
    if (code === '1234') {
      return {
        success: true,
        message: '인증이 완료되었습니다.',
      };
    } else {
      return {
        success: false,
        errorCode: 'INVALID_CODE',
        message: '인증번호가 일치하지 않습니다.',
      };
    }
  } catch (error: any) {
    console.error('[PhoneVerification] 인증번호 검증 실패:', error);
    return {
      success: false,
      errorCode: 'VERIFY_FAILED',
      message: '인증 처리에 실패했습니다. 다시 시도해주세요.',
    };
  }
}
