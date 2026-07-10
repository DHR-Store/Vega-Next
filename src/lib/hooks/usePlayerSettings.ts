import {useCallback, useRef, useState} from 'react';
import {cacheStorage, mainStorage} from '../storage';

interface UsePlayerProgressOptions {
  activeEpisode: any;
  routeParams: any;
  playbackRate: number;
  updatePlaybackInfo: (link: string, data: any) => void;
}

export const usePlayerProgress = ({
  activeEpisode,
  routeParams,
  playbackRate,
  updatePlaybackInfo,
}: UsePlayerProgressOptions) => {
  const videoPositionRef = useRef({position: 0, duration: 0});
  const lastSavedPositionRef = useRef(0);

  // Defined BEFORE handleProgress so the closure always captures the current version.
  const storeWatchProgressForHistory = useCallback(
    (link: string, currentTime: number, duration: number) => {
      try {
        if (currentTime > 0 && duration > 0) {
          const historyKey = routeParams?.infoUrl || link;
          const historyProgressKey = `watch_history_progress_${historyKey}`;
          const percentage = (currentTime / duration) * 100;

          const progressData = {
            currentTime,
            duration,
            percentage,
            infoUrl: routeParams?.infoUrl || '',
            title: routeParams?.primaryTitle || '',
            episodeTitle: routeParams?.secondaryTitle || '',
            updatedAt: Date.now(),
          };

          mainStorage.setString(
            historyProgressKey,
            JSON.stringify(progressData),
          );

          // Also store with episodeTitle-specific key for series episodes
          if (routeParams?.secondaryTitle) {
            const episodeKey = `watch_history_progress_${historyKey}_${routeParams.secondaryTitle.replace(
              /\s+/g,
              '_',
            )}`;
            mainStorage.setString(episodeKey, JSON.stringify(progressData));
          }
        }
      } catch (error) {
        console.error('Error storing watch progress for history:', error);
      }
    },
    [routeParams],
  );

  // Memoized progress handler
  const handleProgress = useCallback(
    (e: {currentTime: number; seekableDuration: number}) => {
      const {currentTime, seekableDuration} = e;

      videoPositionRef.current = {
        position: currentTime,
        duration: seekableDuration,
      };

      // FIX: Guard both updatePlaybackInfo and storeWatchProgressForHistory
      //      behind the same null-safety check to prevent crashes when
      //      episodeList or linkIndex is absent.
      if (
        routeParams?.episodeList &&
        routeParams?.linkIndex !== undefined &&
        routeParams.episodeList[routeParams.linkIndex]?.link
      ) {
        const currentLink = routeParams.episodeList[routeParams.linkIndex].link;

        updatePlaybackInfo(currentLink, {
          currentTime,
          duration: seekableDuration,
          playbackRate,
        });

        storeWatchProgressForHistory(currentLink, currentTime, seekableDuration);
      }

      // Save progress periodically – approximately every 5 seconds of playback.
      if (Math.abs(currentTime - lastSavedPositionRef.current) >= 5) {
        cacheStorage.setString(
          activeEpisode.link,
          JSON.stringify({
            position: currentTime,
            duration: seekableDuration,
          }),
        );
        lastSavedPositionRef.current = currentTime;
      }
    },
    [
      activeEpisode.link,
      routeParams,
      updatePlaybackInfo,
      playbackRate,
      storeWatchProgressForHistory,
    ],
  );

  return {
    videoPositionRef,
    handleProgress,
  };
};

// Expanded activeTab type that covers all panels used in Player.tsx
export type PlayerActiveTab =
  | 'audio'
  | 'subtitle'
  | 'server'
  | 'quality'
  | 'speed'
  | 'general'
  | 'fastForward'
  | 'hdr';

// ─── Storage key for subtitle delay ──────────────────────────────────────────
const KEY_SUBTITLE_DELAY = 'subtitleDelayMs';

