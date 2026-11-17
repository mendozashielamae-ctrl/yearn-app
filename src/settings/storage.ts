import Storage from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ProviderId = 'cloud' | 'local';
export type LocalBackend = 'auto' | 'npu' | 'gpu' | 'cpu';
export type ThemeMode = 'light' | 'dark' | 'system';

const KEYS = {
  provider: 'provider',
  geminiModel: 'geminiModel',
  localBackend: 'localBackend',
  systemPrompt: 'systemPrompt',
  nickname: 'nickname',
  onboarded: 'onboarded',
  theme: 'theme',
  modelResumeData: 'modelResumeData',
  dailyCheckIn: 'dailyCheckIn',
  healingJourneyCheckIn: 'healingJourneyCheckIn',
  healingCheckInDates: 'healingCheckInDates',
  letters: 'letters',
  healingStartDate: 'healingStartDate',
  profileAvatarUri: 'profileAvatarUri',
} as const;

const API_KEY_KEY = 'gemini_api_key';

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.';
/** 'auto' = pick the best model the API key can use (see pickBestModel). */
export const DEFAULT_GEMINI_MODEL = 'auto';

export interface Settings {
  provider: ProviderId;
  geminiApiKey: string;
  geminiModel: string;
  localBackend: LocalBackend;
  systemPrompt: string;
  nickname: string;
  healingStartDate: string;
  profileAvatarUri: string;
  onboarded: boolean;
  theme: ThemeMode;
}

export type Mood = 'calm' | 'hopeful' | 'sad' | 'strong';
export type JourneyMood = 'good' | 'okay' | 'sad' | 'heavy' | 'healing';
export type JourneyNeed = 'rest' | 'cry' | 'write' | 'listen' | 'distract' | 'remind myself';
export interface HealingJourneyCheckIn {
  date: string;
  mood: JourneyMood;
  needs: JourneyNeed[];
}
export type LetterCategory = 'Never Said' | 'Questions' | 'Anger' | 'Gratitude' | 'Goodbye';

export interface Letter {
  id: string;
  title: string;
  body: string;
  category: LetterCategory;
  createdAt: string;
  updatedAt: string;
}

function isMood(value: unknown): value is Mood {
  return value === 'calm' || value === 'hopeful' || value === 'sad' || value === 'strong';
}

function isLetterCategory(value: unknown): value is LetterCategory {
  return (
    value === 'Never Said' ||
    value === 'Questions' ||
    value === 'Anger' ||
    value === 'Gratitude' ||
    value === 'Goodbye'
  );
}

function isLetter(value: unknown): value is Letter {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('id' in value) ||
    !('title' in value) ||
    !('body' in value) ||
    !('category' in value) ||
    !('createdAt' in value) ||
    !('updatedAt' in value)
  ) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.body === 'string' &&
    isLetterCategory(value.category) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

export async function loadLetters(): Promise<Letter[]> {
  const stored = await Storage.getItem(KEYS.letters);
  if (!stored) return [];
  const value: unknown = JSON.parse(stored);
  if (!Array.isArray(value) || !value.every(isLetter)) {
    throw new Error('Saved letters are in an unrecognized format.');
  }
  return value.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveLetter(letter: Letter): Promise<void> {
  const letters = await loadLetters();
  const existingIndex = letters.findIndex((item) => item.id === letter.id);
  if (existingIndex === -1) letters.push(letter);
  else letters[existingIndex] = letter;
  await Storage.setItemAsync(KEYS.letters, JSON.stringify(letters));
}

export async function deleteLetter(id: string): Promise<void> {
  const letters = await loadLetters();
  await Storage.setItemAsync(
    KEYS.letters,
    JSON.stringify(letters.filter((letter) => letter.id !== id))
  );
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'cloud',
  geminiApiKey: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  localBackend: 'auto',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  nickname: '',
  healingStartDate: '',
  profileAvatarUri: '',
  onboarded: false,
  theme: 'light',
};

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getTodayCheckIn(): Promise<Mood | null> {
  const stored = await Storage.getItem(KEYS.dailyCheckIn);
  if (!stored) return null;
  const value: unknown = JSON.parse(stored);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('date' in value) ||
    !('mood' in value) ||
    value.date !== localDateKey() ||
    !isMood(value.mood)
  ) return null;
  return value.mood;
}

