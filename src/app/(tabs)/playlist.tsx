import { Ionicons } from '@expo/vector-icons';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useIsDarkTheme } from '@/theme';
import {
  getPlayableUri,
  loadPlaylistTracks,
  pickAudioTrack,
  releasePlayableUri,
  removePlaylistTrack,
} from '@/playlist/storage';
import type { PlaylistTrack } from '@/playlist/types';

const COLORS = {
  aqua: '#BCE9E6',
  sage: '#D5DEC4',
  cream: '#F7F3E9',
  brown: '#483B37',
  taupe: '#9F8D83',
  terracotta: '#BF8775',
  purple: '#8D78A8',
  card: '#FBF8F1',
};
const DARK_COLORS = {
  aqua: '#293B3A',
  sage: '#323B32',
  cream: '#252421',
  brown: '#F1E9DF',
  taupe: '#B9A99D',
  terracotta: '#BF8775',
  purple: '#BBA8D1',
  card: '#302E2A',
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function PlaylistScreen() {
  const router = useRouter();
  const isDark = useIsDarkTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const player = useAudioPlayer(null, { updateInterval: 300 });
  const status = useAudioPlayerStatus(player);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const sourceUri = useRef<string | null>(null);

  const refreshTracks = useCallback(async () => {
    setLoading(true);
    setLoadingError(null);
    try {
      setTracks(await loadPlaylistTracks());
    } catch (error) {
      console.warn('Unable to load saved playlist:', error);
      setLoadingError(error instanceof Error ? error.message : 'Unable to load your playlist.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshTracks();
    }, [refreshTracks])
  );

  useEffect(() => () => {
    player.pause();
    player.replace(null);
    if (sourceUri.current) releasePlayableUri(sourceUri.current);
  }, [player]);

  const importTrack = async () => {
    if (importing) return;
    setImporting(true);
    setImportError(null);
    try {
      const track = await pickAudioTrack();
      if (track) setTracks((previous) => [track, ...previous]);
    } catch (error) {
      console.warn('Unable to import playlist audio:', error);
      setImportError(error instanceof Error ? error.message : 'Unable to add this audio file.');
    } finally {
      setImporting(false);
    }
  };

  const toggleTrack = async (track: PlaylistTrack) => {
    setPlaybackError(null);
    if (activeTrackId === track.id) {
      if (status.playing) {
        player.pause();
        return;
      }
      if (status.didJustFinish) await player.seekTo(0);
      player.play();
      return;
    }

    let nextUri: string | null = null;
    try {
      nextUri = await getPlayableUri(track);
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      });
      player.pause();
      player.replace(nextUri);
      if (sourceUri.current) releasePlayableUri(sourceUri.current);
      sourceUri.current = nextUri;
      setActiveTrackId(track.id);
      player.play();
    } catch (error) {
      if (nextUri && sourceUri.current !== nextUri) releasePlayableUri(nextUri);
      console.warn('Unable to play playlist audio:', error);
      setPlaybackError(error instanceof Error
        ? error.message
        : 'This audio file could not be played.');
    }
  };

  const removeTrack = async (track: PlaylistTrack) => {
    setImportError(null);
    try {
      if (activeTrackId === track.id) {
        player.pause();
        player.replace(null);
        if (sourceUri.current) releasePlayableUri(sourceUri.current);
        sourceUri.current = null;
        setActiveTrackId(null);
        setPlaybackError(null);
      }
      await removePlaylistTrack(track);
      setTracks((previous) => previous.filter((item) => item.id !== track.id));
    } catch (error) {
      console.warn('Unable to remove playlist audio:', error);
      setImportError(error instanceof Error
        ? error.message
        : 'Unable to remove this audio file.');
    }
  };

  const openChat = () => router.push('/chat' as Href);
  const visiblePlaybackError = playbackError ??
    (status.error ? 'This audio file could not be played. Try another file.' : null);

  return (
    <View style={[styles.screen, { backgroundColor: colors.sage }]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="playlistBackground" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.aqua} />
            <Stop offset="0.62" stopColor={colors.sage} />
            <Stop offset="1" stopColor={colors.cream} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#playlistBackground)" />
      </Svg>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboard}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.brown }]}>Final Playlist</Text>
            <Text style={[styles.subtitle, { color: colors.taupe }]}>Songs for the moments you still feel.</Text>
          </View>

          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="Choose audio from files or Downloads"
            accessibilityState={{ disabled: importing }}
            disabled={importing}
            onPress={() => void importTrack()}
            style={({ pressed }) => [
              styles.importButton,
              { opacity: importing ? 0.7 : pressed ? 0.88 : 1 },
            ]}
          >
            <Ionicons name="download-outline" size={19} color="#FFFFFF" />
            <Text style={styles.importLabel}>
              {importing ? 'Adding audio…' : 'Choose from Downloads'}
            </Text>
          </SmoothPressable>
          <Text style={[styles.helper, { color: colors.taupe }]}>Opens your phone’s audio or Downloads picker.</Text>

          {importError && (
            <Text accessibilityLiveRegion="polite" style={styles.errorMessage}>
              {importError}
            </Text>
          )}

          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyDescription}>Loading your playlist…</Text>
            </View>
          ) : loadingError ? (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.purple} />
              <Text style={[styles.emptyTitle, { color: colors.brown }]}>Your playlist couldn’t be loaded.</Text>
              <Text style={[styles.emptyDescription, { color: colors.taupe }]}>{loadingError}</Text>
              <SmoothPressable
                accessibilityRole="button"
                onPress={() => void refreshTracks()}
                style={styles.retryButton}
              >
                <Text style={[styles.retryLabel, { color: colors.brown }]}>Try again</Text>
              </SmoothPressable>
            </View>
          ) : tracks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={38} color={colors.purple} />
              <Text style={[styles.emptyTitle, { color: colors.brown }]}>Your playlist is empty.</Text>
              <Text style={[styles.emptyDescription, { color: colors.taupe }]}>
                Choose an audio file from your Downloads.
              </Text>
            </View>
          ) : (
            <View style={styles.trackList}>
              {tracks.map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  colors={colors}
                  active={activeTrackId === track.id}
                  playing={activeTrackId === track.id && status.playing}
                  currentTime={activeTrackId === track.id ? status.currentTime : 0}
                  duration={activeTrackId === track.id ? status.duration : 0}
                  onToggle={() => void toggleTrack(track)}
                  onRemove={() => void removeTrack(track)}
                  onSeek={(position) => {
                    if (activeTrackId === track.id && status.duration > 0) {
                      void player.seekTo(position * status.duration);
                    }
                  }}
                />
              ))}
              {visiblePlaybackError && (
                <Text accessibilityLiveRegion="polite" style={styles.errorMessage}>
                  {visiblePlaybackError}
                </Text>
              )}
            </View>
          )}
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
    </View>
  );
}

