const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateQuestions() {
  try {
    console.log('🚀 질문 업데이트 시작...');
    
    const questionsRef = collection(db, 'questions');
    const snapshot = await getDocs(questionsRef);
    
    let updatedCount = 0;
    
    for (const doc of snapshot.docs) {
      const question = doc.data();
      const currentTitle = question.title;
      
      // 이미 "성향은?"이 포함되어 있으면 건너뛰기
      if (currentTitle.includes('성향은?')) {
        console.log(`⏭️ 이미 업데이트됨: ${currentTitle}`);
        continue;
      }
      
      // 새로운 제목으로 업데이트
      const newTitle = `${currentTitle}성향은?`;
      
      await updateDoc(doc.ref, {
        title: newTitle
      });
      
      console.log(`✅ 업데이트 완료: ${currentTitle} → ${newTitle}`);
      updatedCount++;
    }
    
    console.log(`🎉 총 ${updatedCount}개 질문 업데이트 완료!`);
    
  } catch (error) {
    console.error('❌ 업데이트 실패:', error);
  }
}

// 실행
updateQuestions();




