import React, { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSettings } from '@/settings/SettingsContext';

const BACKGROUND_IMAGE = require('@/assets/images/yearn-welcome.jpg');

export default function OnboardingScreen() {
  const router = useRouter();
  const { update } = useSettings();
  const [isFocused, setIsFocused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      await update('onboarded', true);
      router.replace('/(tabs)' as Href);
    } catch (finishError) {
      console.warn('Unable to finish onboarding:', finishError);
      setError(finishError instanceof Error ? finishError.message : 'Unable to continue to Home.');
      setStarting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.desktopShell}>
        <ImageBackground
          source={BACKGROUND_IMAGE}
          style={styles.background}
          resizeMode="cover"
        >
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="welcomeTint" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="rgba(41, 163, 168, 0.28)" />
                <Stop offset="0.46" stopColor="rgba(24, 93, 95, 0.14)" />
                <Stop offset="1" stopColor="rgba(5, 39, 31, 0.67)" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcomeTint)" />
          </Svg>

          <View style={styles.content}>
            <View style={styles.rule} />

            <Text style={styles.kicker}>WELCOME TO</Text>

            <Text style={styles.title}>YEARN</Text>

            <View style={[styles.rule, styles.ruleBelow]} />

            <Text style={styles.tagline}>
              {'A private place to remember,'}
              {'\n'}
              {'feel, and heal.'}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get started"
              disabled={starting}
              focusable
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onPress={() => void finish()}
              style={({ pressed }) => [
                styles.button,
                {
                  opacity: starting ? 0.65 : pressed ? 0.88 : 1,
                  borderWidth: isFocused ? 2 : 0,
                  borderColor: 'rgba(242, 223, 165, 0.95)',
                },
              ]}
            >
              <Text style={styles.buttonText}>{starting ? 'Loading…' : 'Get Started'}</Text>
            </Pressable>
            {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          </View>
        </ImageBackground>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#171C1B',
  },
  desktopShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171C1B',
  },
  background: {
    width: '100%',
    height: '100%',
    maxWidth: 430,
    minHeight: 620,
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    inset: 0,
  },
  rule: {
    position: 'absolute',
    left: '50%',
    top: '12%',
    width: 124,
    height: 1,
    backgroundColor: 'rgba(242, 223, 165, 0.8)',
    transform: [{ translateX: -62 }],
  },
  ruleBelow: {
    top: '30%',
  },
  kicker: {
    position: 'absolute',
    top: '15%',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#F2DFA5',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 4,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  title: {
    position: 'absolute',
    top: '22%',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 54,
    fontWeight: '700',
    letterSpacing: 12,
    fontFamily: 'Georgia',
    lineHeight: 60,
    includeFontPadding: false,
  },
  tagline: {
    position: 'absolute',
    top: '57%',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#F2DFA5',
    fontSize: 18,
    fontStyle: 'italic',
    fontFamily: 'Georgia',
    lineHeight: 27,
  },
  button: {
    position: 'absolute',
    left: '9%',
    right: '9%',
    bottom: '7%',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#BF8775',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  error: {
    position: 'absolute',
    bottom: '2%',
    left: '9%',
    right: '9%',
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
});