function TrackCard({
  track,
  colors,
  active,
  playing,
  currentTime,
  duration,
  onToggle,
  onRemove,
  onSeek,
}: {
  track: PlaylistTrack;
  colors: typeof COLORS | typeof DARK_COLORS;
  active: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  onToggle: () => void;
  onRemove: () => void;
  onSeek: (position: number) => void;
}) {
  const [seekWidth, setSeekWidth] = useState(0);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <View style={[styles.trackCard, { backgroundColor: colors.card }]}>
      <View style={styles.trackMain}>
        <View style={[styles.trackIcon, { backgroundColor: colors.cream === '#252421' ? '#49404F' : '#EEE8F1' }]}>
          <Ionicons name="musical-note" size={20} color={colors.purple} />
        </View>
        <View style={styles.trackInfo}>
          <Text style={[styles.trackTitle, { color: colors.brown }]} numberOfLines={2}>{track.title}</Text>
          <Text style={[styles.trackTime, { color: colors.taupe }]}>
            {active && duration > 0
              ? `${formatTime(currentTime)} / ${formatTime(duration)}`
              : duration > 0 ? formatTime(duration) : 'Audio file'}
          </Text>
        </View>
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel={playing ? `Pause ${track.title}` : `Play ${track.title}`}
          onPress={onToggle}
          style={styles.playButton}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#FFFFFF" />
        </SmoothPressable>
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${track.title}`}
          onPress={onRemove}
          style={styles.removeButton}
        >
          <Ionicons name="close" size={19} color={colors.taupe} />
        </SmoothPressable>
      </View>
      {active && (
        <View style={styles.seekRow}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Seek ${track.title}`}
            accessibilityValue={{
              min: 0,
              max: Math.floor(duration),
              now: Math.floor(currentTime),
              text: `${formatTime(currentTime)} of ${formatTime(duration)}`,
            }}
            onLayout={(event) => setSeekWidth(event.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(event) => {
              if (seekWidth > 0 && duration > 0) {
                onSeek(Math.max(0, Math.min(1, event.nativeEvent.locationX / seekWidth)));
              }
            }}
            onResponderMove={(event) => {
              if (seekWidth > 0 && duration > 0) {
                onSeek(Math.max(0, Math.min(1, event.nativeEvent.locationX / seekWidth)));
              }
            }}
            style={styles.seekHitTarget}
          >
            <View style={styles.seekTrack}>
              <View style={[styles.seekProgress, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.sage },
  scroll: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingBottom: 100 },
  dashboard: { width: '100%', maxWidth: 430, paddingHorizontal: 14 },
  header: { alignItems: 'center', marginTop: 13, marginBottom: 17 },
  title: { color: COLORS.brown, fontFamily: 'serif', fontSize: 21, fontWeight: '700' },
  subtitle: { color: COLORS.taupe, fontSize: 11, marginTop: 4 },
  importButton: { height: 47, borderRadius: 15, backgroundColor: COLORS.terracotta, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  importLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  helper: { color: COLORS.taupe, fontSize: 10, textAlign: 'center', marginTop: 8 },
  emptyState: { minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  emptyTitle: { color: COLORS.brown, fontFamily: 'serif', fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 13 },
  emptyDescription: { color: COLORS.taupe, fontSize: 13, textAlign: 'center', marginTop: 7 },
  retryButton: { borderRadius: 13, backgroundColor: '#EAE2D9', marginTop: 14, paddingHorizontal: 15, paddingVertical: 9 },
  retryLabel: { color: COLORS.brown, fontSize: 12, fontWeight: '600' },
  errorMessage: { color: '#9E4D46', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 10 },
  trackList: { gap: 11, marginTop: 22, paddingBottom: 20 },
  trackCard: { borderRadius: 17, backgroundColor: COLORS.card, paddingHorizontal: 11, paddingVertical: 9 },
  trackMain: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 9 },
  trackIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EEE8F1', alignItems: 'center', justifyContent: 'center' },
  trackInfo: { flex: 1, minWidth: 0, gap: 3 },
  trackTitle: { color: COLORS.brown, fontFamily: 'serif', fontSize: 14, fontWeight: '600' },
  trackTime: { color: COLORS.taupe, fontSize: 10 },
  playButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.terracotta, alignItems: 'center', justifyContent: 'center' },
  removeButton: { width: 28, height: 34, alignItems: 'center', justifyContent: 'center' },
  seekRow: { paddingLeft: 47, paddingRight: 4 },
  seekHitTarget: { height: 26, justifyContent: 'center' },
  seekTrack: { height: 4, borderRadius: 2, backgroundColor: '#E7DED6', overflow: 'hidden' },
  seekProgress: { height: '100%', borderRadius: 2, backgroundColor: COLORS.terracotta },
  chatButtonWrap: { position: 'absolute', bottom: 10, alignSelf: 'center', width: '100%', maxWidth: 430, alignItems: 'flex-end', paddingHorizontal: 16 },
  chatButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#CC806E', elevation: 4, shadowColor: '#483B37', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
});
