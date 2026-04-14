import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../src/styles/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="livepick"
        options={{
          title: '라이브픽',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="animacode"
        options={{
          title: '애니마코드',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="paw" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: '마이페이지',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      {/* livepick 폴더 내부 서브 화면들은 탭에서 숨김 */}
      <Tabs.Screen
        name="livepick/create"
        options={{
          href: null, // 탭에서 숨김
        }}
      />
      <Tabs.Screen
        name="livepick/[id]"
        options={{
          href: null, // 탭에서 숨김
        }}
      />
      <Tabs.Screen
        name="livepick/archive"
        options={{
          href: null, // 탭에서 숨김
        }}
      />
      <Tabs.Screen
        name="livepick/weekly-top"
        options={{
          href: null, // 탭에서 숨김
        }}
      />
      {/* point-exchange 폴더 내부 서브 화면들은 탭에서 숨김 */}
      <Tabs.Screen
        name="point-exchange/index"
        options={{
          href: null, // 탭에서 숨김
        }}
      />
      <Tabs.Screen
        name="point-exchange/history"
        options={{
          href: null, // 탭에서 숨김
        }}
      />
      {/* auth 폴더 내부 서브 화면들은 탭에서 숨김 */}
      <Tabs.Screen
        name="auth/phone-verify"
        options={{
          href: null, // 탭에서 숨김
        }}
      />
    </Tabs>
  );
}

