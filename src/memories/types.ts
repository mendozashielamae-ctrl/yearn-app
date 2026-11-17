export interface PhotoMemory {
  id: string;
  name: string;
  mimeType: string;
  createdAt: string;
  caption: string;
  archived: boolean;
  title?: string;
  description?: string;
  mood?: string;
  memoryDate?: string;
  /** App-owned durable URI on native; web images live in IndexedDB. */
  uri?: string;
}

export interface MemoryDetails {
  title: string;
  description: string;
  mood: string;
  memoryDate: string;
}
