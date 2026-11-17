import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SmoothPressable } from '@/components/SmoothPressable';
import { clearAllConversations } from '@/db/conversations';
import { clearMemories, loadMemories } from '@/memories/storage';
import { clearPlaylistTracks, loadPlaylistTracks } from '@/playlist/storage';
import { deleteProfileAvatar, loadProfileAvatar, pickProfileAvatar, releaseProfileAvatar } from '@/profile/avatar';
import {
  clearLetters,
  healingDay,
  isLocalDate,
  loadLetters,
  resetProfilePreferences,
  type ThemeMode,
} from '@/settings/storage';
import { useSettings } from '@/settings/SettingsContext';
import { useIsDarkTheme, useTheme } from '@/theme';
import { confirmAction } from '@/utils/confirm';
import { useAiStatus } from '@/hooks/useAiStatus';

const TERRACOTTA = '#BF8775';
type ExplicitThemeMode = Exclude<ThemeMode, 'system'>;

const THEMES: { id: ExplicitThemeMode; title: string; detail: string }[] = [
  { id: 'light', title: 'Light Mode', detail: 'Warm beige & cream' },
  { id: 'dark', title: 'Dark Mode', detail: 'Deep brown & charcoal' },
];

type Counts = { letters: number | null; songs: number | null; memories: number | null };

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatHealingDate(value: string): string {
  if (!isLocalDate(value)) return 'Choose your start date';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function MeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const isDark = useIsDarkTheme();
  const { settings, update } = useSettings();
  const { problem, isOnline } = useAiStatus();
  const [counts, setCounts] = useState<Counts>({ letters: null, songs: null, memories: null });
  const [countsError, setCountsError] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const avatarUriRef = useRef<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [nameDialog, setNameDialog] = useState(false);
  const [nameDraft, setNameDraft] = useState(settings.nickname);
  const [nameError, setNameError] = useState('');
  const [dateDialog, setDateDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [dateError, setDateError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const day = healingDay(settings.healingStartDate);
  const colors = useMemo(() => ({
    background: isDark ? '#252421' : '#F7F3E9',
    aqua: isDark ? '#293B3A' : '#BCE9E6',
    sage: isDark ? '#323B32' : '#D5DEC4',
    cream: isDark ? '#252421' : '#F7F3E9',
    card: isDark ? '#302E2A' : '#FBF8F1',
    text: isDark ? '#F1E9DF' : '#483B37',
    secondary: isDark ? '#B9A99D' : '#9F8D83',
    border: isDark ? '#514A43' : '#E8DED4',
    divider: isDark ? '#514A43' : '#EAE2D9',
    input: isDark ? '#3D3934' : '#FFFFFF',
  }), [isDark]);

  const refreshData = useCallback(async () => {
    const [letters, songs, memories] = await Promise.allSettled([
      loadLetters(),
      loadPlaylistTracks(),
      loadMemories(),
    ]);
    setCounts({
      letters: letters.status === 'fulfilled' ? letters.value.length : null,
      songs: songs.status === 'fulfilled' ? songs.value.length : null,
      memories: memories.status === 'fulfilled' ? memories.value.length : null,
    });
    const failed = [letters, songs, memories].some((item) => item.status === 'rejected');
    setCountsError(failed);
    if (failed) console.warn('Unable to load one or more profile summary counts.');
  }, []);

  const refreshAvatar = useCallback(async () => {
    if (!settings.profileAvatarUri) {
      if (avatarUriRef.current) releaseProfileAvatar(avatarUriRef.current);
      avatarUriRef.current = null;
      setAvatarUri(null);
      return;
    }
    try {
      const uri = await loadProfileAvatar(settings.profileAvatarUri);
      avatarUriRef.current = uri;
      setAvatarUri(uri);
    } catch (error) {
      console.warn('Unable to load profile photo:', error);
      setAvatarUri(null);
      setAvatarError(error instanceof Error ? error.message : 'Unable to load profile photo.');
    }
  }, [settings.profileAvatarUri]);

  useFocusEffect(
    useCallback(() => {
      void refreshData();
      void refreshAvatar();
      return () => {
        if (avatarUriRef.current) releaseProfileAvatar(avatarUriRef.current);
        avatarUriRef.current = null;
      };
    }, [refreshAvatar, refreshData])
  );

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name) {
      setNameError('Please enter your name.');
      return;
    }
    setSaving(true);
    setNameError('');
    try {
      await update('nickname', name);
      setNameDialog(false);
    } catch (error) {
      setNameError(error instanceof Error ? error.message : 'Could not save your name.');
    } finally {
      setSaving(false);
    }
  };

  const openDatePicker = () => {
    const parsed = isLocalDate(settings.healingStartDate)
      ? dateFromKey(settings.healingStartDate)
      : new Date();
    setCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setSelectedDate(isLocalDate(settings.healingStartDate) ? settings.healingStartDate : null);
    setDateError('');
    setDateDialog(true);
  };

  const saveDate = async () => {
    if (!selectedDate || !isLocalDate(selectedDate) || selectedDate > localDateString(new Date())) {
      setDateError('Choose a valid date today or earlier.');
      return;
    }
    setSaving(true);
    try {
      await update('healingStartDate', selectedDate);
      setDateDialog(false);
    } catch (error) {
      setDateError(error instanceof Error ? error.message : 'Could not save this date.');
    } finally {
      setSaving(false);
    }
  };

  const clearHealingDate = async () => {
    setSaving(true);
    setDateError('');
    try {
      await update('healingStartDate', '');
      setSelectedDate(null);
      setDateDialog(false);
    } catch (error) {
      setDateError(error instanceof Error ? error.message : 'Could not remove this date.');
    } finally {
      setSaving(false);
    }
  };

  const removeAvatar = () => {
    confirmAction(
      'Remove profile photo?',
      'This removes only the profile photo copy saved by YEARN. The original in your photo library will stay unchanged.',
      'Remove',
      async () => {
        try {
          await deleteProfileAvatar(settings.profileAvatarUri);
          await update('profileAvatarUri', '');
          avatarUriRef.current = null;
          setAvatarUri(null);
        } catch (error) {
          console.warn('Unable to remove profile photo:', error);
          setAvatarError(error instanceof Error ? error.message : 'Unable to remove profile photo.');
          throw error;
        }
      }
    );
  };

  const changeTheme = async (mode: ThemeMode) => {
    setActionError(null);
    try {
      await update('theme', mode);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not save the appearance preference.');
    }
  };

  const changeAvatar = async () => {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const previousUri = settings.profileAvatarUri;
      const selected = await pickProfileAvatar();
      if (!selected) return;
      await update('profileAvatarUri', selected);
      if (Platform.OS !== 'web' && previousUri && previousUri !== selected) {
        await deleteProfileAvatar(previousUri);
      }
      await refreshAvatar();
    } catch (error) {
      console.warn('Unable to save profile photo:', error);
      setAvatarError(error instanceof Error ? error.message : 'Unable to save profile photo.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const clearUserData = () => {
    if (clearing) return;
    setActionError(null);
    confirmAction(
      'Clear all YEARN data?',
      'This deletes your chat history and attachments, letters, saved playlist entries and imported audio copies, saved photo memories and their app copies, daily check-in, profile name, healing date, profile photo, and theme preference. Original files in Downloads and your photo library, AI credentials and configuration, and the downloaded local AI model will remain. This only clears data stored by YEARN on this device; there is no cloud account data to delete.',
      'Clear',
      async () => {
        setClearing(true);
        try {
          await Promise.all([
            clearAllConversations(),
            clearLetters(),
            clearPlaylistTracks(),
            clearMemories(),
            deleteProfileAvatar(settings.profileAvatarUri),
            resetProfilePreferences(),
          ]);
          await Promise.all([
            update('nickname', ''),
            update('healingStartDate', ''),
            update('profileAvatarUri', ''),
            update('theme', 'light'),
            update('onboarded', false),
          ]);
          setAvatarUri(null);
          avatarUriRef.current = null;
          setCounts({ letters: 0, songs: 0, memories: 0 });
          setCountsError(false);
          setNameDraft('');
          setActionError(null);
          router.replace('/onboarding' as Href);
        } catch (error) {
          console.error('Unable to clear YEARN user data:', error);
          setActionError(error instanceof Error ? error.message : 'Unable to clear all YEARN data.');
          throw error;
        } finally {
          setClearing(false);
        }
      }
    );
  };

  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const monthLength = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const days = [...Array(firstDay).fill(null), ...Array.from({ length: monthLength }, (_, i) => i + 1)];
  const activeTheme: ExplicitThemeMode = settings.theme === 'system'
    ? isDark ? 'dark' : 'light'
    : settings.theme;
  const displayName = settings.nickname.trim() || 'Beautiful Soul';

  return (
    <View style={[styles.screen, { backgroundColor: colors.cream }]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="meBackground" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.aqua} />
            <Stop offset="0.55" stopColor={colors.sage} />
            <Stop offset="1" stopColor={colors.cream} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#meBackground)" />
      </Svg>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.card, borderColor: '#E8CFC4' }]}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              : <View style={styles.defaultAvatar}>
                <Ionicons name="heart" size={27} color="#C98789" />
                <Ionicons name="leaf" size={15} color="#8BA17B" style={styles.avatarLeaf} />
              </View>}
            <SmoothPressable
              accessibilityRole="button"
              accessibilityLabel="Choose profile photo"
              disabled={avatarBusy}
              onPress={() => void changeAvatar()}
              style={styles.cameraButton}
            >
              <Ionicons name={avatarBusy ? 'hourglass-outline' : 'camera-outline'} size={16} color="#FFFFFF" />
            </SmoothPressable>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.healingDay, { color: colors.secondary }]}>
            {day === null ? 'Choose your healing start date' : `Day ${day} of healing`}
          </Text>
          {!!avatarUri && (
            <SmoothPressable accessibilityRole="button" onPress={removeAvatar} style={styles.removeAvatarButton}>
              <Text style={[styles.rowSubtitle, { color: colors.secondary }]}>Remove profile photo</Text>
            </SmoothPressable>
          )}
          {avatarError && <Text style={[styles.inlineError, { color: theme.danger }]}>{avatarError}</Text>}
        </View>

        <SectionHeading title="PROFILE" color={colors.secondary} />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <ProfileRow
            label="YOUR NAME"
            value={displayName}
            onEdit={() => { setNameDraft(settings.nickname); setNameError(''); setNameDialog(true); }}
            colors={colors}
          />
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />
          <ProfileRow
            label="HEALING START DATE"
            value={formatHealingDate(settings.healingStartDate)}
            onEdit={openDatePicker}
            colors={colors}
          />
        </View>

        <SectionHeading title="APPEARANCE" color={colors.secondary} />
        <ThemePreview colors={colors} mode={activeTheme} />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {THEMES.map((option, index) => (
            <React.Fragment key={option.id}>
              {index > 0 && <View style={[styles.separator, { backgroundColor: colors.divider }]} />}
              <SmoothPressable
                accessibilityRole="radio"
                accessibilityLabel={option.title}
                accessibilityState={{ checked: activeTheme === option.id }}
                onPress={() => void changeTheme(option.id)}
                style={styles.themeRow}
              >
                <ThemeThumbnail mode={option.id} />
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{option.title}</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.secondary }]}>{option.detail}</Text>
                </View>
                <Ionicons
                  name={activeTheme === option.id ? 'radio-button-on' : 'radio-button-off'}
                  size={21}
                  color={activeTheme === option.id ? TERRACOTTA : colors.secondary}
                />
              </SmoothPressable>
            </React.Fragment>
          ))}
        </View>

        <SectionHeading title="PRIVACY & SECURITY" color={colors.secondary} />
        <View style={[styles.card, styles.securityCard, { backgroundColor: colors.card }]}>
          <View style={styles.securityRow}>
            <View style={[styles.securityIcon, { backgroundColor: '#F2E3DB' }]}>
              <Ionicons name="lock-closed-outline" size={20} color={TERRACOTTA} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>PIN Lock</Text>
              <Text style={[styles.rowSubtitle, { color: colors.secondary }]}>Unavailable in this build</Text>
            </View>
            <Text style={[styles.unavailablePill, { color: colors.secondary, backgroundColor: colors.input }]}>Unavailable</Text>
          </View>
          <Text style={[styles.securityNote, { color: colors.secondary }]}>
            YEARN does not currently include a secure app-lock flow. Your saved content is not protected by a PIN.
          </Text>
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />
          <View style={styles.securityRow}>
            <View style={[styles.securityIcon, { backgroundColor: '#E3EBDD' }]}>
              <Ionicons name="finger-print-outline" size={21} color="#718B67" />
            </View>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Face ID / Fingerprint</Text>
              <Text style={[styles.rowSubtitle, { color: colors.secondary }]}>Unavailable in this build</Text>
            </View>
            <Text style={[styles.unavailablePill, { color: colors.secondary, backgroundColor: colors.input }]}>Unavailable</Text>
          </View>
          <Text style={[styles.securityNote, { color: colors.secondary }]}>
            This build has no biometric authentication integration, so device approval cannot be requested or verified.
          </Text>
        </View>

        <SectionHeading title="YOUR PROGRESS" color={colors.secondary} />
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel="View My Healing Garden"
          onPress={() => router.push('/healing-garden' as Href)}
          style={[styles.progressCard, { backgroundColor: colors.card }]}
        >
          <View style={styles.progressCopy}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>View Healing Journey</Text>
            <Text style={[styles.rowSubtitle, { color: colors.secondary }]}>Your garden and journal stats</Text>
          </View>
          <Ionicons name="leaf-outline" size={30} color="#8BA17B" />
        </SmoothPressable>

        <SectionHeading title="SUMMARY" color={colors.secondary} />
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <SummaryItem label="Letters" value={counts.letters} color={TERRACOTTA} textColor={colors.text} />
          <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />
          <SummaryItem label="Songs" value={counts.songs} color="#829C74" textColor={colors.text} />
          <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />
          <SummaryItem label="Memories" value={counts.memories} color={colors.text} textColor={colors.text} />
        </View>
        {countsError && <Text style={[styles.inlineError, { color: theme.danger }]}>Some saved item counts could not be loaded.</Text>}

        <SectionHeading title="AI CONNECTION" color={colors.secondary} />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.connectionRow}>
            <Ionicons
              name={problem ? 'alert-circle-outline' : 'checkmark-circle-outline'}
              size={22}
              color={problem ? theme.danger : theme.success}
            />
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {settings.provider === 'cloud' ? 'Cloud AI (Gemini)' : 'Local AI'}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.secondary }]}>
                {problem ?? `Ready to chat · ${isOnline ? 'Online' : 'Offline'}`}
              </Text>
            </View>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />
          <LinkRow label="AI configuration" onPress={() => router.push('/chat-settings' as Href)} colors={colors} />
          <LinkRow label="More settings & backups" onPress={() => router.push('/settings' as Href)} colors={colors} />
        </View>

        <SectionHeading title="DATA" color={colors.secondary} />
        <View style={[styles.dataCard, { backgroundColor: colors.card }]}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Clear All Data</Text>
            <Text style={[styles.rowSubtitle, { color: colors.secondary }]}>Erase YEARN content and profile details</Text>
          </View>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="Clear all YEARN data"
            disabled={clearing}
            onPress={clearUserData}
            style={[styles.actionPill, { backgroundColor: '#F2E3DB' }]}
          >
            <Text style={styles.actionLabel}>{clearing ? 'Clearing' : 'Clear'}</Text>
          </SmoothPressable>
        </View>
        {actionError && <Text style={[styles.inlineError, { color: theme.danger }]}>{actionError}</Text>}
      </ScrollView>

      <View pointerEvents="box-none" style={styles.chatButtonWrap}>
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel="Open AI chat"
          onPress={() => router.push('/chat' as Href)}
          style={styles.chatButton}
        >
          <Ionicons name="chatbubble-outline" size={23} color="#FFFFFF" />
        </SmoothPressable>
      </View>

      <Modal visible={nameDialog} transparent animationType="fade" onRequestClose={() => setNameDialog(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>Your name</Text>
            <TextInput
              accessibilityLabel="Your name"
              autoFocus
              maxLength={40}
              onChangeText={setNameDraft}
              onSubmitEditing={() => void saveName()}
              placeholder="Beautiful Soul"
              placeholderTextColor={colors.secondary}
              returnKeyType="done"
              style={[styles.nameInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              value={nameDraft}
            />
            {!!nameError && <Text style={[styles.inlineError, { color: theme.danger }]}>{nameError}</Text>}
            <View style={styles.dialogActions}>
              <ActionButton label="Cancel" onPress={() => setNameDialog(false)} colors={colors} secondary />
              <ActionButton label={saving ? 'Saving…' : 'Save'} onPress={() => void saveName()} colors={colors} disabled={saving} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={dateDialog} transparent animationType="fade" onRequestClose={() => setDateDialog(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>Healing start date</Text>
            <Text style={[styles.dateHint, { color: colors.secondary }]}>
              {selectedDate ? formatHealingDate(selectedDate) : 'Choose the date your journey began.'}
            </Text>
            <View style={styles.calendarHeader}>
              <SmoothPressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setCalendarMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} style={styles.monthButton}>
                <Ionicons name="chevron-back" size={19} color={colors.text} />
              </SmoothPressable>
              <Text style={[styles.monthTitle, { color: colors.text }]}>
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <SmoothPressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setCalendarMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} style={styles.monthButton}>
                <Ionicons name="chevron-forward" size={19} color={colors.text} />
              </SmoothPressable>
            </View>
            <View style={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
                <Text key={`weekday-${index}`} style={[styles.weekday, { color: colors.secondary }]}>{label}</Text>
              ))}
              {days.map((number, index) => {
                if (number === null) return <View key={`blank-${index}`} style={styles.calendarCell} />;
                const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), number);
                const dateKey = localDateString(date);
                const disabled = dateKey > localDateString(new Date());
                const selected = selectedDate === dateKey;
                return (
                  <SmoothPressable
                    key={dateKey}
                    accessibilityRole="button"
                    accessibilityLabel={date.toLocaleDateString('en-US', { dateStyle: 'full' })}
                    accessibilityState={{ selected, disabled }}
                    disabled={disabled}
                    onPress={() => { setSelectedDate(dateKey); setDateError(''); }}
                    style={[styles.calendarCell, selected && { backgroundColor: TERRACOTTA }]}
                  >
                    <Text style={{ color: selected ? '#FFFFFF' : disabled ? colors.border : colors.text, fontSize: 13 }}>{number}</Text>
                  </SmoothPressable>
                );
              })}
            </View>
            {!!dateError && <Text style={[styles.inlineError, { color: theme.danger }]}>{dateError}</Text>}
            <View style={styles.dialogActions}>
              {isLocalDate(settings.healingStartDate) && (
                <ActionButton label="Clear date" onPress={() => void clearHealingDate()} colors={colors} secondary disabled={saving} />
              )}
              <ActionButton label="Cancel" onPress={() => setDateDialog(false)} colors={colors} secondary />
              <ActionButton label={saving ? 'Saving…' : 'Save date'} onPress={() => void saveDate()} colors={colors} disabled={saving || !selectedDate} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionHeading({ title, color }: { title: string; color: string }) {
  return <Text style={[styles.sectionHeading, { color }]}>{title}</Text>;
}