export async function saveTodayCheckIn(mood: Mood): Promise<void> {
  await Storage.setItemAsync(
    KEYS.dailyCheckIn,
    JSON.stringify({ date: localDateKey(), mood })
  );
  await recordHealingCheckInDate();
}

const JOURNEY_MOODS: JourneyMood[] = ['good', 'okay', 'sad', 'heavy', 'healing'];
const JOURNEY_NEEDS: JourneyNeed[] = ['rest', 'cry', 'write', 'listen', 'distract', 'remind myself'];

export async function getTodayHealingJourneyCheckIn(): Promise<HealingJourneyCheckIn | null> {
  const stored = await Storage.getItem(KEYS.healingJourneyCheckIn);
  if (!stored) return null;
  const value: unknown = JSON.parse(stored);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('date' in value) ||
    !('mood' in value) ||
    !('needs' in value) ||
    value.date !== localDateKey() ||
    typeof value.mood !== 'string' ||
    !JOURNEY_MOODS.includes(value.mood as JourneyMood) ||
    !Array.isArray(value.needs) ||
    !value.needs.every((need: unknown) =>
      typeof need === 'string' && JOURNEY_NEEDS.includes(need as JourneyNeed)
    )
  ) return null;
  return value as HealingJourneyCheckIn;
}

export async function saveTodayHealingJourneyCheckIn(
  mood: JourneyMood,
  needs: JourneyNeed[]
): Promise<void> {
  await Storage.setItemAsync(
    KEYS.healingJourneyCheckIn,
    JSON.stringify({ date: localDateKey(), mood, needs })
  );
  await recordHealingCheckInDate();
}

async function recordHealingCheckInDate(): Promise<void> {
  const stored = await Storage.getItem(KEYS.healingCheckInDates);
  const dates: unknown = stored ? JSON.parse(stored) : [];
  if (!Array.isArray(dates) || !dates.every(isLocalDate)) {
    throw new Error('Saved healing check-in history is invalid.');
  }
  const today = localDateKey();
  if (!dates.includes(today)) {
    await Storage.setItemAsync(KEYS.healingCheckInDates, JSON.stringify([...dates, today]));
  }
}

export async function getHealingCheckInCount(): Promise<number> {
  const stored = await Storage.getItem(KEYS.healingCheckInDates);
  if (!stored) {
    const [homeCheckIn, journeyCheckIn] = await Promise.all([
      getTodayCheckIn(),
      getTodayHealingJourneyCheckIn(),
    ]);
    return homeCheckIn || journeyCheckIn ? 1 : 0;
  }
  const dates: unknown = JSON.parse(stored);
  if (!Array.isArray(dates) || !dates.every(isLocalDate)) {
    throw new Error('Saved healing check-in history is invalid.');
  }
  return new Set(dates).size;
}

export async function loadSettings(): Promise<Settings> {
  const [provider, geminiModel, localBackend, systemPrompt, nickname, onboarded, theme, apiKey, healingStartDate, profileAvatarUri] =
    await Promise.all([
      Storage.getItem(KEYS.provider),
      Storage.getItem(KEYS.geminiModel),
      Storage.getItem(KEYS.localBackend),
      Storage.getItem(KEYS.systemPrompt),
      Storage.getItem(KEYS.nickname),
      Storage.getItem(KEYS.onboarded),
      Storage.getItem(KEYS.theme),
      Platform.OS === 'web'
        ? Promise.resolve(typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(API_KEY_KEY))
        : SecureStore.getItemAsync(API_KEY_KEY),
      Storage.getItem(KEYS.healingStartDate),
      Storage.getItem(KEYS.profileAvatarUri),
    ]);
  return {
    provider: provider === 'local' ? 'local' : 'cloud',
    geminiApiKey: apiKey ?? '',
    geminiModel: geminiModel || DEFAULT_GEMINI_MODEL,
    localBackend:
      localBackend === 'npu' || localBackend === 'gpu' || localBackend === 'cpu'
        ? localBackend
        : 'auto',
    systemPrompt: systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    nickname: nickname ?? '',
    healingStartDate: isLocalDate(healingStartDate) ? healingStartDate : '',
    profileAvatarUri: profileAvatarUri ?? '',
    onboarded: onboarded === 'true',
    theme: theme === 'dark' || theme === 'system' ? theme : 'light',
  };
}

