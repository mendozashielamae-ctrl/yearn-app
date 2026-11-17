import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { SmoothPressable } from '@/components/SmoothPressable';
import {
  getTodayCheckIn,
  getTodayHealingJourneyCheckIn,
  healingDay,
  saveTodayCheckIn,
  type JourneyMood,
  type Mood,
} from '@/settings/storage';
import { useSettings } from '@/settings/SettingsContext';
import { useIsDarkTheme } from '@/theme';

const COLORS = {
  aqua: '#BCE9E6',
  sage: '#D5DEC4',
  cream: '#F7F3E9',
  brown: '#483B37',
  taupe: '#9F8D83',
  terracotta: '#CC806E',
  card: '#FBF8F1',
};

const DARK_COLORS = {
  aqua: '#293B3A',
  sage: '#323B32',
  cream: '#252421',
  brown: '#F1E9DF',
  taupe: '#B9A99D',
  terracotta: '#BF8775',
  card: '#302E2A',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Router = ReturnType<typeof useRouter>;

const FEATURES: {
  title: string;
  subtitle: string;
  icon: IconName;
  background: string;
  route: Href;
}[] = [
  { title: 'Un-Sent Letters', subtitle: 'Write. Feel. Release.', icon: 'mail-outline', background: '#E7CCC6', route: '/letters' as Href },
  { title: 'Final Playlist', subtitle: 'Listen & Reflect.', icon: 'musical-notes-outline', background: '#BED2B4', route: '/playlist' as Href },
  { title: 'Memory Archive', subtitle: 'Keep or Hide', icon: 'image-outline', background: '#DFD0BA', route: '/memories' as Href },
  { title: 'My Healing Journey', subtitle: 'Grow with time.', icon: 'location-outline', background: '#BDD3B2', route: '/journey' as Href },
];

const MOODS: { id: Mood; label: string; icon: IconName }[] = [
  { id: 'calm', label: 'Calm', icon: 'cloud-outline' },
  { id: 'hopeful', label: 'Hopeful', icon: 'sunny-outline' },
  { id: 'sad', label: 'Sad', icon: 'rainy-outline' },
  { id: 'strong', label: 'Strong', icon: 'heart-outline' },
];
const JOURNEY_MOOD_LABELS: Record<JourneyMood, string> = {
  good: 'Good',
  okay: 'Okay',
  sad: 'Sad',
  heavy: 'Heavy',
  healing: 'Healing',
};

function navigateToChat(router: Router) {
  router.push('/chat' as Href);
}

export default function HomeScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const isDark = useIsDarkTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const journeyDay = healingDay(settings.healingStartDate);
  const [mood, setMood] = useState<Mood | null>(null);
  const [journeyMood, setJourneyMood] = useState<JourneyMood | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getTodayCheckIn(), getTodayHealingJourneyCheckIn()])
        .then(([todayMood, journeyCheckIn]) => {
          if (!active) return;
          setMood(todayMood);
          setJourneyMood(journeyCheckIn?.mood ?? null);
          setSaveError(false);
        })
        .catch((error) => {
          console.warn("Unable to load today's check-in:", error);
          if (active) setSaveError(true);
        });
      return () => { active = false; };
    }, [])
  );

  const selectMood = async (nextMood: Mood) => {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveTodayCheckIn(nextMood);
      setMood(nextMood);
      setCheckInOpen(false);
    } catch (error) {
      console.warn("Unable to save today's check-in:", error);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.sage }]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="homeBackground" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.aqua} />
            <Stop offset="0.62" stopColor={colors.sage} />
            <Stop offset="1" stopColor={colors.cream} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#homeBackground)" />
      </Svg>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboard}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.greeting, { color: colors.taupe }]}>Good day,</Text>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.brown }]}>{settings.nickname.trim() || 'Beautiful Soul'}</Text>
                <Ionicons name="heart" size={17} color={colors.terracotta} />
              </View>
            </View>
            <SmoothPressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings' as Href)}
              style={[styles.settingsButton, { backgroundColor: colors.card }]}
            >
              <Ionicons name="settings-outline" size={21} color={colors.brown} />
            </SmoothPressable>
          </View>

          <View style={[styles.quoteCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.quote, { color: colors.brown }]}>“You are doing better than you think.”</Text>
            <TreeIllustration size={38} />
          </View>

          <View style={[styles.journeyCard, { backgroundColor: colors.card }]}>
            <TreeIllustration size={48} />
            <View style={styles.journeyCopy}>
              <Text style={[styles.journeyDay, { color: colors.brown }]}>{journeyDay === null ? 'Your journey' : `Day ${journeyDay}`}</Text>
              <Text style={[styles.journeySubtitle, { color: colors.brown }]}>of choosing yourself.</Text>
              <Text style={[styles.journeyNote, { color: colors.taupe }]}>
                Healing is a process, and you&apos;re making progress.
              </Text>
            </View>
          </View>

          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel={journeyMood || !mood ? 'Open My Healing Journey' : 'Open daily mood check-in'}
            onPress={() => {
              if (journeyMood || !mood) router.push('/journey' as Href);
              else setCheckInOpen(true);
            }}
            style={[styles.checkInPanel, { backgroundColor: isDark ? '#393630' : 'rgba(251, 248, 241, 0.68)' }]}
          >
            <SeedlingIcon />
            <View style={styles.checkInCopy}>
              <Text style={[styles.checkInTitle, { color: colors.brown }]}>
                {journeyMood
                  ? "Today's check-in ✓"
                  : mood
                    ? `Checked in: ${mood}`
                    : 'No check-in yet today'}
              </Text>
              <Text style={[styles.checkInSubtitle, { color: colors.taupe }]}>
                {journeyMood
                  ? `Feeling ${JOURNEY_MOOD_LABELS[journeyMood].toLowerCase()} today`
                  : mood
                    ? 'How are you feeling? Tap to update.'
                    : 'How are you feeling? Tap to check in.'}
              </Text>
              {saveError && <Text style={[styles.errorText, { color: isDark ? '#FF9A91' : '#9F3A32' }]}>Could not load or save. Please try again.</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.taupe} />
          </SmoothPressable>

          <View style={styles.featureGrid}>
            {FEATURES.map((feature) => (
              <FeatureCard
                key={feature.title}
                {...feature}
                onPress={() => router.push(feature.route)}
                colors={colors}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View pointerEvents="box-none" style={styles.chatButtonWrap}>
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel="Open AI chat"
          onPress={() => navigateToChat(router)}
          style={styles.chatButton}
        >
          <Ionicons name="chatbubble-outline" size={23} color="#FFFFFF" />
        </SmoothPressable>
      </View>

      <Modal
        visible={checkInOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCheckInOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.moodDialog, { backgroundColor: colors.card }]}>
            <Text style={[styles.dialogTitle, { color: colors.brown }]}>How are you feeling?</Text>
            <Text style={[styles.dialogSubtitle, { color: colors.taupe }]}>Choose the word that feels right today.</Text>
            <View style={styles.moodOptions}>
              {MOODS.map((option) => (
                <SmoothPressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  disabled={saving}
                  onPress={() => void selectMood(option.id)}
                  style={[styles.moodOption, { backgroundColor: isDark ? '#514A43' : '#F0EAE0' }]}
                >
                  <Ionicons name={option.icon} size={23} color={COLORS.terracotta} />
                  <Text style={[styles.moodLabel, { color: colors.brown }]}>{option.label}</Text>
                </SmoothPressable>
              ))}
            </View>
            <SmoothPressable
              accessibilityRole="button"
              onPress={() => setCheckInOpen(false)}
              style={styles.cancelButton}
            >
              <Text style={[styles.cancelLabel, { color: colors.taupe }]}>Not now</Text>
            </SmoothPressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FeatureCard({
  title,
  subtitle,
  icon,
  background,
  onPress,
  colors,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  background: string;
  onPress: () => void;
  colors: typeof COLORS | typeof DARK_COLORS;
}) {
  return (
    <SmoothPressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.featureCard, { backgroundColor: background, opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={21} color={colors.brown} />
      </View>
      <View style={styles.featureCopy}>
        <Text style={[styles.featureTitle, { color: colors.brown }]}>{title}</Text>
        <Text style={[styles.featureSubtitle, { color: colors.taupe }]}>{subtitle}</Text>
      </View>
    </SmoothPressable>
  );
}

function SeedlingIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="M12 20v-9m0 5c-3.5 0-5.5-2-5.5-5.5 3.2 0 5.1 1.4 5.5 4m0-3.5c0-3.3 1.9-5.5 5.5-5.5 0 3.1-1.5 5.1-4.5 5.5M6 20h12"
        fill="none"
        stroke={COLORS.terracotta}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TreeIllustration({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        d="M24 43V15m0 16-9-8m9 2 9-9m-9 4-6-7m6 22 8-7"
        stroke="#829879"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 24c-5 0-8-3-8-8 5 0 8 3 8 8Zm9-11c-4-3-4-7 0-11 4 4 4 8 0 11Zm9 2c1-5 4-7 9-6-1 5-4 7-9 6Zm-1 17c1-5 5-7 9-6-1 5-5 7-9 6Z"
        fill="#A8B994"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.sage },
  scroll: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingBottom: 76 },
  dashboard: { width: '100%', maxWidth: 430, paddingHorizontal: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  headerCopy: { gap: 1 },
  greeting: { color: COLORS.brown, fontSize: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { color: COLORS.brown, fontFamily: 'serif', fontSize: 25, fontWeight: '700' },
  settingsButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  quoteCard: { minHeight: 80, borderRadius: 22, backgroundColor: COLORS.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, gap: 12 },
  quote: { flex: 1, color: COLORS.brown, fontFamily: 'serif', fontSize: 17, fontStyle: 'italic' },
  journeyCard: { minHeight: 110, borderRadius: 22, backgroundColor: COLORS.card, flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 18, paddingVertical: 12 },
  journeyCopy: { flex: 1 },
  journeyDay: { color: COLORS.brown, fontFamily: 'serif', fontSize: 26, fontWeight: '700' },
  journeySubtitle: { color: COLORS.brown, fontFamily: 'serif', fontSize: 16 },
  journeyNote: { color: COLORS.taupe, fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  checkInPanel: { minHeight: 68, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.terracotta, backgroundColor: 'rgba(251, 248, 241, 0.68)', flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 },
  checkInCopy: { flex: 1 },
  checkInTitle: { color: COLORS.brown, fontSize: 13, fontWeight: '600' },
  checkInSubtitle: { color: COLORS.taupe, fontSize: 11, marginTop: 3 },
  errorText: { color: '#9F3A32', fontSize: 10, marginTop: 3 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: { flexBasis: '48%', flexGrow: 1, height: 140, borderRadius: 22, padding: 14, justifyContent: 'space-between' },
  featureIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.48)', alignItems: 'center', justifyContent: 'center' },
  featureCopy: { gap: 3 },
  featureTitle: { color: COLORS.brown, fontFamily: 'serif', fontSize: 15, fontWeight: '700' },
  featureSubtitle: { color: COLORS.taupe, fontSize: 11 },
  chatButtonWrap: { position: 'absolute', bottom: 10, alignSelf: 'center', width: '100%', maxWidth: 430, alignItems: 'flex-end', paddingHorizontal: 16 },
  chatButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.terracotta, elevation: 4, shadowColor: '#483B37', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(35, 30, 27, 0.38)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  moodDialog: { width: '100%', maxWidth: 360, borderRadius: 24, backgroundColor: COLORS.card, padding: 22, alignItems: 'center' },
  dialogTitle: { color: COLORS.brown, fontFamily: 'serif', fontSize: 22, fontWeight: '700' },
  dialogSubtitle: { color: COLORS.taupe, fontSize: 13, marginTop: 6, marginBottom: 18 },
  moodOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  moodOption: { minWidth: 112, minHeight: 75, borderRadius: 16, backgroundColor: '#F0EAE0', alignItems: 'center', justifyContent: 'center', gap: 6 },
  moodLabel: { color: COLORS.brown, fontSize: 13, fontWeight: '600' },
  cancelButton: { paddingHorizontal: 18, paddingVertical: 10, marginTop: 10 },
  cancelLabel: { color: COLORS.taupe, fontSize: 14 },
});
