export interface PlaylistTrack {
  id: string;
  title: string;
  mimeType: string;
  addedAt: string;
  /** App-owned durable file URI on native; omitted when audio is stored in IndexedDB. */
  uri?: string;
}
