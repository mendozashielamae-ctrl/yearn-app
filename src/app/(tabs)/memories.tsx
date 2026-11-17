import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImagePickerAsset } from 'expo-image-picker';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SmoothPressable } from '@/components/SmoothPressable';
import {
  deleteMemory,
  getMemoryUri,
  loadMemories,
  releaseMemoryUri,
  updateMemory,
  saveMemoryPhotos,
  selectMemoryPhotos,
} from '@/memories/storage';
import type { PhotoMemory } from '@/memories/types';
import { useIsDarkTheme } from '@/theme';
import { confirmAction } from '@/utils/confirm';

type Filter = 'All' | 'Photos' | 'Locked' | 'Archived';

const FILTERS: Filter[] = ['All', 'Photos', 'Locked', 'Archived'];
const MOODS = [
  { id: 'sunset', label: 'Sunset', emoji: '🌅' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'autumn', label: 'Autumn', emoji: '🍂' },
  { id: 'flowers', label: 'Flowers', emoji: '🌸' },
  { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'ocean', label: 'Ocean', emoji: '🌊' },
  { id: 'night', label: 'Night', emoji: '🌙' },
  { id: 'inspired', label: 'Inspired', emoji: '✨' },
  { id: 'movies', label: 'Movies', emoji: '🎬' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'home', label: 'Home', emoji: '🏡' },
  { id: 'playful', label: 'Playful', emoji: '🎭' },
];
const LIGHT = {
  aqua: '#BCE9E6',
  sage: '#D5DEC4',
  cream: '#F7F3E9',
  brown: '#483B37',
  taupe: '#9F8D83',
  terracotta: '#BF8775',
  card: '#FBF8F1',
  border: '#E6DDD3',
  placeholder: '#EEE9E1',
  scrim: 'rgba(35, 30, 27, 0.72)',
};
const DARK = {
  aqua: '#293B3A',
  sage: '#323B32',
  cream: '#252421',
  brown: '#F1E9DF',
  taupe: '#B9A99D',
  terracotta: '#BF8775',
  card: '#302E2A',
  border: '#514A43',
  placeholder: '#3D3934',
  scrim: 'rgba(0, 0, 0, 0.82)',
};

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMemoryDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US');
}

interface SavedPhoto extends PhotoMemory {
  localUri: string | null;
}

