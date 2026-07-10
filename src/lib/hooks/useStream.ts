import {useQuery} from '@tanstack/react-query';
import {useState, useEffect, useRef, useCallback} from 'react';
import {ToastAndroid, NativeModules} from 'react-native';
import {providerManager} from '../services/ProviderManager';
import {settingsStorage} from '../storage';
import {ifExists} from '../file/ifExists';
import {Stream} from '../providers/types';

// ─── Native Torrent Module Setup ──────────────────────────────────────────────
const { TorrentStreamModule } = NativeModules;

// ═══════════════════════════════════════════════════════════════════
// TESTING: Hardcoded magnet link for verifying TorrServer integration
// ═══════════════════════════════════════════════════════════════════
const TEST_MAGNET = '';
const ENABLE_TEST_MODE = false;   // set to false when you’re done testing

// ─── Server lifecycle management (start only once) ───────────────────────────
let serverUrl: string | null = null;
let serverPromise: Promise<string> | null = null;

async function ensureServerStarted(): Promise<string> {
  if (serverUrl) {
    console.log('[TorrServer] Reusing existing server:', serverUrl);
    return serverUrl;
  }
  if (serverPromise) {
    console.log('[TorrServer] Waiting for existing server promise...');
    return serverPromise;
  }

  console.log('[TorrServer] Starting TorrServer...');
  serverPromise = TorrentStreamModule.startServer()
    .then((url: string) => {
      serverUrl = url;
      console.log('[TorrServer] ✅ Server started at:', url);
      serverPromise = null;
      return url;
    })
    .catch((e: any) => {
      console.error('[TorrServer] ❌ Failed to start server:', e.message);
      serverPromise = null;
      throw e;
    });

  return serverPromise;
}

interface UseStreamOptions {
  activeEpisode: any;
  routeParams: any;
  provider: string;
  enabled?: boolean;
}

// ─── Network-quality-aware buffer config ──────────────────────────────────────
export interface BufferConfig {
  minBufferMs: number;
  maxBufferMs: number;
  bufferForPlaybackMs: number;
  bufferForPlaybackAfterRebufferMs: number;
  backBufferDurationMs: number;
}

export type NetworkQuality = 'fast' | 'slow' | 'unknown';

export const getNetworkAwareBufferConfig = (
  quality: NetworkQuality = 'unknown',
): BufferConfig => {
  switch (quality) {
    case 'fast':
      return {
        minBufferMs: 2000,
        maxBufferMs: 30000,
        bufferForPlaybackMs: 500,
        bufferForPlaybackAfterRebufferMs: 1500,
        backBufferDurationMs: 5000,
      };
    case 'slow':
      return {
        minBufferMs: 4000,
        maxBufferMs: 60000,
        bufferForPlaybackMs: 1200,
        bufferForPlaybackAfterRebufferMs: 3000,
        backBufferDurationMs: 8000,
      };
    default:
      return {
        minBufferMs: 2500,
        maxBufferMs: 50000,
        bufferForPlaybackMs: 800,
        bufferForPlaybackAfterRebufferMs: 2000,
        backBufferDurationMs: 7000,
      };
  }
};

// ─── Constants ────────────────────────────────────────────────────────────────
const STREAM_FETCH_TIMEOUT = 12000;
const STREAM_RETRY_DELAY_MS = 2000;

// ─── Helpers ────────────────────────────────────────────────────────────────
const shouldSkipServer = (stream: Stream): boolean =>
  stream?.server?.toLowerCase() === 'hubcloud';

const findNextPlayableIndex = (streams: Stream[], fromIndex: number): number => {
  for (let i = fromIndex; i < streams.length; i++) {
    if (!shouldSkipServer(streams[i])) return i;
  }
  return -1;
};

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// ─── useStream ──────────────────────────────────────────────────────────────

