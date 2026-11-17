import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useTheme } from '@/theme';

const TERRACOTTA = '#BF8775';

export function HealingDestination({
  title,
  icon,
  showSettings = false,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  showSettings?: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.content, { backgroundColor: theme.card }]}>
        <Ionicons name={icon} size={40} color={TERRACOTTA} />
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.message, { color: theme.textSecondary }]}>This space is ready for your healing journey.</Text>
        {showSettings && (
          <SmoothPressable
            accessibilityRole="button"
            onPress={() => router.push('/settings' as Href)}
            style={[styles.button, { backgroundColor: TERRACOTTA }]}
          >
            <Ionicons name="settings-outline" size={19} color="#FFFFFF" />
            <Text style={styles.buttonLabel}>Open settings</Text>
          </SmoothPressable>
        )}
        <SmoothPressable
          accessibilityRole="button"
          onPress={() => router.replace('/' as Href)}
          style={[styles.button, styles.homeButton, { backgroundColor: theme.buttonSecondary }]}
        >
          <Ionicons name="home-outline" size={19} color={theme.text} />
          <Text style={[styles.homeLabel, { color: theme.text }]}>Back to Home</Text>
        </SmoothPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 360, alignItems: 'center', borderRadius: 24, padding: 28 },
  title: { fontFamily: 'serif', fontSize: 25, fontWeight: '700', marginTop: 12 },
  message: { textAlign: 'center', fontSize: 14, marginTop: 8 },
  button: { minHeight: 46, width: '100%', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  buttonLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  homeButton: { marginTop: 10 },
  homeLabel: { fontSize: 14, fontWeight: '600' },
});
