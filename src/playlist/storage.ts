import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Storage from 'expo-sqlite/kv-store';
import type { PlaylistTrack } from './types';

const TRACKS_KEY = 'yearnPlaylistTracks';
const AUDIO_DIRECTORY = `${FileSystem.documentDirectory}playlist/`;
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

function fileExtension(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTENSIONS.has(extension) ? extension : 'audio';
}

function extensionFor(asset: DocumentPicker.DocumentPickerAsset): string {
  const extension = fileExtension(asset.name);
  if (extension !== 'audio') return extension;
  switch (asset.mimeType?.toLowerCase()) {
    case 'audio/aac': return 'aac';
    case 'audio/mp4': return 'm4a';
    case 'audio/mpeg': return 'mp3';
    case 'audio/ogg': return 'ogg';
    case 'audio/wav':
    case 'audio/x-wav': return 'wav';
    default: return extension;
  }
}

export async function pickAudioTrack(): Promise<PlaylistTrack | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  if (!isAudioAsset(asset)) {
    throw new Error('Choose a supported audio file.');
  }
  if (!FileSystem.documentDirectory) {
    throw new Error('App storage is unavailable on this device.');
  }

  const id = newTrackId();
  const extension = extensionFor(asset);
  await FileSystem.makeDirectoryAsync(AUDIO_DIRECTORY, { intermediates: true });
  const uri = `${AUDIO_DIRECTORY}${id}.${extension}`;
  await FileSystem.copyAsync({ from: asset.uri, to: uri });

  const track: PlaylistTrack = {
    id,
    title: asset.name.replace(/\.[^.]+$/, '') || asset.name,
    mimeType: asset.mimeType ?? 'application/octet-stream',
    addedAt: new Date().toISOString(),
    uri,
  };
  try {
    const tracks = await loadPlaylistTracks();
    await Storage.setItemAsync(TRACKS_KEY, JSON.stringify([track, ...tracks]));
  } catch (error) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
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
  if (!track.uri) throw new Error('This audio file is no longer available.');
  const info = await FileSystem.getInfoAsync(track.uri);
  if (!info.exists) throw new Error('This audio file could not be found on this device.');
  return track.uri;
}

export function releasePlayableUri(_uri: string): void {}

export async function removePlaylistTrack(track: PlaylistTrack): Promise<void> {
  const tracks = await loadPlaylistTracks();
  await Storage.setItemAsync(
    TRACKS_KEY,
    JSON.stringify(tracks.filter((item) => item.id !== track.id))
  );
  if (track.uri) await FileSystem.deleteAsync(track.uri, { idempotent: true });
}

export async function clearPlaylistTracks(): Promise<void> {
  await FileSystem.deleteAsync(AUDIO_DIRECTORY, { idempotent: true });
  await Storage.removeItemAsync(TRACKS_KEY);
}

function isPlaylistTrack(value: unknown): value is PlaylistTrack {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'id' in value && typeof value.id === 'string' &&
    'title' in value && typeof value.title === 'string' &&
    'mimeType' in value && typeof value.mimeType === 'string' &&
    'addedAt' in value && typeof value.addedAt === 'string' &&
    'uri' in value && typeof value.uri === 'string'
  );
}