export const useStream = ({
  activeEpisode,
  routeParams,
  provider,
  enabled = true,
}: UseStreamOptions) => {
  const [selectedStream, setSelectedStream] = useState<Stream>({
    server: '',
    link: '',
    type: '',
  });

  const [externalSubs, setExternalSubs] = useState<any[]>([]);
  const hasInitializedStreamRef = useRef(false);
  const [skipAttemptCount, setSkipAttemptCount] = useState(0);

  // ─── Torrent Streaming State ──────────────────────────────────────────
  const [torrentStreamUrl, setTorrentStreamUrl] = useState<string | null>(null);
  const [torrentLoading, setTorrentLoading] = useState(false);
  const [torrentMetrics, setTorrentMetrics] = useState({
    progress: 0,
    buffer: 0,
    speed: 0,
    seeds: 0,
  });

  // ─── Torrent Stream Effect (with test magnet fallback) ────────────────
  useEffect(() => {
    // Use the test magnet if testing is enabled AND no real magnet is provided
    const magnet = activeEpisode?.magnetLink || (ENABLE_TEST_MODE ? TEST_MAGNET : null);

    if (!magnet || !TorrentStreamModule) {
      console.log('[Torrent] Skipping – no magnet link or module missing');
      return;
    }

    let cancelled = false;

    const startTorrent = async () => {
      console.log('[Torrent] Starting torrent for magnet:', magnet);
      setTorrentStreamUrl(null);
      setTorrentLoading(true);
      setTorrentMetrics({ progress: 0, buffer: 0, speed: 0, seeds: 0 });

      try {
        // 1. Ensure the Go server is running
        console.log('[Torrent] Ensuring TorrServer is running...');
        const baseUrl = await ensureServerStarted();
        console.log('[Torrent] TorrServer URL:', baseUrl);

        // 2. Add the magnet link to TorrServer via its HTTP API with smart retries
        console.log('[Torrent] Adding magnet link to TorrServer...');
        
        let response = null;
        let retries = 6; // Will retry for ~9 seconds if the binary is slow to bind to port 8090
        
        while (retries > 0) {
          try {
            response = await fetch(`${baseUrl}/torrents`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: "add",
                link: magnet,
                save_to_db: true,
              }),
            });
            break; // Success! Exit retry loop
          } catch (fetchError) {
            console.log(`[Torrent] Server port not ready yet... Retrying in 1.5s (${retries} left)`);
            retries -= 1;
            if (retries === 0) throw fetchError; // Re-throw if all attempts fail
            await new Promise(res => setTimeout(res, 1500));
          }
        }

        if (!response) {
          throw new Error("No response received from TorrServer context");
        }

        const data = await response.json();
        
        if (!data || !data.hash) {
            throw new Error("Failed to parse torrent hash from server");
        }

        // 3. Construct the streaming URL using the returned hash (index=1 assumes largest file)
        const streamUrl = `${baseUrl}/stream/?link=${data.hash}&index=1&play`;
        console.log('[Torrent] Received stream URL:', streamUrl);

        if (!cancelled) {
          setTorrentStreamUrl(streamUrl);
          console.log('[Torrent] ✅ torrentStreamUrl set to:', streamUrl);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('[Torrent] ❌ Error:', e.message, e);
          ToastAndroid.show(
            `Torrent Error: ${e.message || 'Unknown'}`,
            ToastAndroid.LONG,
          );
        }
      } finally {
        if (!cancelled) {
          setTorrentLoading(false);
          console.log('[Torrent] Loading finished');
        }
      }
    };

    startTorrent();

    return () => {
      console.log('[Torrent] Cleanup – cancelling');
      cancelled = true;
    };
  }, [activeEpisode?.magnetLink]);

  // ─── Data fetching (Standard HTTP Streams) ──────────────────────────────
  const {
    data: streamData = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Stream[], Error>({
    queryKey: ['stream', activeEpisode?.link, routeParams?.type, provider],
    queryFn: async ({signal}) => {
      if (!activeEpisode?.link) return [];

      console.log('Fetching stream for:', activeEpisode);

      if (routeParams?.directUrl) {
        return [{server: 'Downloaded', link: routeParams.directUrl, type: 'mp4'}];
      }

      if (routeParams?.primaryTitle && routeParams?.secondaryTitle) {
        const fileName = (
          routeParams.primaryTitle +
          routeParams.secondaryTitle +
          activeEpisode.title
        ).replaceAll(/[^a-zA-Z0-9]/g, '_');

        const localPath = await ifExists(fileName);
        if (localPath) {
          return [{server: 'downloaded', link: localPath, type: 'mp4'}];
        }
      }

      const attemptFetch = async (attempt: number): Promise<Stream[]> => {
        const fetchController = new AbortController();
        signal.addEventListener('abort', () => fetchController.abort());

        const timeoutId = setTimeout(
          () => fetchController.abort(),
          STREAM_FETCH_TIMEOUT,
        );

        try {
          const data = await providerManager.getStream({
            link: activeEpisode.link,
            type: routeParams?.type,
            signal: fetchController.signal,
            providerValue: routeParams?.providerValue || provider,
          });

          clearTimeout(timeoutId);

          const excludedQualities =
            settingsStorage.getExcludedQualities() || [];
          const filtered = data?.filter(
            s => !excludedQualities.includes((s?.quality ?? '') + 'p'),
          );

          const result = filtered?.length > 0 ? filtered : data;

          if (!result || result.length === 0) {
            throw new Error('No streams available');
          }

          return result;
        } catch (err: any) {
          clearTimeout(timeoutId);

          if (signal.aborted) throw err;

          if (attempt === 0) {
            console.log(
              `Stream fetch attempt 1 failed (${(err as Error)?.message}). ` +
                `Retrying in ${STREAM_RETRY_DELAY_MS}ms…`,
            );
            await sleep(STREAM_RETRY_DELAY_MS);
            if (signal.aborted) throw err;
            return attemptFetch(1);
          }

          throw err;
        }
      };

      return attemptFetch(0);
    },
    enabled: enabled && (!!activeEpisode?.link || !!activeEpisode?.magnetLink),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // ─── Reset on episode change ──────────────────────────────────────────
  useEffect(() => {
    hasInitializedStreamRef.current = false;
    setSkipAttemptCount(0);
    setExternalSubs([]);
  }, [activeEpisode?.link, activeEpisode?.magnetLink]);

  // ─── Auto-select initial stream ───────────────────────────────────────
  useEffect(() => {
    if (!streamData || streamData.length === 0) return;
    if (hasInitializedStreamRef.current) return;

    hasInitializedStreamRef.current = true;

    const firstPlayable = findNextPlayableIndex(streamData, 0);
    const initialStream =
      firstPlayable !== -1 ? streamData[firstPlayable] : streamData[0];

    if (initialStream) {
      setSelectedStream(initialStream);
      setSkipAttemptCount(0);
      if (firstPlayable > 0) {
        ToastAndroid.show('Skipped hubcloud server', ToastAndroid.SHORT);
      }
    }

    const subsFromStream: any[] = [];
    streamData.forEach(track => {
      if (track?.subtitles?.length) {
        subsFromStream.push(...track.subtitles);
      }
    });
    if (subsFromStream.length > 0) {
      setExternalSubs(subsFromStream);
    }
  }, [streamData]);

  // ─── Error handling ───────────────────────────────────────────────────
  useEffect(() => {
    if (error && !activeEpisode?.magnetLink) {
      console.error('Stream fetch error:', error);
      ToastAndroid.show('No stream found, try again later', ToastAndroid.SHORT);
    }
  }, [error, activeEpisode?.magnetLink]);

  // ─── External subtitle management ─────────────────────────────────────
  const addExternalSub = useCallback((track: any): string => {
    setExternalSubs(prev => [track, ...prev]);
    return track.uri as string;
  }, []);

  const removeExternalSub = useCallback((uri: string) => {
    setExternalSubs(prev => prev.filter(s => s.uri !== uri));
  }, []);

  const clearExternalSubs = useCallback(() => {
    setExternalSubs([]);
  }, []);

  // ─── Stream switching ─────────────────────────────────────────────────
  const advanceToNextStream = (showToast = true): boolean => {
    if (!streamData || streamData.length === 0) return false;

    const currentIndex = streamData.findIndex(
      s => s.link === selectedStream.link && s.server === selectedStream.server,
    );

    const nextIdx = findNextPlayableIndex(streamData, currentIndex + 1);

    if (nextIdx !== -1) {
      setSelectedStream(streamData[nextIdx]);
      setSkipAttemptCount(0);

      if (showToast) {
        ToastAndroid.show(
          'Video could not be played, trying next server…',
          ToastAndroid.SHORT,
        );
      }
      if (nextIdx > currentIndex + 1) {
        ToastAndroid.show('Skipped hubcloud server', ToastAndroid.SHORT);
      }
      return true;
    }

    return false;
  };

  const handleStreamLoadFailure = (): boolean => {
    if (torrentStreamUrl) return false;

    if (skipAttemptCount === 0) {
      setSkipAttemptCount(1);
      console.log('Stream load failure — switching to next server.');
      return advanceToNextStream();
    }
    console.log('Already attempted skip for this stream; giving up.');
    return false;
  };

  return {
    streamData,
    selectedStream,
    setSelectedStream,
    externalSubs,
    setExternalSubs,
    addExternalSub,
    removeExternalSub,
    clearExternalSubs,
    isLoading,
    error,
    refetch,
    switchToNextStream: handleStreamLoadFailure,
    // Torrent properties
    torrentStreamUrl,
    torrentLoading,
    torrentMetrics,
  };
};

// ─── useVideoSettings ────────────────────────────────────────────────────────
export const useVideoSettings = () => {
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [textTracks, setTextTracks] = useState<any[]>([]);
  const [videoTracks, setVideoTracks] = useState<any[]>([]);

  const [selectedAudioTrackIndex, setSelectedAudioTrackIndex] = useState(0);
  const [selectedTextTrackIndex, setSelectedTextTrackIndex] = useState(1000);
  const [selectedQualityIndex, setSelectedQualityIndex] = useState(1000);

  const processAudioTracks = (tracks: any[]) => {
    const uniqueMap = new Map();
    tracks.forEach(track => {
      const key = `${track.type}-${track.title}-${track.language}`;
      const existing = uniqueMap.get(key);
      if (!existing) {
        uniqueMap.set(key, track);
      } else if (track.selected && !existing.selected) {
        uniqueMap.set(key, {...existing, ...track, selected: true});
      }
    });

    const uniqueTracks = Array.from(uniqueMap.values());
    const selectedIndex = uniqueTracks.findIndex(t => t.selected);
    setAudioTracks(uniqueTracks);
    if (selectedIndex !== -1) setSelectedAudioTrackIndex(selectedIndex);
  };

  const processVideoTracks = (tracks: any[]) => {
    const seen = new Map();
    const unique = tracks.filter(track => {
      const key = `${track.bitrate}-${track.height}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        return true;
      }
      return false;
    });
    setVideoTracks(unique);
  };

  return {
    audioTracks,
    textTracks,
    videoTracks,
    selectedAudioTrackIndex,
    selectedTextTrackIndex,
    selectedQualityIndex,
    setAudioTracks,
    setTextTracks,
    setVideoTracks,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setSelectedQualityIndex,
    processAudioTracks,
    processVideoTracks,
  };
};