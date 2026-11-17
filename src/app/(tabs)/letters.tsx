import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { useIsDarkTheme } from '@/theme';
import {
  deleteLetter,
  loadLetters,
  saveLetter,
  type Letter,
  type LetterCategory,
} from '@/settings/storage';
import { confirmAction } from '@/utils/confirm';

const COLORS = {
  aqua: '#BCE9E6',
  sage: '#D5DEC4',
  cream: '#F7F3E9',
  brown: '#483B37',
  taupe: '#9F8D83',
  terracotta: '#BF8775',
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
  border: '#514A43',
  input: '#3D3934',
};
const LIGHT_COLORS = { ...COLORS, border: '#E7DDD2', input: '#FFFFFF' };

const LETTER_CATEGORIES: LetterCategory[] = [
  'Never Said',
  'Questions',
  'Anger',
  'Gratitude',
  'Goodbye',
];
const CATEGORIES = ['All', ...LETTER_CATEGORIES] as const;

const CATEGORY_COLORS: Record<LetterCategory, { background: string; text: string }> = {
  'Never Said': { background: '#E8DED4', text: '#77665C' },
  Questions: { background: '#E5E5E2', text: '#777771' },
  Gratitude: { background: '#DDE9D7', text: '#68805F' },
  Anger: { background: '#F0D8CD', text: '#A36E5D' },
  Goodbye: { background: '#E5DDED', text: '#796C8C' },
};

function formatDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Saved locally';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function makeLetterId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function LettersScreen() {
  const router = useRouter();
  const isDark = useIsDarkTheme();
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLetter, setEditingLetter] = useState<Letter | null>(null);
  const [readingLetter, setReadingLetter] = useState<Letter | null>(null);
  const [menuLetter, setMenuLetter] = useState<Letter | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<LetterCategory>('Never Said');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refreshLetters = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setLetters(await loadLetters());
    } catch (error) {
      console.warn('Unable to load saved letters:', error);
      setLoadError(error instanceof Error ? error.message : 'Unable to load your letters.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshLetters();
    }, [refreshLetters])
  );

  const filteredLetters = useMemo(
    () => selectedCategory === 'All'
      ? letters
      : letters.filter((letter) => letter.category === selectedCategory),
    [letters, selectedCategory]
  );

  const openNewLetter = () => {
    setEditingLetter(null);
    setTitle('');
    setBody('');
    setCategory('Never Said');
    setSaveError(null);
    setEditorOpen(true);
  };

  const openEditor = (letter: Letter | null) => {
    setEditingLetter(letter);
    setTitle(letter?.title ?? '');
    setBody(letter?.body ?? '');
    setCategory(letter?.category ?? 'Never Said');
    setSaveError(null);
    setReadingLetter(null);
    setMenuLetter(null);
    setEditorOpen(true);
  };

  const saveCurrentLetter = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody || saving) return;

    setSaving(true);
    setSaveError(null);
    const now = new Date().toISOString();
    const savedLetter: Letter = {
      id: editingLetter?.id ?? makeLetterId(),
      title: trimmedTitle,
      body: trimmedBody,
      category,
      createdAt: editingLetter?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await saveLetter(savedLetter);
      setLetters((previous) =>
        [savedLetter, ...previous.filter((letter) => letter.id !== savedLetter.id)]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      );
      setEditorOpen(false);
    } catch (error) {
      console.warn('Unable to save letter:', error);
      setSaveError(error instanceof Error ? error.message : 'Unable to save this letter.');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (letter: Letter) => {
    setMenuLetter(null);
    confirmAction(
      'Delete letter?',
      `“${letter.title}” will be permanently removed from this device.`,
      'Delete',
      async () => {
        await deleteLetter(letter.id);
        setLetters((previous) => previous.filter((item) => item.id !== letter.id));
        setReadingLetter((current) => current?.id === letter.id ? null : current);
      }
    );
  };

  const openChat = () => router.push('/chat' as Href);

  return (
    <View style={[styles.screen, { backgroundColor: colors.sage }]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="lettersBackground" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.aqua} />
            <Stop offset="0.62" stopColor={colors.sage} />
            <Stop offset="1" stopColor={colors.cream} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#lettersBackground)" />
      </Svg>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.dashboard}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.brown }]}>Un-Sent Letters</Text>
            <Text style={[styles.headerSubtitle, { color: colors.taupe }]}>A space for everything you never said.</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {CATEGORIES.map((item) => {
              const selected = selectedCategory === item;
              return (
                <SmoothPressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedCategory(item)}
                  style={[styles.filterChip, selected ? styles.selectedFilter : [styles.inactiveFilter, { backgroundColor: isDark ? '#45483F' : 'rgba(229, 235, 218, 0.88)' }]]}
                >
                  <Text style={[styles.filterLabel, { color: selected ? '#FFFFFF' : colors.taupe }]}>
                    {item}
                  </Text>
                </SmoothPressable>
              );
            })}
          </ScrollView>

          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="Write a Letter"
            onPress={openNewLetter}
            style={styles.writeButton}
          >
            <Text style={styles.writeButtonLabel}>+ Write a Letter</Text>
          </SmoothPressable>

          {loading ? (
            <Text style={[styles.statusText, { color: colors.taupe }]}>Loading your letters…</Text>
          ) : loadError ? (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={28} color={colors.terracotta} />
              <Text style={[styles.emptyTitle, { color: colors.brown }]}>Your letters couldn’t be loaded.</Text>
              <Text style={[styles.emptySubtitle, { color: colors.taupe }]}>{loadError}</Text>
              <SmoothPressable accessibilityRole="button" onPress={() => void refreshLetters()} style={styles.retryButton}>
                <Text style={[styles.retryLabel, { color: colors.brown }]}>Try again</Text>
              </SmoothPressable>
            </View>
          ) : filteredLetters.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-open-outline" size={30} color={colors.terracotta} />
              <Text style={[styles.emptyTitle, { color: colors.brown }]}>
                {letters.length === 0 ? 'Your page is waiting.' : 'No letters in this category yet.'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.taupe }]}>
                {letters.length === 0
                  ? 'Write your first letter and let the words be just for you.'
                  : 'Choose another category or write a new letter.'}
              </Text>
            </View>
          ) : (
            <View style={styles.letterList}>
              {filteredLetters.map((letter) => (
                <LetterCard
                  key={letter.id}
                  letter={letter}
                  colors={colors}
                  onPress={() => setReadingLetter(letter)}
                  onMenu={() => setMenuLetter(letter)}
                />
              ))}
            </View>
          )}

          <Text style={[styles.footer, { color: colors.taupe }]}>These letters are for you, not for them. ♡</Text>
        </View>
      </ScrollView>

      <View pointerEvents="box-none" style={styles.chatButtonWrap}>
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel="Open AI chat"
          onPress={openChat}
          style={styles.chatButton}
        >
          <Ionicons name="chatbubble-outline" size={23} color="#FFFFFF" />
        </SmoothPressable>
      </View>

      <Modal
        visible={editorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditorOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.editor, { backgroundColor: colors.card }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.editorContent}
            >
              <Text style={[styles.editorTitle, { color: colors.brown }]}>
                {editingLetter ? 'Edit your letter' : 'Write a letter'}
              </Text>
              <Text style={[styles.fieldLabel, { color: colors.brown }]}>Title</Text>
              <TextInput
                accessibilityLabel="Letter title"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                placeholder="Give your letter a title"
                placeholderTextColor={colors.taupe}
                style={[styles.titleInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.brown }]}
                returnKeyType="next"
              />
              <Text style={[styles.fieldLabel, { color: colors.brown }]}>Category</Text>
              <View style={styles.editorCategories}>
                {LETTER_CATEGORIES.map((item) => (
                  <SmoothPressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: category === item }}
                    onPress={() => setCategory(item)}
                    style={[
                      styles.editorCategory,
                      { backgroundColor: colors.input },
                      category === item && styles.editorCategorySelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.editorCategoryLabel,
                        { color: colors.taupe },
                        category === item && styles.editorCategoryLabelSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </SmoothPressable>
                ))}
              </View>
              <Text style={[styles.fieldLabel, { color: colors.brown }]}>Your letter</Text>
              <TextInput
                accessibilityLabel="Letter body"
                value={body}
                onChangeText={setBody}
                multiline
                textAlignVertical="top"
                placeholder="Write whatever you need to say…"
                placeholderTextColor={colors.taupe}
                style={[styles.bodyInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.brown }]}
              />
              <Text style={[styles.localNote, { color: colors.taupe }]}>Saved on this device only.</Text>
              {saveError && <Text accessibilityLiveRegion="polite" style={styles.saveError}>{saveError}</Text>}
              <View style={styles.editorActions}>
                <SmoothPressable
                  accessibilityRole="button"
                  onPress={() => setEditorOpen(false)}
                  disabled={saving}
                  style={[styles.editorAction, styles.cancelAction, { backgroundColor: colors.input }]}
                >
                  <Text style={[styles.cancelLabel, { color: colors.taupe }]}>Cancel</Text>
                </SmoothPressable>
                <SmoothPressable
                  accessibilityRole="button"
                  accessibilityLabel="Save letter"
                  onPress={() => void saveCurrentLetter()}
                  disabled={!title.trim() || !body.trim() || saving}
                  style={[
                    styles.editorAction,
                    styles.saveAction,
                    (!title.trim() || !body.trim() || saving) && styles.disabledAction,
                  ]}
                >
                  <Text style={styles.saveLabel}>{saving ? 'Saving…' : 'Save'}</Text>
                </SmoothPressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={readingLetter !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReadingLetter(null)}
      >
        {readingLetter && (
          <View style={styles.modalBackdrop}>
            <View style={[styles.reader, { backgroundColor: colors.card }]}>
              <View style={styles.readerHeader}>
                <Text style={[styles.readerDate, { color: colors.taupe }]}>{formatDate(readingLetter.createdAt)}</Text>
                <SmoothPressable
                  accessibilityRole="button"
                  accessibilityLabel="Close letter"
                  onPress={() => setReadingLetter(null)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={22} color={colors.taupe} />
                </SmoothPressable>
              </View>
              <Text style={[styles.readerTitle, { color: colors.brown }]}>{readingLetter.title}</Text>
              <CategoryBadge category={readingLetter.category} />
              <ScrollView style={styles.readerBodyScroll}>
                <Text style={[styles.readerBody, { color: colors.brown }]}>{readingLetter.body}</Text>
              </ScrollView>
              <SmoothPressable
                accessibilityRole="button"
                onPress={() => openEditor(readingLetter)}
                style={styles.readerEditButton}
              >
                <Ionicons name="create-outline" size={19} color="#FFFFFF" />
                <Text style={styles.saveLabel}>Edit letter</Text>
              </SmoothPressable>
            </View>
          </View>
        )}
      </Modal>

      <Modal
        visible={menuLetter !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuLetter(null)}
      >
        {menuLetter && (
          <View style={styles.modalBackdrop}>
            <View style={[styles.menu, { backgroundColor: colors.card }]}>
              <Text style={[styles.menuTitle, { color: colors.brown }]} numberOfLines={2}>{menuLetter.title}</Text>
              <SmoothPressable
                accessibilityRole="button"
                onPress={() => openEditor(menuLetter)}
                style={styles.menuAction}
              >
                <Ionicons name="create-outline" size={20} color={colors.brown} />
                <Text style={[styles.menuLabel, { color: colors.brown }]}>Edit</Text>
              </SmoothPressable>
              <SmoothPressable
                accessibilityRole="button"
                onPress={() => requestDelete(menuLetter)}
                style={styles.menuAction}
              >
                <Ionicons name="trash-outline" size={20} color="#A3473F" />
                <Text style={styles.deleteLabel}>Delete</Text>
              </SmoothPressable>
              <SmoothPressable
                accessibilityRole="button"
                onPress={() => setMenuLetter(null)}
                style={styles.menuCancel}
              >
                <Text style={[styles.cancelLabel, { color: colors.taupe }]}>Cancel</Text>
              </SmoothPressable>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

function LetterCard({
  letter,
  colors,
  onPress,
  onMenu,
}: {
  letter: Letter;
  colors: typeof DARK_COLORS | typeof LIGHT_COLORS;
  onPress: () => void;
  onMenu: () => void;
}) {
  return (
    <View style={[styles.letterCard, { backgroundColor: colors.card }]}>
      <SmoothPressable
        accessibilityRole="button"
        accessibilityLabel={`Read ${letter.title}`}
        onPress={onPress}
        style={styles.letterContent}
      >
        <View style={styles.envelopeIcon}>
          <Ionicons name="mail-outline" size={20} color={colors.terracotta} />
        </View>
        <View style={styles.letterCopy}>
          <Text numberOfLines={2} style={[styles.letterTitle, { color: colors.brown }]}>{letter.title}</Text>
          <View style={styles.letterMetadata}>
            <Text style={[styles.letterDate, { color: colors.taupe }]}>{formatDate(letter.createdAt)}</Text>
            <CategoryBadge category={letter.category} />
          </View>
        </View>
      </SmoothPressable>
      <SmoothPressable
        accessibilityRole="button"
        accessibilityLabel={`More options for ${letter.title}`}
        onPress={onMenu}
        style={styles.moreButton}
      >
        <Ionicons name="ellipsis-vertical" size={19} color={colors.taupe} />
      </SmoothPressable>
    </View>
  );
}

function CategoryBadge({ category }: { category: LetterCategory }) {
  const colors = CATEGORY_COLORS[category];
  return (
    <View style={[styles.categoryBadge, { backgroundColor: colors.background }]}>
      <Text style={[styles.categoryBadgeLabel, { color: colors.text }]}>{category}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.sage },
  scroll: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingBottom: 100 },
  dashboard: { width: '100%', maxWidth: 430, paddingHorizontal: 16 },
  header: { alignItems: 'center', marginTop: 11, marginBottom: 15 },
  headerTitle: { color: COLORS.brown, fontFamily: 'serif', fontSize: 21, fontWeight: '600' },
  headerSubtitle: { color: COLORS.taupe, fontSize: 11, marginTop: 3 },
  filters: { alignItems: 'center', gap: 7, paddingBottom: 2 },
  filterChip: { height: 27, borderRadius: 14, paddingHorizontal: 12, justifyContent: 'center' },
  selectedFilter: { backgroundColor: COLORS.terracotta },
  inactiveFilter: { backgroundColor: 'rgba(229, 235, 218, 0.88)' },
  filterLabel: { fontSize: 11, fontWeight: '500' },
  writeButton: { height: 44, borderRadius: 15, backgroundColor: COLORS.terracotta, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  writeButtonLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  statusText: { color: COLORS.taupe, fontSize: 13, textAlign: 'center', marginTop: 34 },
  letterList: { gap: 11, marginTop: 15 },
  letterCard: { minHeight: 68, borderRadius: 16, backgroundColor: COLORS.card, flexDirection: 'row', alignItems: 'center', paddingLeft: 11, paddingRight: 5 },
  letterContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  envelopeIcon: { width: 38, height: 38, flexShrink: 0, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2E3DF' },
  letterCopy: { flex: 1, minWidth: 0, gap: 5 },
  letterTitle: { color: COLORS.brown, fontFamily: 'serif', fontSize: 14, fontWeight: '600' },
  letterMetadata: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  letterDate: { color: COLORS.taupe, fontSize: 10 },
  categoryBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  categoryBadgeLabel: { fontSize: 9, fontWeight: '500' },
  moreButton: { width: 34, height: 42, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  emptyState: { minHeight: 190, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25, marginTop: 10 },
  emptyTitle: { color: COLORS.brown, fontFamily: 'serif', fontSize: 17, fontWeight: '600', textAlign: 'center', marginTop: 10 },
  emptySubtitle: { color: COLORS.taupe, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  retryButton: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F1E7DD' },
  retryLabel: { color: COLORS.brown, fontSize: 12, fontWeight: '600' },
  footer: { color: COLORS.taupe, fontFamily: 'serif', fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 27, marginBottom: 10 },
  chatButtonWrap: { position: 'absolute', bottom: 10, alignSelf: 'center', width: '100%', maxWidth: 430, alignItems: 'flex-end', paddingHorizontal: 16 },
  chatButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#CC806E', elevation: 4, shadowColor: '#483B37', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(35, 30, 27, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  editor: { width: '100%', maxWidth: 430, maxHeight: '92%', borderRadius: 22, backgroundColor: COLORS.card, padding: 18 },
  editorContent: { paddingBottom: 4 },
  editorTitle: { color: COLORS.brown, fontFamily: 'serif', fontSize: 21, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  fieldLabel: { color: COLORS.brown, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  titleInput: { minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: '#E7DDD2', paddingHorizontal: 12, color: COLORS.brown, fontSize: 14, marginBottom: 14 },
  editorCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  editorCategory: { borderRadius: 12, backgroundColor: '#ECEBE5', paddingHorizontal: 10, paddingVertical: 7 },
  editorCategorySelected: { backgroundColor: COLORS.terracotta },
  editorCategoryLabel: { color: COLORS.taupe, fontSize: 10 },
  editorCategoryLabelSelected: { color: '#FFFFFF', fontWeight: '600' },
  bodyInput: { minHeight: 170, maxHeight: 300, borderRadius: 12, borderWidth: 1, borderColor: '#E7DDD2', padding: 12, color: COLORS.brown, fontSize: 14, lineHeight: 21 },
  localNote: { color: COLORS.taupe, fontSize: 10, marginTop: 7 },
  saveError: { color: '#A3473F', fontSize: 12, marginTop: 7 },
  editorActions: { flexDirection: 'row', gap: 10, marginTop: 17 },
  editorAction: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelAction: { backgroundColor: '#EEEAE3' },
  cancelLabel: { color: COLORS.taupe, fontSize: 13, fontWeight: '600' },
  saveAction: { backgroundColor: COLORS.terracotta },
  disabledAction: { opacity: 0.55 },
  saveLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  reader: { width: '100%', maxWidth: 430, maxHeight: '85%', borderRadius: 22, backgroundColor: COLORS.card, padding: 20 },
  readerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readerDate: { color: COLORS.taupe, fontSize: 11 },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  readerTitle: { color: COLORS.brown, fontFamily: 'serif', fontSize: 22, fontWeight: '600', marginTop: 7, marginBottom: 10 },
  readerBodyScroll: { marginTop: 15, marginBottom: 15 },
  readerBody: { color: COLORS.brown, fontFamily: 'serif', fontSize: 15, lineHeight: 24 },
  readerEditButton: { height: 44, borderRadius: 14, backgroundColor: COLORS.terracotta, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  menu: { width: '100%', maxWidth: 360, borderRadius: 20, backgroundColor: COLORS.card, padding: 17 },
  menuTitle: { color: COLORS.brown, fontFamily: 'serif', fontSize: 16, fontWeight: '600', marginBottom: 9 },
  menuAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuLabel: { color: COLORS.brown, fontSize: 14 },
  deleteLabel: { color: '#A3473F', fontSize: 14 },
  menuCancel: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7DDD2' },
});