export default function MemoriesScreen() {
  const router = useRouter();
  const colors = useIsDarkTheme() ? DARK : LIGHT;
  const [memories, setMemories] = useState<PhotoMemory[]>([]);
  const [uriById, setUriById] = useState<Record<string, string>>({});
  const [selectedFilter, setSelectedFilter] = useState<Filter>('All');
  const [selectedPhoto, setSelectedPhoto] = useState<SavedPhoto | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captionSaving, setCaptionSaving] = useState(false);
  const [captionSaved, setCaptionSaved] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryDescription, setMemoryDescription] = useState('');
  const [memoryMood, setMemoryMood] = useState<string | null>(null);
  const [memoryDate, setMemoryDate] = useState(dateKey(new Date()));
  const [selectedAssets, setSelectedAssets] = useState<ImagePickerAsset[]>([]);
  const [moodPickerExpanded, setMoodPickerExpanded] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [savingMemory, setSavingMemory] = useState(false);
  const liveUris = useRef<Record<string, string>>({});
  const refreshGeneration = useRef(0);

  const clearUris = useCallback(() => {
    Object.values(liveUris.current).forEach(releaseMemoryUri);
    liveUris.current = {};
  }, []);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    setLoading(true);
    setError(null);
    clearUris();
    try {
      const stored = await loadMemories();
      setMemories(stored);
      const pairs = await Promise.all(stored.map(async (memory) => {
        try {
          return [memory.id, await getMemoryUri(memory)] as const;
        } catch (uriError) {
          console.warn('Unable to load saved photo:', uriError);
          return null;
        }
      }));
      const nextUris = Object.fromEntries(pairs.filter(
        (pair): pair is readonly [string, string] => pair !== null
      ));
      if (refreshGeneration.current !== generation) {
        Object.values(nextUris).forEach(releaseMemoryUri);
        return;
      }
      liveUris.current = nextUris;
      setUriById(nextUris);
    } catch (loadError) {
      console.warn('Unable to load memories:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your photos.');
    } finally {
      if (refreshGeneration.current === generation) setLoading(false);
    }
  }, [clearUris]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        refreshGeneration.current++;
        clearUris();
      };
    }, [clearUris, refresh])
  );

  useEffect(() => () => clearUris(), [clearUris]);

  const filtered = useMemo(() => {
    if (selectedFilter === 'Archived') return memories.filter((memory) => memory.archived);
    if (selectedFilter === 'Locked') return [];
    return memories.filter((memory) => !memory.archived);
  }, [memories, selectedFilter]);

  const openMemoryForm = () => {
    const today = new Date();
    setSelectedFilter('All');
    setMemoryTitle('');
    setMemoryDescription('');
    setMemoryMood(null);
    setMemoryDate(dateKey(today));
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedAssets([]);
    setError(null);
    setAddingMemory(true);
  };

  const closeMemoryForm = () => {
    setAddingMemory(false);
    setMoodPickerExpanded(false);
    setDatePickerVisible(false);
  };

  const choosePhotos = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    setError(null);
    try {
      const assets = await selectMemoryPhotos();
      if (assets) setSelectedAssets(assets);
    } catch (pickerError) {
      console.warn('Unable to select photos:', pickerError);
      setError(pickerError instanceof Error ? pickerError.message : 'Unable to choose these photos.');
    } finally {
      setImporting(false);
    }
  }, [importing]);

  const saveNewMemory = async () => {
    const title = memoryTitle.trim();
    if (!title) {
      setError('Add a title for this memory.');
      return;
    }
    if (selectedAssets.length === 0) {
      setError('Choose at least one photo for this memory.');
      return;
    }
    if (savingMemory) return;

    setSavingMemory(true);
    setError(null);
    try {
      const result = await saveMemoryPhotos(selectedAssets, {
        title,
        description: memoryDescription.trim(),
        mood: memoryMood ?? '',
        memoryDate,
      });
      if (result.memories.length > 0) {
        closeMemoryForm();
        await refresh();
      }
      if (result.rejected > 0) {
        setError(result.memories.length > 0
          ? `${result.rejected} photo${result.rejected === 1 ? '' : 's'} could not be read.`
          : 'The selected photos could not be read.');
      }
    } catch (saveError) {
      console.warn('Unable to save memory:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this memory.');
    } finally {
      setSavingMemory(false);
    }
  };

  const showPhoto = (memory: PhotoMemory) => {
    setSelectedPhoto({ ...memory, localUri: uriById[memory.id] ?? null });
    setCaptionDraft(memory.caption);
    setCaptionSaved(false);
  };

  const saveCaption = async () => {
    if (!selectedPhoto || captionSaving) return;
    setCaptionSaving(true);
    setError(null);
    try {
      const updated = await updateMemory(selectedPhoto.id, { caption: captionDraft.trim() });
      setMemories(updated);
      setSelectedPhoto((current) => current
        ? { ...current, caption: captionDraft.trim() }
        : null);
      setCaptionSaved(true);
    } catch (saveError) {
      console.warn('Unable to save photo caption:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this caption.');
    } finally {
      setCaptionSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!selectedPhoto) return;
    const archived = !selectedPhoto.archived;
    try {
      const updated = await updateMemory(selectedPhoto.id, { archived });
      setMemories(updated);
      setSelectedPhoto((current) => current ? { ...current, archived } : null);
    } catch (archiveError) {
      console.warn('Unable to update photo archive status:', archiveError);
      setError(archiveError instanceof Error ? archiveError.message : 'Unable to update this photo.');
    }
  };

  const requestDelete = (memory: PhotoMemory) => {
    confirmAction(
      'Remove photo from YEARN?',
      'This removes the saved copy from your gallery. The original photo in your library will not be deleted.',
      'Delete',
      async () => {
        await deleteMemory(memory);
        setMemories((previous) => previous.filter((item) => item.id !== memory.id));
        const uri = liveUris.current[memory.id];
        if (uri) releaseMemoryUri(uri);
        const nextUris = { ...liveUris.current };
        delete nextUris[memory.id];
        liveUris.current = nextUris;
        setUriById(nextUris);
        setSelectedPhoto((current) => current?.id === memory.id ? null : current);
      }
    );
  };

  const categoryEmptyText = selectedFilter === 'Archived'
    ? 'No archived memories.'
    : selectedFilter === 'Locked'
      ? 'Secure photo locking is not available in YEARN yet. Photos are not protected by a lock.'
      : 'No memories yet.';
  const categoryEmptyDetail = selectedFilter === 'Locked'
    ? 'Use your device’s built-in photo security to protect sensitive images.'
    : selectedFilter === 'Archived'
      ? 'Photos you archive will be kept here.'
      : 'Preserve a moment before it fades.';
  const calendarDays = useMemo(() => {
    const firstWeekday = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1
    ).getDay();
    const daysInMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0
    ).getDate();
    return [
      ...Array.from<number | null>({ length: firstWeekday }).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [calendarMonth]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.cream }]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="memoriesBackground" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.aqua} />
            <Stop offset="0.62" stopColor={colors.sage} />
            <Stop offset="1" stopColor={colors.cream} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#memoriesBackground)" />
      </Svg>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboard}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.brown }]}>Your Photos</Text>
            <Text style={[styles.headerSubtitle, { color: colors.taupe }]}>
              A private gallery of moments worth keeping.
            </Text>
          </View>

          <View style={styles.controls}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
              style={styles.filterScroll}
            >
              {FILTERS.map((filter) => {
                const active = selectedFilter === filter;
                return (
                  <SmoothPressable
                    key={filter}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedFilter(filter)}
                    style={[
                      styles.filterChip,
                      { backgroundColor: active ? colors.terracotta : `${colors.sage}CC` },
                    ]}
                  >
                    <Text style={[styles.filterLabel, { color: active ? '#FFFFFF' : colors.taupe }]}>
                      {filter}
                    </Text>
                  </SmoothPressable>
                );
              })}
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel={addingMemory ? 'Close memory form' : 'Add Photos'}
                onPress={addingMemory ? closeMemoryForm : openMemoryForm}
                style={[styles.addButton, { backgroundColor: colors.card }]}
              >
                <Text style={[styles.addLabel, { color: colors.brown }]}>
                  {addingMemory ? 'Close' : 'Add Photos'}
                </Text>
              </SmoothPressable>
            </ScrollView>
          </View>

          {addingMemory && (
            <View style={[styles.memoryForm, { backgroundColor: colors.card }]}>
              <Text style={[styles.formTitle, { color: colors.brown }]}>Preserve a Memory</Text>
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel={memoryMood ? `Mood: ${memoryMood}` : 'Choose mood'}
                accessibilityState={{ expanded: moodPickerExpanded }}
                onPress={() => setMoodPickerExpanded((expanded) => !expanded)}
                style={[styles.moodButton, { borderColor: colors.border }]}
              >
                <Text style={styles.moodEmoji}>{MOODS.find((mood) => mood.id === memoryMood)?.emoji ?? '🌅'}</Text>
                <Text style={[styles.formButtonLabel, { color: colors.taupe }]}>
                  {memoryMood ? MOODS.find((mood) => mood.id === memoryMood)?.label : 'Choose mood'}
                </Text>
                <Ionicons name={moodPickerExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.taupe} />
              </SmoothPressable>
              {moodPickerExpanded && (
                <View style={[styles.moodGrid, { backgroundColor: colors.cream }]}>
                  {MOODS.map((mood) => (
                    <SmoothPressable
                      key={mood.id}
                      accessibilityRole="button"
                      accessibilityLabel={mood.label}
                      accessibilityState={{ selected: memoryMood === mood.id }}
                      onPress={() => {
                        setMemoryMood(mood.id);
                        setMoodPickerExpanded(false);
                      }}
                      style={[
                        styles.moodGridItem,
                        memoryMood === mood.id && { backgroundColor: `${colors.terracotta}30` },
                      ]}
                    >
                      <Text style={styles.moodGridEmoji}>{mood.emoji}</Text>
                    </SmoothPressable>
                  ))}
                </View>
              )}

              <TextInput
                accessibilityLabel="Memory title"
                value={memoryTitle}
                onChangeText={setMemoryTitle}
                maxLength={80}
                placeholder="Memory title *"
                placeholderTextColor={colors.taupe}
                style={[styles.formInput, { backgroundColor: colors.cream, color: colors.brown, borderColor: colors.border }]}
              />
              <TextInput
                accessibilityLabel="Memory description"
                value={memoryDescription}
                onChangeText={setMemoryDescription}
                maxLength={500}
                multiline
                textAlignVertical="top"
                placeholder="Describe this memory in your own words..."
                placeholderTextColor={colors.taupe}
                style={[styles.formInput, styles.descriptionInput, { backgroundColor: colors.cream, color: colors.brown, borderColor: colors.border }]}
              />
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel={`Memory date: ${formatMemoryDate(memoryDate)}`}
                onPress={() => setDatePickerVisible(true)}
                style={[styles.dateButton, { backgroundColor: colors.cream, borderColor: colors.border }]}
              >
                <Text style={[styles.dateLabel, { color: colors.brown }]}>{formatMemoryDate(memoryDate)}</Text>
                <Ionicons name="calendar-outline" size={17} color={colors.taupe} />
              </SmoothPressable>
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel={selectedAssets.length > 0
                  ? `${selectedAssets.length} photos selected`
                  : 'Choose photos from gallery'}
                disabled={importing}
                onPress={() => void choosePhotos()}
                style={[
                  styles.choosePhotosButton,
                  { backgroundColor: `${colors.sage}55`, borderColor: colors.sage, opacity: importing ? 0.65 : 1 },
                ]}
              >
                <Ionicons name="image-outline" size={17} color="#6D9B68" />
                <Text style={styles.choosePhotosLabel}>
                  {importing
                    ? 'Opening gallery…'
                    : selectedAssets.length > 0
                      ? `${selectedAssets.length} photo${selectedAssets.length === 1 ? '' : 's'} selected`
                      : 'Choose photos from gallery'}
                </Text>
              </SmoothPressable>
              <SmoothPressable
                accessibilityRole="button"
                disabled={savingMemory}
                onPress={() => void saveNewMemory()}
                style={[
                  styles.saveMemoryButton,
                  { backgroundColor: colors.terracotta, opacity: savingMemory ? 0.65 : 1 },
                ]}
              >
                <Text style={styles.saveMemoryLabel}>
                  {savingMemory ? 'Saving…' : 'Save Memory'}
                </Text>
              </SmoothPressable>
            </View>
          )}

          {error && (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.terracotta }]}>
              {error}
            </Text>
          )}

          {loading ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyDetail, { color: colors.taupe }]}>Loading your memories…</Text>
            </View>
          ) : filtered.length > 0 ? (
            <View style={styles.grid}>
              {filtered.map((memory) => (
                <PhotoTile
                  key={memory.id}
                  memory={memory}
                  uri={uriById[memory.id] ?? null}
                  colors={colors}
                  onPress={() => showPhoto(memory)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              {selectedFilter === 'Locked' ? (
                <Ionicons name="lock-closed-outline" size={34} color={colors.taupe} />
              ) : memories.length === 0 && selectedFilter === 'All' ? (
                <View style={styles.emptyIcon}>
                  <Ionicons name="camera-outline" size={34} color={colors.terracotta} />
                  <Ionicons name="sparkles" size={12} color={colors.terracotta} style={styles.sparkle} />
                </View>
              ) : (
                <Ionicons
                  name={selectedFilter === 'Archived' ? 'archive-outline' : 'images-outline'}
                  size={34}
                  color={colors.taupe}
                />
              )}
              <Text style={[styles.emptyTitle, { color: colors.brown }]}>
                {selectedFilter === 'All' && memories.length === 0
                  ? 'No memories yet.'
                  : categoryEmptyText}
              </Text>
              <Text style={[styles.emptyDetail, { color: colors.taupe }]}>
                {categoryEmptyDetail}
              </Text>
            </View>
          )}
        </View>
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

      <Modal
        visible={datePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <View style={[styles.dialogBackdrop, { backgroundColor: colors.scrim }]}>
          <View style={[styles.dateDialog, { backgroundColor: colors.card }]}>
            <Text style={[styles.dialogTitle, { color: colors.brown }]}>Memory date</Text>
            <View style={styles.calendarHeader}>
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => setCalendarMonth((month) =>
                  new Date(month.getFullYear(), month.getMonth() - 1, 1)
                )}
                style={styles.monthButton}
              >
                <Ionicons name="chevron-back" size={19} color={colors.brown} />
              </SmoothPressable>
              <Text style={[styles.monthTitle, { color: colors.brown }]}>
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => setCalendarMonth((month) =>
                  new Date(month.getFullYear(), month.getMonth() + 1, 1)
                )}
                style={styles.monthButton}
              >
                <Ionicons name="chevron-forward" size={19} color={colors.brown} />
              </SmoothPressable>
            </View>
            <View style={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text key={`weekday-${index}`} style={[styles.weekday, { color: colors.taupe }]}>
                  {day}
                </Text>
              ))}
              {calendarDays.map((day, index) => {
                if (day === null) return <View key={`blank-${index}`} style={styles.calendarCell} />;
                const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                const selected = dateKey(date) === memoryDate;
                return (
                  <SmoothPressable
                    key={dateKey(date)}
                    accessibilityRole="button"
                    accessibilityLabel={date.toLocaleDateString('en-US', { dateStyle: 'full' })}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setMemoryDate(dateKey(date));
                      setDatePickerVisible(false);
                    }}
                    style={[styles.calendarCell, selected && { backgroundColor: colors.terracotta }]}
                  >
                    <Text style={{ color: selected ? '#FFFFFF' : colors.brown, fontSize: 13 }}>
                      {day}
                    </Text>
                  </SmoothPressable>
                );
              })}
            </View>
            <SmoothPressable
              accessibilityRole="button"
              onPress={() => setDatePickerVisible(false)}
              style={[styles.dialogClose, { borderColor: colors.border }]}
            >
              <Text style={[styles.formButtonLabel, { color: colors.brown }]}>Close</Text>
            </SmoothPressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={selectedPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        {selectedPhoto && (
          <View style={[styles.viewerBackdrop, { backgroundColor: colors.scrim }]}>
            <View style={[styles.viewer, { backgroundColor: colors.card }]}>
              <View style={styles.viewerHeader}>
                <Text numberOfLines={1} style={[styles.viewerFilename, { color: colors.taupe }]}>
                  {selectedPhoto.title || selectedPhoto.name}
                </Text>
                <SmoothPressable
                  accessibilityRole="button"
                  accessibilityLabel="Close photo"
                  onPress={() => setSelectedPhoto(null)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.brown} />
                </SmoothPressable>
              </View>
              {(selectedPhoto.mood || selectedPhoto.memoryDate) && (
                <Text style={[styles.memoryMetadata, { color: colors.taupe }]}>
                  {[selectedPhoto.mood, selectedPhoto.memoryDate && formatMemoryDate(selectedPhoto.memoryDate)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
              <View style={styles.viewerImageArea}>
                {selectedPhoto.localUri ? (
                  <Image
                    source={{ uri: selectedPhoto.localUri }}
                    style={styles.viewerImage}
                    resizeMode="contain"
                    onError={() => setError('This photo could not be displayed.')}
                  />
                ) : (
                  <View style={styles.viewerUnavailable}>
                    <Ionicons name="image-outline" size={42} color={colors.taupe} />
                    <Text style={[styles.emptyDetail, { color: colors.taupe }]}>
                      This photo could not be displayed.
                    </Text>
                  </View>
                )}
              </View>
              <TextInput
                accessibilityLabel="Photo caption"
                value={captionDraft}
                onChangeText={(value) => {
                  setCaptionDraft(value);
                  setCaptionSaved(false);
                }}
                maxLength={240}
                placeholder="Add a caption (optional)"
                placeholderTextColor={colors.taupe}
                style={[
                  styles.captionInput,
                  { color: colors.brown, borderColor: colors.border },
                ]}
              />
              <View style={styles.viewerActions}>
                <SmoothPressable
                  accessibilityRole="button"
                  disabled={captionSaving}
                  onPress={() => void saveCaption()}
                  style={[styles.actionButton, { backgroundColor: colors.terracotta }]}
                >
                  <Text style={styles.actionLabel}>
                    {captionSaved ? 'Caption saved' : captionSaving ? 'Saving…' : 'Save caption'}
                  </Text>
                </SmoothPressable>
                <SmoothPressable
                  accessibilityRole="button"
                  onPress={() => void toggleArchive()}
                  style={[styles.actionButton, { backgroundColor: `${colors.sage}CC` }]}
                >
                  <Ionicons
                    name={selectedPhoto.archived ? 'archive' : 'archive-outline'}
                    size={16}
                    color={colors.brown}
                  />
                  <Text style={[styles.actionText, { color: colors.brown }]}>
                    {selectedPhoto.archived ? 'Unarchive' : 'Archive'}
                  </Text>
                </SmoothPressable>
                <SmoothPressable
                  accessibilityRole="button"
                  onPress={() => requestDelete(selectedPhoto)}
                  style={[styles.actionButton, styles.deleteAction]}
                >
                  <Ionicons name="trash-outline" size={16} color="#A3473F" />
                  <Text style={styles.deleteLabel}>Delete</Text>
                </SmoothPressable>
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

function PhotoTile({
  memory,
  uri,
  colors,
  onPress,
}: {
  memory: PhotoMemory;
  uri: string | null;
  colors: typeof LIGHT;
  onPress: () => void;
}) {
  return (
    <SmoothPressable
      accessibilityRole="button"
      accessibilityLabel={`View photo: ${memory.title || memory.caption || memory.name}`}
      onPress={onPress}
      style={[styles.photoTile, { backgroundColor: colors.placeholder }]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <Ionicons name="image-outline" size={30} color={colors.taupe} />
      )}
      {memory.archived && (
        <View style={styles.archivedBadge}>
          <Ionicons name="archive" size={13} color="#FFFFFF" />
        </View>
      )}
      {!!(memory.title || memory.caption) && (
        <View style={styles.captionOverlay}>
          <Text numberOfLines={1} style={styles.captionOverlayText}>{memory.title || memory.caption}</Text>
        </View>
      )}
    </SmoothPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingBottom: 100 },
  dashboard: { width: '100%', maxWidth: 430, paddingHorizontal: 15 },
  header: { alignItems: 'center', marginTop: 13, marginBottom: 16 },
  headerTitle: { fontFamily: 'serif', fontSize: 21, fontWeight: '600' },
  headerSubtitle: { fontSize: 11, marginTop: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterScroll: { flex: 1 },
  filters: { alignItems: 'center', gap: 6, paddingVertical: 2 },
  filterChip: { height: 28, borderRadius: 14, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  filterLabel: { fontSize: 10, fontWeight: '500' },
  addButton: { height: 36, borderRadius: 13, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  addLabel: { fontSize: 11, fontWeight: '600' },
  memoryForm: { borderRadius: 16, padding: 14, marginTop: 12, gap: 10 },
  formTitle: { fontFamily: 'serif', fontSize: 15, fontWeight: '600' },
  moodButton: { minHeight: 40, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  moodEmoji: { fontSize: 17 },
  moodGrid: { borderRadius: 12, padding: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  moodGridItem: { width: '18.5%', aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  moodGridEmoji: { fontSize: 22 },
  formButtonLabel: { fontSize: 11, fontWeight: '500' },
  formInput: { minHeight: 40, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, fontSize: 12 },
  descriptionInput: { minHeight: 74, paddingTop: 11 },
  dateButton: { minHeight: 39, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateLabel: { fontSize: 12 },
  choosePhotosButton: { minHeight: 42, borderWidth: 1, borderStyle: 'dashed', borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  choosePhotosLabel: { color: '#6D9B68', fontSize: 11, fontWeight: '600' },
  saveMemoryButton: { minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  saveMemoryLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  error: { fontSize: 12, textAlign: 'center', marginTop: 9 },
  emptyState: { minHeight: 340, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  emptyIcon: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  sparkle: { position: 'absolute', top: 0, right: -2 },
  emptyTitle: { fontFamily: 'serif', fontSize: 17, fontWeight: '600', textAlign: 'center', marginTop: 12 },
  emptyDetail: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 17, paddingBottom: 20 },
  photoTile: { flexBasis: '48%', flexGrow: 1, aspectRatio: 1, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbnail: { width: '100%', height: '100%' },
  archivedBadge: { position: 'absolute', right: 8, top: 8, width: 25, height: 25, borderRadius: 13, backgroundColor: 'rgba(72,59,55,0.68)', alignItems: 'center', justifyContent: 'center' },
  captionOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(35,30,27,0.48)', paddingHorizontal: 8, paddingVertical: 6 },
  captionOverlayText: { color: '#FFFFFF', fontSize: 11 },
  chatButtonWrap: { position: 'absolute', bottom: 10, alignSelf: 'center', width: '100%', maxWidth: 430, alignItems: 'flex-end', paddingHorizontal: 16 },
  chatButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#CC806E', elevation: 4, shadowColor: '#483B37', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  viewerBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  viewer: { width: '100%', maxWidth: 430, maxHeight: '92%', borderRadius: 20, padding: 14 },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  viewerFilename: { flex: 1, fontSize: 11 },
  memoryMetadata: { fontSize: 11, marginBottom: 8 },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  viewerImageArea: { width: '100%', height: 330, alignItems: 'center', justifyContent: 'center', borderRadius: 14, overflow: 'hidden', backgroundColor: '#191817' },
  viewerImage: { width: '100%', height: '100%' },
  viewerUnavailable: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  captionInput: { minHeight: 42, borderBottomWidth: 1, fontSize: 13, paddingVertical: 8, marginTop: 10 },
  viewerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  actionButton: { minHeight: 39, flexGrow: 1, flexBasis: '30%', borderRadius: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  actionText: { fontSize: 11, fontWeight: '600' },
  deleteAction: { backgroundColor: '#F1E5E1' },
  deleteLabel: { color: '#A3473F', fontSize: 11, fontWeight: '600' },
  dialogBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  dateDialog: { width: '100%', maxWidth: 360, borderRadius: 20, padding: 18 },
  dialogTitle: { fontFamily: 'serif', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 14, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', height: 34, textAlign: 'center', textAlignVertical: 'center', fontSize: 11, fontWeight: '600' },
  calendarCell: { width: '14.2857%', height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  dialogClose: { minHeight: 38, marginTop: 10, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
