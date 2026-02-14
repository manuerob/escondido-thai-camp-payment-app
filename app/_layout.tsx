import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDatabase } from '@/hooks';

export default function DrawerLayout() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  
  // Initialize database and sync
  const { isReady, isSyncing, error } = useDatabase();
  
  // Log sync status for debugging
  if (isSyncing) {
    console.log('🔄 Syncing...');
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          drawerType: 'front',
          drawerStyle: {
            width: isTablet ? 280 : 240,
          },
          headerShown: true,
          headerStyle: {
            backgroundColor: '#2563eb',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          drawerActiveTintColor: '#2563eb',
          drawerInactiveTintColor: '#666',
          drawerLabelStyle: {
            marginLeft: 8,
          },
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: 'Home',
            title: 'Thai Camp Payment',
            drawerIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="members"
          options={{
            drawerLabel: 'Members',
            title: 'Members',
            drawerIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="payments"
          options={{
            drawerLabel: 'Payments',
            title: 'Payments',
            drawerIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="card-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="expenses"
          options={{
            drawerLabel: 'Expenses',
            title: 'Expenses',
            drawerIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="receipt-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="finance"
          options={{
            drawerLabel: 'Finance',
            title: 'Finance',
            drawerIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="analytics-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="settings"
          options={{
            drawerLabel: 'Settings',
            title: 'Settings',
            drawerIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="member-detail"
          options={{
            drawerItemStyle: { display: 'none' },
            title: 'Member Details',
          }}
        />
        <Drawer.Screen
          name="(modals)"
          options={{
            drawerItemStyle: { display: 'none' },
            headerShown: false,
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
