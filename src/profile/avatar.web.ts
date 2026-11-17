import * as ImagePicker from 'expo-image-picker';

const DATABASE_NAME = 'yearn-profile';
const STORE_NAME = 'avatars';
const AVATAR_KEY = 'profile';
let activeObjectUrl: string | null = null;

function openAvatarDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Profile photo storage is unavailable in this browser.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open profile photo storage.'));
    request.onblocked = () => reject(new Error('Profile photo storage is blocked by another browser tab.'));
  });
}

async function storeAvatar<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openAvatarDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    let result: T;
    let succeeded = false;
    request.onsuccess = () => {
      result = request.result;
      succeeded = true;
    };
    request.onerror = () => reject(request.error ?? new Error('Profile photo storage request failed.'));
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Profile photo storage was interrupted.'));
    };
    transaction.oncomplete = () => {
      database.close();
      if (succeeded) resolve(result);
      else reject(new Error('Profile photo storage did not complete.'));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Profile photo storage failed.'));
    };
  });
}

export async function pickProfileAvatar(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const file = result.assets[0].file;
  if (!result.assets[0].mimeType?.toLowerCase().startsWith('image/') || !file || file.size <= 0) {
    throw new Error('The selected profile image could not be read.');
  }
  await storeAvatar('readwrite', (store) => store.put(file, AVATAR_KEY));
  return AVATAR_KEY;
}

export async function loadProfileAvatar(_key: string): Promise<string> {
  const blob = await storeAvatar<Blob | undefined>(
    'readonly',
    (store) => store.get(AVATAR_KEY)
  );
  if (!blob || blob.size <= 0 || !blob.type.startsWith('image/')) {
    throw new Error('The saved profile photo is unavailable.');
  }
  releaseProfileAvatar(activeObjectUrl ?? '');
  activeObjectUrl = URL.createObjectURL(blob);
  return activeObjectUrl;
}

export function releaseProfileAvatar(uri: string): void {
  if (!uri || activeObjectUrl !== uri) return;
  URL.revokeObjectURL(uri);
  activeObjectUrl = null;
}

export async function deleteProfileAvatar(_key?: string): Promise<void> {
  await storeAvatar('readwrite', (store) => store.delete(AVATAR_KEY));
  releaseProfileAvatar(activeObjectUrl ?? '');
}
