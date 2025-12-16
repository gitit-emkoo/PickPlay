import { Redirect } from 'expo-router';

// 루트 경로에서 탭 구조의 홈 화면으로 리다이렉트
export default function Index() {
  return <Redirect href="/(tabs)/" />;
}
