import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useIsDarkTheme } from '@/theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_GAP = 8;
const ACTIVE = '#BF8775';
const ITEMS: { route: string; label: string; icon: IconName }[] = [
  { route: 'index', label: 'Home', icon: 'home-outline' },
  { route: 'letters', label: 'Letters', icon: 'mail-outline' },
  { route: 'playlist', label: 'Playlist', icon: 'musical-notes-outline' },
  { route: 'memories', label: 'Memories', icon: 'images-outline' },
  { route: 'me', label: 'Me', icon: 'person-outline' },
];

/** Fixed five-item navigation bar; chat remains a floating Home action. */
export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkTheme();
  const inactive = isDark ? '#B9A99D' : '#9F8D83';
  const barBackground = isDark ? '#252421' : '#FFFFFF';
  const border = isDark ? '#514A43' : '#E9E2D9';
  if (state.routes[state.index]?.name === 'chat') return null;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: barBackground, borderTopColor: border }]}>
      <View style={styles.items}>
        {ITEMS.map((item) => {
          const route = state.routes.find((entry) => entry.name === item.route);
          if (!route) return null;
          const focused = state.routes[state.index]?.name === route.name;
          const title = descriptors[route.key].options.title ?? item.label;
          return (
            <SmoothPressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={title}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={styles.item}
            >
              <Ionicons name={item.icon} size={22} color={focused ? ACTIVE : inactive} />
              <Text style={[styles.label, { color: focused ? ACTIVE : inactive }]}>
                {item.label}
              </Text>
            </SmoothPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E9E2D9',
    paddingTop: 8,
    shadowColor: '#483B37',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  items: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  item: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 10, fontWeight: '500' },
});