export async function saveSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): Promise<void> {
  switch (key) {
    case 'geminiApiKey':
      // Browser keys live in this tab's session only; native keys use SecureStore.
      if (Platform.OS === 'web') {
        if (value) sessionStorage.setItem(API_KEY_KEY, value as string);
        else sessionStorage.removeItem(API_KEY_KEY);
        return;
      }
      if (value) {
        await SecureStore.setItemAsync(API_KEY_KEY, value as string);
      } else {
        await SecureStore.deleteItemAsync(API_KEY_KEY);
      }
      return;
    case 'provider':
      return Storage.setItemAsync(KEYS.provider, value as string);
    case 'geminiModel':
      return Storage.setItemAsync(KEYS.geminiModel, value as string);
    case 'localBackend':
      return Storage.setItemAsync(KEYS.localBackend, value as string);
    case 'systemPrompt':
      return Storage.setItemAsync(KEYS.systemPrompt, value as string);
    case 'nickname':
      return Storage.setItemAsync(KEYS.nickname, value as string);
    case 'healingStartDate':
      if (value) return Storage.setItemAsync(KEYS.healingStartDate, value as string);
      await Storage.removeItemAsync(KEYS.healingStartDate);
      return;
    case 'profileAvatarUri':
      if (value) return Storage.setItemAsync(KEYS.profileAvatarUri, value as string);
      await Storage.removeItemAsync(KEYS.profileAvatarUri);
      return;
    case 'onboarded':
      return Storage.setItemAsync(KEYS.onboarded, String(value));
    case 'theme':
      return Storage.setItemAsync(KEYS.theme, value as string);
  }
}

/** Pause/resume state for an interrupted model download (opaque JSON). */
/** Erase every saved setting (including the API key). */
export async function resetSettings(): Promise<void> {
  await Storage.clearAsync();
  await saveSetting('geminiApiKey', '');
}

export async function clearLetters(): Promise<void> {
  await Storage.removeItemAsync(KEYS.letters);
}

export async function resetProfilePreferences(): Promise<void> {
  await Promise.all([
    Storage.removeItemAsync(KEYS.nickname),
    Storage.removeItemAsync(KEYS.healingStartDate),
    Storage.removeItemAsync(KEYS.profileAvatarUri),
    Storage.removeItemAsync(KEYS.dailyCheckIn),
    Storage.removeItemAsync(KEYS.healingJourneyCheckIn),
    Storage.removeItemAsync(KEYS.healingCheckInDates),
    Storage.setItemAsync(KEYS.theme, 'light'),
  ]);
}

export function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function healingDay(startDate: string, today = new Date()): number | null {
  if (!isLocalDate(startDate)) return null;
  const [year, month, day] = startDate.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(1, Math.floor((current - start) / 86_400_000) + 1);
}

/** System prompt sent to the AI, personalised with the user's nickname. */
export function buildSystemPrompt(settings: Settings): string {
  const name = settings.nickname.trim();
  return name
    ? `${settings.systemPrompt}\nThe user's name is ${name}.`.trim()
    : settings.systemPrompt;
}

export async function getModelResumeData(): Promise<string | null> {
  return Storage.getItem(KEYS.modelResumeData);
}

export async function setModelResumeData(data: string | null): Promise<void> {
  if (data) {
    await Storage.setItemAsync(KEYS.modelResumeData, data);
  } else {
    await Storage.removeItemAsync(KEYS.modelResumeData);
  }
}
