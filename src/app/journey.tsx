import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, type Href } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { SmoothPressable } from '@/components/SmoothPressable';
import {
  getTodayHealingJourneyCheckIn,
  healingDay,
  saveTodayHealingJourneyCheckIn,
  type JourneyMood,
  type JourneyNeed,
} from '@/settings/storage';
import { useSettings } from '@/settings/SettingsContext';
import { useIsDarkTheme, useTheme } from '@/theme';

const MOODS: { id: JourneyMood; emoji: string; label: string }[] = [
  { id: 'good', emoji: '😊', label: 'Good' },
  { id: 'okay', emoji: '😶', label: 'Okay' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'heavy', emoji: '😔', label: 'Heavy' },
  { id: 'healing', emoji: '💚', label: 'Healing' },
];

const NEEDS: JourneyNeed[] = ['rest', 'cry', 'write', 'listen', 'distract', 'remind myself'];

export default function JourneyScreen() {
  const router = useRouter();
  const theme = useTheme();
  const isDark = useIsDarkTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const day = healingDay(settings.healingStartDate);
  const [mood, setMood] = useState<JourneyMood | null>(null);
  const [needs, setNeeds] = useState<JourneyNeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTodayHealingJourneyCheckIn()
      .then((checkIn) => {
        if (checkIn) {
          setMood(checkIn.mood);
          setNeeds(checkIn.needs);
          setSaved(true);
        }
      })
      .catch((loadError) => {
        console.warn("Unable to load today's healing check-in:", loadError);
        setError("Today's check-in could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleNeed = (need: JourneyNeed) => {
    setNeeds((current) => current.includes(need)
      ? current.filter((selected) => selected !== need)
      : [...current, need]);
    setSaved(false);
  };

  const saveCheckIn = async () => {
    if (!mood || saving) {
      if (!mood) setError('Choose how you are feeling today.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveTodayHealingJourneyCheckIn(mood, needs);
      setSaved(true);
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      router.replace('/(tabs)' as Href);
    } catch (saveError) {
      console.warn("Unable to save today's healing check-in:", saveError);
      setError("Today's check-in could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#252421' : '#FAFDFC' }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 18 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </SmoothPressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text }]}>My Healing Journey</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Not a countdown for them, but a count for you.
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.hero}>
          <FlowerIllustration />
          <Text style={[styles.day, { color: theme.text }]}>
            {day === null ? 'Your Journey' : `Day ${day}`}
          </Text>
          <Text style={[styles.daySubtitle, { color: theme.textSecondary }]}>
            {day === null
              ? 'Take it one moment at a time.'
              : 'of breathing, surviving,\nand choosing yourself.'}
          </Text>
        </View>

        <View style={[styles.quoteCard, { backgroundColor: isDark ? '#302E2A' : '#F3EEEA' }]}>
          <Text style={[styles.quote, { color: theme.text }]}>
            &quot;You are stronger than the moments that hurt you.&quot;
          </Text>
        </View>

        <View style={styles.checkInSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Today&apos;s Check-in</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            How are you feeling today?
          </Text>
          <View style={styles.moodRow}>
            {MOODS.map((option) => {
              const selected = mood === option.id;
              return (
                <SmoothPressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected }}
                  disabled={loading || saving}
                  onPress={() => {
                    setMood(option.id);
                    setSaved(false);
                    setError(null);
                  }}
                  style={[
                    styles.moodOption,
                    { backgroundColor: selected ? (isDark ? '#51433D' : '#EBD8D1') : theme.inputBackground },
                    selected && { borderColor: theme.tint, borderWidth: 1 },
                  ]}
                >
                  <Text style={styles.moodEmoji}>{option.emoji}</Text>
                  <Text style={[styles.moodLabel, { color: theme.textSecondary }]}>{option.label}</Text>
                </SmoothPressable>
              );
            })}
          </View>
        </View>

        <View style={styles.needsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>What do you need today?</Text>
          <View style={styles.needsRow}>
            {NEEDS.map((need) => {
              const selected = needs.includes(need);
              return (
                <SmoothPressable
                  key={need}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => toggleNeed(need)}
                  style={[
                    styles.needChip,
                    { backgroundColor: selected ? (isDark ? '#51433D' : '#EBD8D1') : theme.inputBackground },
                    selected && { borderColor: theme.tint, borderWidth: 1 },
                  ]}
                >
                  <Text style={[styles.needLabel, { color: theme.text }]}>
                    {need === 'remind myself' ? 'Remind myself' : need[0].toUpperCase() + need.slice(1)}
                  </Text>
                </SmoothPressable>
              );
            })}
          </View>
        </View>

        {error && <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>{error}</Text>}

        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Check-in saved' : 'Save check-in'}
          disabled={saving || loading}
          onPress={() => void saveCheckIn()}
          style={[
            styles.saveButton,
            { backgroundColor: saved ? '#829879' : theme.tint, opacity: saving && !saved || loading ? 0.65 : 1 },
          ]}
        >
          {saved ? (
            <View style={styles.savedContent}>
              <Text style={styles.saveLabel}>Saved</Text>
              <Ionicons name="heart" size={13} color="#FFFFFF" />
            </View>
          ) : (
            <Text style={styles.saveLabel}>{saving ? 'Saving…' : 'Save Check-in'}</Text>
          )}
        </SmoothPressable>
      </ScrollView>
    </View>
  );
}

function FlowerIllustration() {
  return (
    <Svg width={84} height={126} viewBox="0 0 84 126" fill="none">
      <Circle cx="27" cy="12" r="2.4" fill="#EBC8BE" />
      <Circle cx="56" cy="8" r="1.8" fill="#EBC8BE" />
      <Circle cx="67" cy="25" r="1.6" fill="#EBC8BE" />
      <Path d="M42 117C41 92 42 74 42 52" stroke="#829C74" strokeWidth="3" strokeLinecap="round" />
      <Path d="M42 81C29 76 23 68 19 58C31 61 39 68 42 81Z" fill="#B5C9AE" />
      <Path d="M42 68C54 61 61 52 65 42C53 45 45 53 42 68Z" fill="#A9BEA1" />
      <Circle cx="42" cy="32" r="15" fill="#E7B8AC" />
      <Circle cx="42" cy="21" r="7" fill="#EBC8BE" />
      <Circle cx="51" cy="26" r="7" fill="#EBC8BE" />
      <Circle cx="48" cy="37" r="7" fill="#EBC8BE" />
      <Circle cx="36" cy="39" r="7" fill="#EBC8BE" />
      <Circle cx="33" cy="27" r="7" fill="#EBC8BE" />
      <Circle cx="42" cy="31" r="8" fill="#CC8E80" />
      <Circle cx="42" cy="31" r="4.5" fill="#E4AEA1" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  header: { minHeight: 42, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 34, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 34 },
  title: { fontFamily: 'serif', fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 10, marginTop: 3, textAlign: 'center' },
  hero: { alignItems: 'center', marginTop: 40 },
  day: { fontFamily: 'serif', fontSize: 42, lineHeight: 52, fontWeight: '700', marginTop: 2 },
  daySubtitle: { fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 1 },
  quoteCard: { minHeight: 72, borderRadius: 16, marginTop: 24, paddingHorizontal: 22, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  quote: { fontFamily: 'serif', fontStyle: 'italic', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  checkInSection: { marginTop: 20 },
  sectionTitle: { fontFamily: 'serif', fontSize: 15, fontWeight: '700' },
  sectionSubtitle: { fontSize: 10, marginTop: 3 },
  moodRow: { flexDirection: 'row', gap: 7, marginTop: 13 },
  moodOption: { flex: 1, minHeight: 66, borderRadius: 15, alignItems: 'center', justifyContent: 'center', gap: 4 },
  moodEmoji: { fontSize: 21 },
  moodLabel: { fontSize: 9 },
  needsSection: { marginTop: 20 },
  needsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  needChip: { minHeight: 34, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  needLabel: { fontSize: 11, fontWeight: '500' },
  error: { fontSize: 11, textAlign: 'center', marginTop: 10 },
  saveButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  savedContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saveLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