function ProfileRow({
  label,
  value,
  onEdit,
  colors,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  colors: Record<string, string>;
}) {
  return (
    <View style={styles.profileRow}>
      <View style={styles.rowCopy}>
        <Text style={[styles.fieldLabel, { color: colors.secondary }]}>{label}</Text>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>{value}</Text>
      </View>
      <SmoothPressable accessibilityRole="button" accessibilityLabel={`Edit ${label.toLowerCase()}`} onPress={onEdit} style={styles.editPill}>
        <Text style={styles.editLabel}>Edit</Text>
      </SmoothPressable>
    </View>
  );
}

function ThemePreview({
  colors,
  mode,
}: {
  colors: Record<string, string>;
  mode: ExplicitThemeMode;
}) {
  const darkPreview = mode === 'dark';
  return (
    <View style={[styles.previewCard, { backgroundColor: darkPreview ? '#302E2A' : '#FBF8F1', borderColor: darkPreview ? '#514A43' : '#E8DED4' }]}>
      <View style={styles.previewTextGroup}>
        <View style={[styles.previewLine, { width: 88, backgroundColor: darkPreview ? '#F1E9DF' : '#483B37' }]} />
        <View style={[styles.previewLine, { width: 58, backgroundColor: darkPreview ? '#B9A99D' : '#9F8D83' }]} />
      </View>
      <Ionicons name="leaf-outline" size={23} color="#8BA17B" />
      <View style={styles.previewChips}>
        {[0, 1, 2].map((item) => <View key={item} style={[styles.previewChip, { backgroundColor: item === 1 ? TERRACOTTA : (darkPreview ? '#514A43' : '#E7CCC6') }]} />)}
      </View>
      <View style={[styles.previewNav, { borderTopColor: darkPreview ? '#514A43' : '#E8DED4' }]}>
        {['home-outline', 'mail-outline', 'person-outline'].map((icon, index) => (
          <Ionicons key={icon} name={icon as React.ComponentProps<typeof Ionicons>['name']} size={13} color={index === 2 ? TERRACOTTA : (darkPreview ? '#B9A99D' : '#9F8D83')} />
        ))}
      </View>
      <Text style={[styles.previewCaption, { color: colors.secondary }]}>{`${mode === 'dark' ? 'Dark' : 'Light'} preview`}</Text>
    </View>
  );
}

