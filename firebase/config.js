// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration (웹 전용 설정)
const firebaseConfig = {
  apiKey: "AIzaSyD_ISTajF7Z8QRauADMAn9EfeCSfQ1z_XM",
  authDomain: "today-balance-fa0a5.firebaseapp.com",
  projectId: "today-balance-fa0a5",
  storageBucket: "today-balance-fa0a5.firebasestorage.app",
  messagingSenderId: "981215713715",
  appId: "1:981215713715:web:7fc31c46ceb63fc19c53c6",
  measurementId: "G-HY604P5WG3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);

// Firestore 초기화 (클라이언트는 항상 default 데이터베이스 사용)
export const db = getFirestore(app);

// 데이터베이스 설정
db.settings({ 
  ignoreUndefinedProperties: true 
});

export default app;
