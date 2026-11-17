import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SmoothPressable } from '@/components/SmoothPressable';
import { loadMemories } from '@/memories/storage';
import { loadPlaylistTracks } from '@/playlist/storage';
import {
  getHealingCheckInCount,
  healingDay,
  loadLetters,
} from '@/settings/storage';
import { useSettings } from '@/settings/SettingsContext';
import { useIsDarkTheme, useTheme } from '@/theme';

type Stats = {
  letters: number | null;
  songs: number | null;
  photos: number | null;
  checkIns: number | null;
};

const MILESTONES = [
  { day: 1, title: 'A new\nbeginning' },
  { day: 7, title: 'Still here' },
  { day: 30, title: 'Growing\nstronger' },
  { day: 100, title: 'A brighter\nme' },
];

export default function HealingGardenScreen() {
  const router = useRouter();
  const theme = useTheme();
  const isDark = useIsDarkTheme();
  const { settings } = useSettings();
  const day = healingDay(settings.healingStartDate);
  const [stats, setStats] = useState<Stats>({
    letters: null,
    songs: null,
    photos: null,
    checkIns: null,
  });
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      loadLetters(),
      loadPlaylistTracks(),
      loadMemories(),
      getHealingCheckInCount(),
    ]);
    setStats({
      letters: results[0].status === 'fulfilled' ? results[0].value.length : null,
      songs: results[1].status === 'fulfilled' ? results[1].value.length : null,
      photos: results[2].status === 'fulfilled' ? results[2].value.length : null,
      checkIns: results[3].status === 'fulfilled' ? results[3].value : null,
    });
    const failed = results.some((result) => result.status === 'rejected');
    setError(failed);
    if (failed) console.warn('Unable to load all healing garden stats.');
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#252421' : '#FAFDFC' }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.text }]}>My Healing Garden</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Every small step counts.</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.milestoneCard, { backgroundColor: isDark ? '#303632' : '#F0F5F2' }]}>
          {MILESTONES.map((milestone, index) => {
            const achieved = day !== null && day >= milestone.day;
            return (
              <View key={milestone.day} style={styles.milestone}>
                <MilestoneFlower
                  stage={index}
                  achieved={achieved}
                />
                <Text style={[styles.milestoneDay, { color: achieved ? theme.tint : theme.textSecondary }]}>
                  Day {milestone.day}
                </Text>
                <Text style={[styles.milestoneTitle, { color: achieved ? theme.textSecondary : `${theme.textSecondary}99` }]}>
                  {milestone.title}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.quoteCard, { backgroundColor: isDark ? '#302E2A' : '#F5F0ED' }]}>
          <Text style={[styles.quote, { color: theme.text }]}>&quot;Look how far you&apos;ve come.&quot;</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Journal Stats</Text>
        <View style={styles.statsRow}>
          <StatCard label="Letters" value={stats.letters} icon="mail-outline" theme={theme} />
          <StatCard label="Songs" value={stats.songs} icon="musical-notes-outline" theme={theme} />
          <StatCard label="Photos" value={stats.photos} icon="image-outline" theme={theme} />
          <StatCard label="Check-ins" value={stats.checkIns} icon="time-outline" theme={theme} />
        </View>
        {error && (
          <Text style={[styles.error, { color: theme.danger }]}>
            Some journal stats could not be loaded.
          </Text>
        )}

        <View style={[styles.closingQuoteCard, { backgroundColor: isDark ? '#303632' : '#F0F5F2' }]}>
          <Text style={[styles.closingQuote, { color: theme.textSecondary }]}>
            &quot;Healing isn&apos;t about erasing the past, but about creating a happier future for yourself.&quot;
          </Text>
        </View>
        <Text style={styles.encouragement}>Keep going ♥</Text>
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel="Open My Healing Journey check-in"
          onPress={() => router.push('/journey' as Href)}
          style={[styles.checkInLink, { borderColor: theme.border }]}
        >
          <Text style={[styles.checkInLinkLabel, { color: theme.textSecondary }]}>Open today&apos;s check-in</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </SmoothPressable>
      </ScrollView>
    </View>
  );
}

