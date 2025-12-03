const admin = require('firebase-admin');
const questions = require('./assets/data/questions_final.json');

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
db.settings({ ignoreUndefinedProperties: true });

console.log('🏗️ Firebase 앱 초기화 완료');
console.log('🔗 Firestore 참조 생성 중...');

// 데이터 입력 함수
async function importData() {
  try {
    console.log('🚀 Firestore 데이터 가져오기 시작...');
    console.log('📚 questions 컬렉션 생성 및 데이터 입력 중...');
    
    // 컬렉션이 없으면 자동으로 생성됨
    let ok = 0, fail = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      try {
        // 문서 ID를 question_id로 고정해 answers rules의 exists() 검증을 통과시킵니다
        const docId = q.question_id || q.id || `Q${String(i + 1).padStart(3, '0')}`;
        if (!docId) {
          console.warn('⚠️ question_id 누락으로 스킵:', q);
          fail++;
          continue;
        }
        const text = q.text ?? q.title ?? q.question ?? '';
        const option_1_text = q.option_1_text ?? q.option1 ?? q.optionA ?? (Array.isArray(q.options) ? q.options[0] : '') ?? '';
        const option_2_text = q.option_2_text ?? q.option2 ?? q.optionB ?? (Array.isArray(q.options) ? q.options[1] : '') ?? '';
        const domain = q.domain ?? q.category ?? '감정';

        await db.collection('questions').doc(docId).set({
          question_id: docId,
          text,
          domain,
          option_1_text,
          option_2_text,
        }, { merge: true });
        ok++;
        console.log(`✅ 추가/업서트: ${docId} (${text})`);
      } catch (docError) {
        fail++;
        console.error(`❌ 문서 추가 실패(${i}):`, docError.message);
      }
    }
    
    console.log('🎉 모든 데이터 가져오기 완료!');
    console.log(`📊 성공 ${ok}건, 실패 ${fail}건 (총 ${questions.length}건)`);
    
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
