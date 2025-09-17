import { Stack } from 'expo-router';
import NotificationBootstrap from './components/NotificationBootstrap';

export default function RootLayout() {
  return (
    <>
      <NotificationBootstrap />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}

