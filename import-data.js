const admin = require('firebase-admin');
const questions = require('./questions.json');

// Firebase Admin SDK 초기화
const serviceAccount = require('./firebase-service-account.json');

console.log('🔑 서비스 계정 정보:', {
  projectId: serviceAccount.project_id,
  clientEmail: serviceAccount.client_email,
  privateKeyLength: serviceAccount.private_key ? serviceAccount.private_key.length : 0
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'today-balance-fa0a5'
});

// Firestore 초기화 (default 데이터베이스 사용)
const db = admin.firestore();

console.log('🏗️ Firebase 앱 초기화 완료');
console.log('🔗 Firestore 참조 생성 중...');

// 데이터 입력 함수
async function importData() {
  try {
    console.log('🚀 Firestore 데이터 가져오기 시작...');
    console.log('📚 questions 컬렉션 생성 및 데이터 입력 중...');
    
    // 컬렉션이 없으면 자동으로 생성됨
    for (const q of questions) {
      try {
        await db.collection('questions').add(q);
        console.log(`✅ 추가됨: ${q.title}`);
      } catch (docError) {
        console.error(`❌ 문서 추가 실패: ${q.title}`, docError.message);
      }
    }
    
    console.log('🎉 모든 데이터 가져오기 완료!');
    console.log(`📊 총 ${questions.length}개 질문이 추가되었습니다.`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    console.error('❌ 에러 상세:', {
      code: error.code,
      message: error.message,
      details: error.details
    });
  } finally {
    process.exit(0);
  }
}

// 실행
importData();
