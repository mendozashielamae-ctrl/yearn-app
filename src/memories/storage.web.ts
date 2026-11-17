import * as ImagePicker from 'expo-image-picker';
import Storage from 'expo-sqlite/kv-store';
import { newId } from '@/db/client';
import type { MemoryDetails, PhotoMemory } from './types';

const MEMORIES_KEY = 'yearnPhotoMemories';
const DATABASE_NAME = 'yearn-photo-memories';
const IMAGE_STORE = 'images';
const MEMORY_STORE = 'memories';
const MEMORY_RECORD_KEY = 'all';
const objectUrls = new Map<string, string>();

function openImageDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Persistent photo storage is unavailable in this browser.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IMAGE_STORE)) {
        database.createObjectStore(IMAGE_STORE);
      }
      if (!database.objectStoreNames.contains(MEMORY_STORE)) {
        database.createObjectStore(MEMORY_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open photo storage.'));
    request.onblocked = () => reject(new Error('Photo storage is blocked by another browser tab.'));
  });
}

async function runImageStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
  storeName = IMAGE_STORE
): Promise<T> {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    let result: T;
    let succeeded = false;
    request.onsuccess = () => {
      result = request.result;
      succeeded = true;
    };
    request.onerror = () => reject(request.error ?? new Error('Photo storage request failed.'));
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Photo storage was interrupted.'));
    };
    transaction.oncomplete = () => {
      database.close();
      if (succeeded) resolve(result);
      else reject(new Error('Photo storage request did not complete.'));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Photo storage transaction failed.'));
    };
  });
}

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
    !('uri' in value)
  );
}

export async function loadMemories(): Promise<PhotoMemory[]> {
  let stored = await runImageStore<string | undefined>(
    'readonly',
    (store) => store.get(MEMORY_RECORD_KEY),
    MEMORY_STORE
  );
  if (stored === undefined) {
    stored = await Storage.getItem(MEMORIES_KEY) ?? undefined;
    if (stored !== undefined) {
      const legacy: unknown = JSON.parse(stored);
      if (!Array.isArray(legacy) || !legacy.every(isMemory)) {
        throw new Error('Saved photo data is invalid.');
      }
      await saveMemories(legacy);
      await Storage.removeItem(MEMORIES_KEY);
    }
  }
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isMemory)) {
    throw new Error('Saved photo data is invalid.');
  }
  return parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function saveMemories(memories: PhotoMemory[]): Promise<void> {
  await runImageStore(
    'readwrite',
    (store) => store.put(JSON.stringify(memories), MEMORY_RECORD_KEY),
    MEMORY_STORE
  );
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
  const existing = await loadMemories();
  const added: PhotoMemory[] = [];
  let rejected = 0;
  for (const asset of assets) {
    const file = asset.file;
    const mimeType = asset.mimeType ?? file?.type;
    if (!mimeType?.toLowerCase().startsWith('image/') || !file || file.size <= 0) {
      rejected++;
      continue;
    }
    const id = newId();
    const memory: PhotoMemory = {
      id,
      name: asset.fileName ?? file.name ?? `Photo ${new Date().toLocaleDateString()}`,
      mimeType,
      createdAt: new Date(`${details.memoryDate}T12:00:00`).toISOString(),
      caption: details.description,
      archived: false,
      title: details.title,
      description: details.description,
      mood: details.mood,
      memoryDate: details.memoryDate,
    };
    try {
      await runImageStore('readwrite', (store) => store.put(file, id));
      added.push(memory);
    } catch (error) {
      console.warn('Unable to store selected photo:', error);
      rejected++;
    }
  }
  if (added.length === 0) {
    return { memories: [], rejected };
  }
  try {
    await saveMemories([...added, ...existing]);
  } catch (error) {
    await Promise.all(added.map((memory) =>
      runImageStore('readwrite', (store) => store.delete(memory.id))
    ));
    throw error;
  }
  return { memories: added, rejected };
}

export async function getMemoryUri(memory: PhotoMemory): Promise<string> {
  const cached = objectUrls.get(memory.id);
  if (cached) return cached;
  const blob = await runImageStore<Blob | undefined>('readonly', (store) =>
    store.get(memory.id)
  );
  if (!blob || blob.size <= 0 || !blob.type.startsWith('image/')) {
    throw new Error('This saved photo could not be read in this browser.');
  }
  const uri = URL.createObjectURL(blob);
  objectUrls.set(memory.id, uri);
  return uri;
}

export function releaseMemoryUri(uri: string): void {
  const entry = [...objectUrls.entries()].find(([, objectUrl]) => objectUrl === uri);
  if (!entry) return;
  objectUrls.delete(entry[0]);
  URL.revokeObjectURL(uri);
}

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
  await saveMemories(updated);
  return updated;
}

export async function deleteMemory(memory: PhotoMemory): Promise<void> {
  const memories = await loadMemories();
  await saveMemories(memories.filter((item) => item.id !== memory.id));
  const uri = objectUrls.get(memory.id);
  if (uri) {
    URL.revokeObjectURL(uri);
    objectUrls.delete(memory.id);
  }
  await runImageStore('readwrite', (store) => store.delete(memory.id));
}

export async function clearMemories(): Promise<void> {
  await runImageStore('readwrite', (store) => store.clear());
  await runImageStore('readwrite', (store) => store.clear(), MEMORY_STORE);
  await Storage.removeItem(MEMORIES_KEY);
  objectUrls.forEach((uri) => URL.revokeObjectURL(uri));
  objectUrls.clear();
}