function ThemeThumbnail({ mode }: { mode: ExplicitThemeMode }) {
  const dark = mode === 'dark';
  return (
    <View style={[styles.themeThumb, { backgroundColor: dark ? '#252421' : '#F7F3E9', borderColor: dark ? '#514A43' : '#E8DED4' }]}>
      <View style={[styles.thumbBar, { backgroundColor: dark ? '#F1E9DF' : '#483B37', width: 22 }]} />
      <View style={[styles.thumbBar, { backgroundColor: dark ? '#B9A99D' : '#9F8D83', width: 15 }]} />
    </View>
  );
}

function SummaryItem({
  label,
  value,
  color,
  textColor,
}: {
  label: string;
  value: number | null;
  color: string;
  textColor: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value ?? '—'}</Text>
      <Text style={[styles.summaryLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function LinkRow({
  label,
  onPress,
  colors,
}: {
  label: string;
  onPress: () => void;
  colors: Record<string, string>;
}) {
  return (
    <SmoothPressable accessibilityRole="button" onPress={onPress} style={styles.linkRow}>
      <Text style={[styles.rowTitle, { color: colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
    </SmoothPressable>
  );
}

function ActionButton({
  label,
  onPress,
  colors,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  colors: Record<string, string>;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <SmoothPressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.dialogButton, { backgroundColor: secondary ? colors.input : TERRACOTTA, opacity: disabled ? 0.55 : 1 }]}
    >
      <Text style={{ color: secondary ? colors.text : '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </SmoothPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 142, gap: 9 },
  profileHeader: { alignItems: 'center', paddingTop: 3, paddingBottom: 10 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  avatarImage: { width: 84, height: 84, borderRadius: 42 },
  defaultAvatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F0E7' },
  avatarLeaf: { position: 'absolute', right: 23, top: 28, transform: [{ rotate: '22deg' }] },
  cameraButton: { position: 'absolute', right: -2, bottom: -1, width: 31, height: 31, borderRadius: 16, backgroundColor: TERRACOTTA, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FBF8F1' },
  profileName: { fontFamily: 'serif', fontSize: 24, fontWeight: '700', marginTop: 9 },
  healingDay: { fontSize: 12, marginTop: 3 },
  removeAvatarButton: { marginTop: 4, padding: 4 },
  sectionHeading: { fontSize: 10, fontWeight: '700', letterSpacing: 1.15, marginTop: 7, marginBottom: 1 },
  card: { borderRadius: 19, paddingHorizontal: 14, paddingVertical: 5 },
  profileRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowCopy: { flex: 1, minWidth: 0 },
  fieldLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 3 },
  rowTitle: { fontSize: 13, fontWeight: '600' },
  rowSubtitle: { fontSize: 10, marginTop: 3, lineHeight: 14 },
  editPill: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F2E3DB' },
  editLabel: { color: TERRACOTTA, fontSize: 11, fontWeight: '700' },
  separator: { height: StyleSheet.hairlineWidth, width: '100%' },
  previewCard: { minHeight: 118, borderRadius: 19, borderWidth: 1, padding: 12, marginBottom: 1 },
  previewTextGroup: { position: 'absolute', left: 13, top: 14, gap: 6 },
  previewLine: { height: 5, borderRadius: 3, opacity: 0.82 },
  previewChips: { position: 'absolute', left: 13, top: 43, flexDirection: 'row', gap: 6 },
  previewChip: { width: 38, height: 11, borderRadius: 6, opacity: 0.75 },
  previewNav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 27, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  previewCaption: { position: 'absolute', right: 12, top: 79, fontSize: 9 },
  themeRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 7 },
  themeThumb: { width: 39, height: 43, borderRadius: 9, borderWidth: 1, padding: 7, justifyContent: 'center', gap: 4, overflow: 'hidden' },
  thumbBar: { height: 3, borderRadius: 2 },
  securityCard: { paddingTop: 13, paddingBottom: 12 },
  securityRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10 },
  securityIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  securityNote: { fontSize: 10, lineHeight: 15, marginLeft: 46, marginBottom: 12 },
  unavailablePill: { borderRadius: 13, paddingHorizontal: 9, paddingVertical: 6, fontSize: 9, overflow: 'hidden' },
  progressCard: { minHeight: 68, borderRadius: 19, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressCopy: { flex: 1 },
  summaryCard: { minHeight: 82, borderRadius: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 12 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontFamily: 'serif', fontSize: 21, fontWeight: '700' },
  summaryLabel: { fontSize: 10 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 37 },
  connectionRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 1 },
  dataCard: { minHeight: 70, borderRadius: 19, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionPill: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15 },
  actionLabel: { color: TERRACOTTA, fontSize: 11, fontWeight: '700' },
  chatButtonWrap: { position: 'absolute', bottom: 10, alignSelf: 'center', width: '100%', maxWidth: 430, alignItems: 'flex-end', paddingHorizontal: 16 },
  chatButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: TERRACOTTA, elevation: 4 },
  inlineError: { fontSize: 11, marginTop: 5, textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: 'rgba(24, 20, 18, 0.42)' },
  dialog: { width: '100%', maxWidth: 360, maxHeight: '90%', borderRadius: 22, padding: 18 },
  dialogTitle: { fontFamily: 'serif', fontSize: 21, fontWeight: '700' },
  nameInput: { height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginTop: 14, fontSize: 14 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 16 },
  dialogButton: { minWidth: 86, minHeight: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  dateHint: { fontSize: 11, marginTop: 5 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, marginBottom: 8 },
  monthButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 14, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  weekday: { width: '14.2857%', height: 31, textAlign: 'center', textAlignVertical: 'center', fontSize: 10, fontWeight: '600', paddingTop: 7 },
  calendarCell: { width: '14.2857%', aspectRatio: 1, maxHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
});
