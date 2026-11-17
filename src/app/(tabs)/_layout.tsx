import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useTheme } from '@/theme';

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 64,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="letters" options={{ title: 'Letters' }} />
      <Tabs.Screen name="playlist" options={{ title: 'Playlist' }} />
      <Tabs.Screen name="memories" options={{ title: 'Memories' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          title: 'AI Chat',
          sceneStyle: {
            backgroundColor: theme.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        }}
      />
    </Tabs>
  );
}