function MilestoneFlower({
  stage,
  achieved,
}: {
  stage: number;
  achieved: boolean;
}) {
  const opacity = achieved ? 1 : 0.34;
  if (stage === 0) {
    return (
      <Svg width={42} height={58} viewBox="0 0 42 58">
        <Path d="M21 49V23" stroke="#829C74" strokeWidth="2.4" strokeLinecap="round" opacity={opacity} />
        <Path d="M21 34c-6-2-9-6-11-11 6 1 10 5 11 11Z" fill="#A9BEA1" opacity={opacity} />
        <Circle cx="21" cy="18" r="7" fill="#A9BEA1" opacity={opacity} />
        <Path d="M18 49h6l-1 5h-4l-1-5Z" fill="#C9B89A" opacity={opacity} />
      </Svg>
    );
  }
  const flowerY = stage === 1 ? 22 : 17;
  return (
    <Svg width={52} height={82} viewBox="0 0 52 82">
      <Path d={`M26 74V${flowerY + 10}`} stroke="#829C74" strokeWidth="2.5" strokeLinecap="round" opacity={opacity} />
      <Path d={`M26 ${flowerY + 28}c-9-3-13-9-15-17 9 2 14 8 15 17Z`} fill="#A9BEA1" opacity={opacity} />
      {stage >= 2 && (
        <Path d={`M26 ${flowerY + 24}c8-5 12-11 14-19-9 3-13 9-14 19Z`} fill="#A9BEA1" opacity={opacity} />
      )}
      <Path d="M20 74h12l-2 6h-8l-2-6Z" fill="#C9B89A" opacity={opacity} />
      <Circle cx="26" cy={flowerY} r="9" fill="#E5BDB3" opacity={opacity} />
      <Circle cx="26" cy={flowerY - 6} r="5" fill="#EBCBC4" opacity={opacity} />
      <Circle cx="32" cy={flowerY - 1} r="5" fill="#EBCBC4" opacity={opacity} />
      <Circle cx="29" cy={flowerY + 6} r="5" fill="#EBCBC4" opacity={opacity} />
      <Circle cx="22" cy={flowerY + 6} r="5" fill="#EBCBC4" opacity={opacity} />
      <Circle cx="20" cy={flowerY - 1} r="5" fill="#EBCBC4" opacity={opacity} />
      <Circle cx="26" cy={flowerY} r="5" fill="#CC8E80" opacity={opacity} />
    </Svg>
  );
}

function StatCard({
  label,
  value,
  icon,
  theme,
}: {
  label: string;
  value: number | null;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.inputBackground }]}>
      <Ionicons name={icon} size={16} color={theme.tint} />
      <Text style={[styles.statValue, { color: theme.text }]}>{value ?? '—'}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34 },
  header: { minHeight: 46, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 34, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 34 },
  title: { fontFamily: 'serif', fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 10, marginTop: 3 },
  milestoneCard: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 22, paddingHorizontal: 8, paddingVertical: 13, marginTop: 14 },
  milestone: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  milestoneDay: { fontSize: 9, fontWeight: '600', textAlign: 'center', marginTop: 5 },
  milestoneTitle: { minHeight: 26, fontSize: 8, lineHeight: 11, textAlign: 'center', marginTop: 5 },
  quoteCard: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 20 },
  quote: { fontFamily: 'serif', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  sectionTitle: { fontFamily: 'serif', fontSize: 14, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, minHeight: 94, borderRadius: 15, alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  statValue: { fontFamily: 'serif', fontSize: 19, fontWeight: '700' },
  statLabel: { fontSize: 8, textAlign: 'center' },
  error: { fontSize: 11, marginTop: 8, textAlign: 'center' },
  closingQuoteCard: { minHeight: 64, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 12, marginTop: 20 },
  closingQuote: { fontFamily: 'serif', fontSize: 11, fontStyle: 'italic', lineHeight: 16, textAlign: 'center' },
  encouragement: { alignSelf: 'center', color: '#CC8778', fontFamily: 'serif', fontStyle: 'italic', fontSize: 20, marginTop: 20 },
  checkInLink: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, alignSelf: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, marginTop: 12 },
  checkInLinkLabel: { fontSize: 10, fontWeight: '500' },
});
