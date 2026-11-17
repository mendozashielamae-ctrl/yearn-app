import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import Storage from 'expo-sqlite/kv-store';
import { newId } from '@/db/client';
import type { MemoryDetails, PhotoMemory } from './types';

const MEMORIES_KEY = 'yearnPhotoMemories';
const PHOTO_DIRECTORY = `${FileSystem.documentDirectory}memories/`;

function isMemory(value: unknown): value is PhotoMemory {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'id' in value && typeof value.id === 'string' &&
    'name' in value && typeof value.name === 'string' &&
    'mimeType' in value && typeof value.mimeType === 'string' &&
    'createdAt' in value && typeof value.createdAt === 'string' &&
    'caption' in value && typeof value.caption === 'string' &&
    'archived' in value && typeof value.archived === 'boolean' &&
    (!('title' in value) || typeof value.title === 'string') &&
    (!('description' in value) || typeof value.description === 'string') &&
    (!('mood' in value) || typeof value.mood === 'string') &&
    (!('memoryDate' in value) || typeof value.memoryDate === 'string') &&
    'uri' in value && typeof value.uri === 'string'
  );
}

export async function loadMemories(): Promise<PhotoMemory[]> {
  const stored = await Storage.getItem(MEMORIES_KEY);
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isMemory)) {
    throw new Error('Saved photo data is invalid.');
  }
  return parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function selectMemoryPhotos(): Promise<ImagePicker.ImagePickerAsset[] | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Allow photo library access to add memories.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 30,
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets;
}

export async function saveMemoryPhotos(
  assets: ImagePicker.ImagePickerAsset[],
  details: MemoryDetails
): Promise<{ memories: PhotoMemory[]; rejected: number }> {
  await FileSystem.makeDirectoryAsync(PHOTO_DIRECTORY, { intermediates: true });
  const existing = await loadMemories();
  const added: PhotoMemory[] = [];
  let rejected = 0;
  for (const asset of assets) {
    if (!asset.mimeType?.toLowerCase().startsWith('image/')) {
      rejected++;
      continue;
    }
    const id = newId();
    const extension = asset.fileName?.split('.').pop()?.toLowerCase();
    const safeExtension = extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : 'img';
    const uri = `${PHOTO_DIRECTORY}${id}.${safeExtension}`;
    try {
      const source = await FileSystem.getInfoAsync(asset.uri);
      if (!source.exists || (source.size !== undefined && source.size <= 0)) {
        rejected++;
        continue;
      }
      await FileSystem.copyAsync({ from: asset.uri, to: uri });
      added.push({
        id,
        name: asset.fileName ?? `Photo ${new Date().toLocaleDateString()}`,
        mimeType: asset.mimeType,
        createdAt: new Date(`${details.memoryDate}T12:00:00`).toISOString(),
        caption: details.description,
        archived: false,
        title: details.title,
        description: details.description,
        mood: details.mood,
        memoryDate: details.memoryDate,
        uri,
      });
    } catch (error) {
      console.warn('Unable to copy selected photo:', error);
      rejected++;
    }
  }
  if (added.length === 0) {
    return { memories: [], rejected };
  }
  try {
    await Storage.setItemAsync(MEMORIES_KEY, JSON.stringify([...added, ...existing]));
  } catch (error) {
    await Promise.all(added.flatMap((memory) =>
      memory.uri ? [FileSystem.deleteAsync(memory.uri, { idempotent: true })] : []
    ));
    throw error;
  }
  return { memories: added, rejected };
}

export async function getMemoryUri(memory: PhotoMemory): Promise<string> {
  if (!memory.uri) throw new Error('This photo is no longer available.');
  const info = await FileSystem.getInfoAsync(memory.uri);
  if (!info.exists || (info.size !== undefined && info.size <= 0)) {
    throw new Error('This photo could not be found on this device.');
  }
  return memory.uri;
}

export function releaseMemoryUri(_uri: string): void {}

export async function updateMemory(
  id: string,
  changes: Partial<Pick<PhotoMemory, 'caption' | 'archived'>>
): Promise<PhotoMemory[]> {
  const memories = await loadMemories();
  if (!memories.some((memory) => memory.id === id)) {
    throw new Error('This photo is no longer in your gallery.');
  }
  const updated = memories.map((memory) =>
    memory.id === id ? { ...memory, ...changes } : memory
  );
  await Storage.setItemAsync(MEMORIES_KEY, JSON.stringify(updated));
  return updated;
}

export async function deleteMemory(memory: PhotoMemory): Promise<void> {
  const memories = await loadMemories();
  await Storage.setItemAsync(
    MEMORIES_KEY,
    JSON.stringify(memories.filter((item) => item.id !== memory.id))
  );
  if (memory.uri) await FileSystem.deleteAsync(memory.uri, { idempotent: true });
}

export async function clearMemories(): Promise<void> {
  await FileSystem.deleteAsync(PHOTO_DIRECTORY, { idempotent: true });
  await Storage.removeItem(MEMORIES_KEY);
}