// Hook for player settings and UI state
export const usePlayerSettings = () => {
  // ─── Controls visibility ──────────────────────────────────────────────────
  // FIX: Initialised to `true` so showControlsRef starts in sync with the
  //      initial showControls state and the first user tap works correctly.
  const showControlsRef = useRef<boolean>(true);
  const [showControls, setShowControlsState] = useState(true);

  // Timer that auto-hides controls after N ms of inactivity.
  const controlsHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Wrapped setter that keeps showControlsRef in sync immediately (no useEffect
   * lag) and cancels any pending auto-hide timer when hiding controls.
   */
  const setShowControls = useCallback((visible: boolean) => {
    showControlsRef.current = visible;
    setShowControlsState(visible);
    if (!visible && controlsHideTimerRef.current) {
      clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, []);

  /**
   * Show controls and automatically hide them after `durationMs` milliseconds.
   * Resets the timer on every call so rapid taps correctly extend the timeout.
   */
  const showControlsWithAutoHide = useCallback((durationMs: number = 4000) => {
    showControlsRef.current = true;
    setShowControlsState(true);
    if (controlsHideTimerRef.current) {
      clearTimeout(controlsHideTimerRef.current);
    }
    if (durationMs > 0) {
      controlsHideTimerRef.current = setTimeout(() => {
        showControlsRef.current = false;
        setShowControlsState(false);
        controlsHideTimerRef.current = null;
      }, durationMs);
    }
  }, []);

  /**
   * Show controls and NEVER auto-hide them until the next explicit call to
   * showControlsWithAutoHide or setShowControls(false).
   *
   * Use case: whenever the video is paused — controls must stay on screen so
   * the user can interact with the seek-bar, settings, etc.
   */
  const showControlsPermanently = useCallback(() => {
    if (controlsHideTimerRef.current) {
      clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
    showControlsRef.current = true;
    setShowControlsState(true);
  }, []);

  // ─── Settings panel ───────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<PlayerActiveTab>('audio');

  // ─── Video sizing ─────────────────────────────────────────────────────────
  const [resizeMode, setResizeMode] = useState<any>('none');

  // ─── Playback speed ───────────────────────────────────────────────────────
  const [playbackRate, setPlaybackRate] = useState(1.0);

  // ─── Player lock ─────────────────────────────────────────────────────────
  const [isPlayerLocked, setIsPlayerLocked] = useState(false);
  const [showUnlockButton, setShowUnlockButton] = useState(false);
  const unlockButtonTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Toast ────────────────────────────────────────────────────────────────
  // FIX: All toast state lives here so that handleResizeMode, togglePlayerLock,
  //      and the fast-forward overlay all share ONE source of truth that is
  //      actually rendered by Player.tsx.
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * FIX: Cancels any pending timer before starting a new one so rapid calls
   *      never stack up timers and produce toast ghost-hides.
   * Pass `duration = 0` to show the toast indefinitely (you must call
   * `setToast('', 1)` to dismiss it, which triggers an immediate hide).
   */
  const setToast = useCallback((message: string, duration: number) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastMessage(message);
    if (message) {
      setShowToast(true);
    }
    if (duration > 0) {
      toastTimerRef.current = setTimeout(() => {
        setShowToast(false);
        toastTimerRef.current = null;
      }, duration);
    } else {
      // duration === 0 means "hide immediately"
      setShowToast(false);
    }
  }, []);

  // ─── Text / speed overlay ─────────────────────────────────────────────────
  const [isTextVisible, setIsTextVisible] = useState(false);

  // ─── Fullscreen ───────────────────────────────────────────────────────────
  const [isFullScreen, setIsFullScreen] = useState(true);

  // ─── Subtitle delay ──────────────────────────────────────────────────────
  //
  // Subtitle delay in milliseconds.  Positive = subtitles appear later;
  // negative = subtitles appear earlier.  Range: –5 000 ms … +5 000 ms.
  //
  // Note: For EMBEDDED HLS/DASH subtitle tracks the ExoPlayer / AVPlayer
  // pipeline does not expose a public delay API, so this value is used to:
  //   a) Display the current offset to the user in the subtitle panel.
  //   b) Pre-process locally-loaded VTT/SRT files when a helper utility
  //      (shiftSubtitleTimings) is available.
  // Full pipeline-level delay support requires a native module patch.
  //
  const [subtitleDelay, setSubtitleDelayState] = useState<number>(() => {
    const stored = cacheStorage.getString(KEY_SUBTITLE_DELAY);
    const parsed = stored ? Number(stored) : 0;
    return isNaN(parsed) ? 0 : parsed;
  });

  const setSubtitleDelay = useCallback((msOrUpdater: number | ((prev: number) => number)) => {
    setSubtitleDelayState(prev => {
      const next =
        typeof msOrUpdater === 'function' ? msOrUpdater(prev) : msOrUpdater;
      const clamped = Math.max(-5000, Math.min(5000, next));
      cacheStorage.setString(KEY_SUBTITLE_DELAY, String(clamped));
      return clamped;
    });
  }, []);

  // ─── Buffering state ──────────────────────────────────────────────────────
  //
  // Set to true by the VideoPlayer's onBuffer callback.  Drives the
  // mid-playback buffering spinner overlay in Player.tsx.
  //
  const [isBuffering, setIsBuffering] = useState(false);

  // Tracks the timestamp when buffering started so we can show extra
  // information or fallback UI after a prolonged stall (e.g. > 15 s).
  const bufferingStartTimeRef = useRef<number | null>(null);

  const handleBufferChange = useCallback((buffering: boolean) => {
    setIsBuffering(buffering);
    if (buffering) {
      bufferingStartTimeRef.current = Date.now();
    } else {
      bufferingStartTimeRef.current = null;
    }
  }, []);

  // ─── Resize mode cycle ────────────────────────────────────────────────────
  const handleResizeMode = useCallback(() => {
    const modes = [
      {mode: 'none', name: 'Fit'},
      {mode: 'cover', name: 'Cover'},
      {mode: 'stretch', name: 'Stretch'},
      {mode: 'contain', name: 'Contain'},
    ];
    const index = modes.findIndex(mode => mode.mode === resizeMode);
    const nextMode = modes[(index + 1) % modes.length];
    setResizeMode(nextMode.mode);
    setToast('Resize Mode: ' + nextMode.name, 2000);
  }, [resizeMode, setToast]);

  // ─── Player lock toggle ───────────────────────────────────────────────────
  const togglePlayerLock = useCallback(() => {
    const newLockState = !isPlayerLocked;
    setIsPlayerLocked(newLockState);

    if (!newLockState) {
      showControlsWithAutoHide(4000);
    } else {
      setShowUnlockButton(false);
    }

    if (unlockButtonTimerRef.current) {
      clearTimeout(unlockButtonTimerRef.current);
      unlockButtonTimerRef.current = null;
    }

    setToast(newLockState ? 'Player Locked' : 'Player Unlocked', 2000);
  }, [isPlayerLocked, setToast, showControlsWithAutoHide]);

  // ─── Locked-screen tap handler ────────────────────────────────────────────
  const handleLockedScreenTap = useCallback(() => {
    if (showUnlockButton) {
      setShowUnlockButton(false);
      return;
    }

    setShowUnlockButton(true);

    if (unlockButtonTimerRef.current) {
      clearTimeout(unlockButtonTimerRef.current);
    }

    unlockButtonTimerRef.current = setTimeout(() => {
      setShowUnlockButton(false);
    }, 10000);
  }, [showUnlockButton]);

  // ─── Fullscreen toggle ────────────────────────────────────────────────────
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
  }, []);

  return {
    // Controls
    showControls,
    setShowControls,
    showControlsRef,
    showControlsWithAutoHide,
    showControlsPermanently,
    controlsHideTimerRef,
    // Settings
    showSettings,
    setShowSettings,
    activeTab,
    setActiveTab,
    // Resize
    resizeMode,
    setResizeMode,
    // Speed
    playbackRate,
    setPlaybackRate,
    // Lock
    isPlayerLocked,
    showUnlockButton,
    unlockButtonTimerRef,
    // Toast (unified)
    toastMessage,
    showToast,
    setToast,
    toastTimerRef,
    // Text overlay
    isTextVisible,
    setIsTextVisible,
    // Fullscreen
    isFullScreen,
    setIsFullScreen,
    // Subtitle delay
    subtitleDelay,
    setSubtitleDelay,
    // Buffering
    isBuffering,
    setIsBuffering,
    handleBufferChange,
    bufferingStartTimeRef,
    // Handlers
    handleResizeMode,
    togglePlayerLock,
    toggleFullScreen,
    handleLockedScreenTap,
  };
};