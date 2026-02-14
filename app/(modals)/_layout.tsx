import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'transparentModal',
        animation: 'slide_from_bottom',
        headerShown: false,
      }}
    >
      <Stack.Screen name="add-member" />
      <Stack.Screen name="add-expense" />
    </Stack>
  );
}
