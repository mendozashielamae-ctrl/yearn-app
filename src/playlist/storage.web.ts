import * as DocumentPicker from 'expo-document-picker';
import Storage from 'expo-sqlite/kv-store';
import type { PlaylistTrack } from './types';

const TRACKS_KEY = 'yearnPlaylistTracks';
const DATABASE_NAME = 'yearn-playlist-audio';
const STORE_NAME = 'audio';
const AUDIO_EXTENSIONS = new Set([
  'aac',
  'aif',
  'aiff',
  'flac',
  'm4a',
  'mid',
  'midi',
  'mp3',
  'mp4',
  'oga',
  'ogg',
  'opus',
  'wav',
  'weba',
  'webm',
  'wma',
]);
const objectUrls = new Set<string>();

function openAudioDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Persistent audio storage is unavailable in this browser.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open audio storage.'));
    request.onblocked = () => reject(new Error('Audio storage is blocked by another browser tab.'));
  });
}

async function runAudioStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openAudioDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    let result: T;
    let requestSucceeded = false;
    request.onsuccess = () => {
      result = request.result;
      requestSucceeded = true;
    };
    request.onerror = () => reject(request.error ?? new Error('Audio storage request failed.'));
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Audio storage was interrupted.'));
    };
    transaction.oncomplete = () => {
      database.close();
      if (requestSucceeded) resolve(result);
      else reject(new Error('Audio storage request did not complete.'));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Audio storage transaction failed.'));
    };
  });
}

function isAudioAsset(asset: DocumentPicker.DocumentPickerAsset): boolean {
  const extension = asset.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = asset.mimeType?.toLowerCase();
  if (mimeType?.startsWith('audio/')) return true;
  if (mimeType?.startsWith('video/')) return false;
  return AUDIO_EXTENSIONS.has(extension);
}

function newTrackId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function pickAudioTrack(): Promise<PlaylistTrack | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: false,
    multiple: false,
    base64: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  if (!isAudioAsset(asset)) throw new Error('Choose a supported audio file.');
  const file = asset.file;
  if (!file || file.size === 0) throw new Error('This audio file could not be read.');

  const id = newTrackId();
  await runAudioStore('readwrite', (store) => store.put(file, id));
  const track: PlaylistTrack = {
    id,
    title: asset.name.replace(/\.[^.]+$/, '') || asset.name,
    mimeType: asset.mimeType || file.type || 'application/octet-stream',
    addedAt: new Date().toISOString(),
  };
  try {
    const tracks = await loadPlaylistTracks();
    await Storage.setItemAsync(TRACKS_KEY, JSON.stringify([track, ...tracks]));
  } catch (error) {
    await runAudioStore('readwrite', (store) => store.delete(id));
    throw error;
  }
  return track;
}

export async function loadPlaylistTracks(): Promise<PlaylistTrack[]> {
  const stored = await Storage.getItem(TRACKS_KEY);
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isPlaylistTrack)) {
    throw new Error('Saved playlist data is invalid.');
  }
  return parsed;
}

export async function getPlayableUri(track: PlaylistTrack): Promise<string> {
  const blob = await runAudioStore<Blob | undefined>('readonly', (store) =>
    store.get(track.id)
  );
  if (!blob || blob.size === 0) {
    throw new Error('This saved audio file is no longer available in this browser.');
  }
  const uri = URL.createObjectURL(blob);
  objectUrls.add(uri);
  return uri;
}

export function releasePlayableUri(uri: string): void {
  if (!objectUrls.delete(uri)) return;
  URL.revokeObjectURL(uri);
}

export async function removePlaylistTrack(track: PlaylistTrack): Promise<void> {
  const tracks = await loadPlaylistTracks();
  await Storage.setItemAsync(
    TRACKS_KEY,
    JSON.stringify(tracks.filter((item) => item.id !== track.id))
  );
  await runAudioStore('readwrite', (store) => store.delete(track.id));
}

export async function clearPlaylistTracks(): Promise<void> {
  await runAudioStore('readwrite', (store) => store.clear());
  await Storage.removeItemAsync(TRACKS_KEY);
  objectUrls.forEach((uri) => URL.revokeObjectURL(uri));
  objectUrls.clear();
}

function isPlaylistTrack(value: unknown): value is PlaylistTrack {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'id' in value && typeof value.id === 'string' &&
    'title' in value && typeof value.title === 'string' &&
    'mimeType' in value && typeof value.mimeType === 'string' &&
    'addedAt' in value && typeof value.addedAt === 'string' &&
    !('uri' in value)
  );
}
