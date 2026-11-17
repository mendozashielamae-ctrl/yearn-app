import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { newId } from '@/db/client';

const AVATAR_DIRECTORY = `${FileSystem.documentDirectory}profile/`;

export async function pickProfileAvatar(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo library access to choose a profile photo.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  if (!asset.mimeType?.toLowerCase().startsWith('image/')) {
    throw new Error('Choose a supported image.');
  }
  if (!FileSystem.documentDirectory) throw new Error('Profile photo storage is unavailable.');

  await FileSystem.makeDirectoryAsync(AVATAR_DIRECTORY, { intermediates: true });
  const extension = asset.fileName?.split('.').pop()?.toLowerCase();
  const safeExtension = extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : 'img';
  const uri = `${AVATAR_DIRECTORY}${newId()}.${safeExtension}`;
  await FileSystem.copyAsync({ from: asset.uri, to: uri });
  return uri;
}

export async function loadProfileAvatar(uri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || (info.size !== undefined && info.size <= 0)) {
    throw new Error('The saved profile photo is unavailable.');
  }
  return uri;
}

export function releaseProfileAvatar(_uri: string): void {}

export async function deleteProfileAvatar(uri?: string): Promise<void> {
  if (uri) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    return;
  }
  await FileSystem.deleteAsync(AVATAR_DIRECTORY, { idempotent: true });
}
