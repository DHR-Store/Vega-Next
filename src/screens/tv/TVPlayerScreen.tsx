import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {
  ScrollView,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  StatusBar,
  TouchableNativeFeedback,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Layout,
} from 'react-native-reanimated';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {VegaTVStackParamList} from '../../App';
import Video, {
  VideoRef,
  SelectedTrackType,
  ResizeMode,
  OnLoadData,
  OnProgressData,
  OnVideoErrorData,
} from 'react-native-video';
import {useNavigation} from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {SafeAreaView} from 'react-native-safe-area-context';
import FullScreenChz from 'react-native-fullscreen-chz';
import Ionicons from '@expo/vector-icons/Ionicons';
import OrientationLocker, {
  LANDSCAPE,
  PORTRAIT,
} from 'react-native-orientation-locker';

// --- Placeholder/Mock Hooks & Stores ---
const useThemeStore = (state: string) => {
  return {primary: '#007AFF'};
};
const useStream = (options: {activeEpisode: any; routeParams: any}) => {
  const {streamUrl} = options.routeParams;
  const [selectedStream, setSelectedStream] = useState({
    link: streamUrl,
    quality: 'auto',
  });
  const [streamData, setStreamData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (streamUrl) {
      setTimeout(() => {
        setIsLoading(false);
        setStreamData([{link: streamUrl, quality: 'auto'}]);
      }, 500);
    } else {
      setIsLoading(false);
      setError('No stream URL provided');
    }
  }, [streamUrl]);
  const switchToNextStream = useCallback(() => {
    console.log('No next stream to switch to.');
    return false;
  }, []);
  return {
    streamData,
    selectedStream,
    setSelectedStream,
    externalSubs: [],
    setExternalSubs: () => {},
    isLoading,
    error,
    switchToNextStream,
  };
};
const useVideoSettings = () => {
  const [audioTracks, setAudioTracks] = useState([]);
  const [textTracks, setTextTracks] = useState([]);
  const [videoTracks, setVideoTracks] = useState([]);
  const [selectedAudioTrackIndex, setSelectedAudioTrackIndex] = useState(-1);
  const [selectedTextTrackIndex, setSelectedTextTrackIndex] = useState(-1);
  const [selectedQualityIndex, setSelectedQualityIndex] = useState(-1);
  const processAudioTracks = useCallback((tracks: any[]) => {
    setAudioTracks(tracks);
    if (tracks.length > 0) {
      setSelectedAudioTrackIndex(0);
    } else {
      setSelectedAudioTrackIndex(-1);
    }
  }, []);
  const processTextTracks = useCallback((tracks: any[]) => {
    setTextTracks(tracks);
    setSelectedTextTrackIndex(-1);
  }, []);
  const processVideoTracks = useCallback((tracks: any[]) => {
    setVideoTracks(tracks);
    setSelectedQualityIndex(-1);
  }, []);
  const selectedAudioTrack = useMemo(() => {
    if (
      selectedAudioTrackIndex !== -1 &&
      audioTracks[selectedAudioTrackIndex]
    ) {
      return {
        type: SelectedTrackType.INDEX,
        value: selectedAudioTrackIndex,
      };
    }
    return undefined;
  }, [selectedAudioTrackIndex, audioTracks]);
  const selectedTextTrack = useMemo(() => {
    if (selectedTextTrackIndex !== -1 && textTracks[selectedTextTrackIndex]) {
      return {
        type: SelectedTrackType.INDEX,
        value: selectedTextTrackIndex,
      };
    }
    return {type: SelectedTrackType.DISABLED};
  }, [selectedTextTrackIndex, textTracks]);
  const selectedVideoTrack = useMemo(() => {
    if (selectedQualityIndex !== -1 && videoTracks[selectedQualityIndex]) {
      return {
        type: SelectedTrackType.INDEX,
        value: selectedQualityIndex,
      };
    }
    return {type: SelectedTrackType.AUTO};
  }, [selectedQualityIndex, videoTracks]);
  return {
    audioTracks,
    textTracks,
    videoTracks,
    selectedAudioTrackIndex,
    selectedTextTrackIndex,
    selectedQualityIndex,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setSelectedQualityIndex,
    processAudioTracks,
    setTextTracks: processTextTracks,
    processVideoTracks,
    selectedAudioTrack,
    selectedTextTrack,
    selectedVideoTrack,
  };
};
const usePlayerSettings = () => {
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('quality');
  const [resizeMode, setResizeMode] = useState<ResizeMode>('contain');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isPlayerLocked, setIsPlayerLocked] = useState(false);
  const [showUnlockButton, setShowUnlockButton] = useState(false);
  const unlockButtonTimerRef = useRef(null);
  const handleResizeMode = useCallback(() => {
    setResizeMode(prevMode => (prevMode === 'contain' ? 'cover' : 'contain'));
  }, []);
  const togglePlayerLock = useCallback(() => {
    setIsPlayerLocked(prev => !prev);
    setShowUnlockButton(false);
    if (unlockButtonTimerRef.current) {
      clearTimeout(unlockButtonTimerRef.current);
    }
  }, []);
  const handleLockedScreenTap = useCallback(() => {
    if (isPlayerLocked) {
      setShowUnlockButton(true);
      if (unlockButtonTimerRef.current) {
        clearTimeout(unlockButtonTimerRef.current);
      }
      unlockButtonTimerRef.current = setTimeout(() => {
        setShowUnlockButton(false);
      }, 3000);
    }
  }, [isPlayerLocked]);
  return {
    showControls,
    setShowControls,
    showSettings,
    setShowSettings,
    activeTab,
    setActiveTab,
    resizeMode,
    playbackRate,
    setPlaybackRate,
    isPlayerLocked,
    showUnlockButton,
    handleResizeMode,
    togglePlayerLock,
    handleLockedScreenTap,
    unlockButtonTimerRef,
  };
};
const usePlayerProgress = (options: {
  activeEpisode: any;
  routeParams: any;
  playbackRate: number;
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const videoPositionRef = useRef(0);
  const updatePlaybackInfo = useCallback(() => {}, []);
  const handleProgress = useCallback((data: OnProgressData) => {
    videoPositionRef.current = data.currentTime;
    setCurrentTime(data.currentTime);
  }, []);
  const handleLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    setIsPaused(false);
  }, []);
  return {
    videoPositionRef,
    handleProgress,
    handleLoad,
    currentTime,
    duration,
    isPaused,
    setIsPaused,
  };
};

type TVPlayerScreenProps = NativeStackScreenProps<
  VegaTVStackParamList,
  'TVPlayerScreen'
>;

const TVPlayerScreen: React.FC<TVPlayerScreenProps> = ({route}) => {
  const {primary} = useThemeStore('primary');
  const {streamUrl, poster, title, subtitle} = route.params;

  const navigation = useNavigation();
  const playerRef: React.RefObject<VideoRef> = useRef(null);
  const hasSetInitialTracksRef = useRef(false);

  const loadingOpacity = useSharedValue(0);
  const loadingScale = useSharedValue(0.8);
  const loadingRotation = useSharedValue(0);
  const controlsOpacity = useSharedValue(0);
  const settingsTranslateY = useSharedValue(Dimensions.get('window').height);
  const settingsOpacity = useSharedValue(0);
  const lockButtonOpacity = useSharedValue(0);
  const lockButtonTranslateX = useSharedValue(150);

  const loadingContainerStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
    transform: [{scale: loadingScale.value}],
  }));

  const loadingIconStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${loadingRotation.value}deg`}],
  }));

  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const settingsStyle = useAnimatedStyle(() => ({
    transform: [{translateY: settingsTranslateY.value}],
    opacity: settingsOpacity.value,
  }));

  const lockButtonStyle = useAnimatedStyle(() => ({
    opacity: lockButtonOpacity.value,
    transform: [{translateX: lockButtonTranslateX.value}],
  }));

  const [activeEpisode] = useState({link: streamUrl});
  const {
    selectedStream,
    isLoading: streamLoading,
    error: streamError,
    switchToNextStream,
  } = useStream({
    activeEpisode: activeEpisode,
    routeParams: route.params,
  });

  const {
    audioTracks,
    textTracks,
    videoTracks,
    selectedAudioTrackIndex,
    selectedTextTrackIndex,
    selectedQualityIndex,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setSelectedQualityIndex,
    processAudioTracks,
    setTextTracks,
    processVideoTracks,
    selectedAudioTrack,
    selectedTextTrack,
    selectedVideoTrack,
  } = useVideoSettings();

  const {
    showControls,
    setShowControls,
    showSettings,
    setShowSettings,
    activeTab,
    setActiveTab,
    resizeMode,
    playbackRate,
    setPlaybackRate,
    isPlayerLocked,
    showUnlockButton,
    handleResizeMode,
    togglePlayerLock,
    handleLockedScreenTap,
  } = usePlayerSettings();

  const {
    handleProgress,
    handleLoad,
    currentTime,
    duration,
    isPaused,
    setIsPaused,
  } = usePlayerProgress({
    activeEpisode,
    routeParams: route.params,
    playbackRate,
  });

  const playbacks = useMemo(
    () => [0.25, 0.5, 1.0, 1.25, 1.35, 1.5, 1.75, 2],
    [],
  );

  const formatQuality = useCallback((quality: string | number) => {
    if (quality === 'auto') return 'Auto';
    const num = Number(quality);
    if (isNaN(num)) return 'Unknown';
    if (num > 1080) return '4K';
    if (num > 720) return '1080p';
    if (num > 480) return '720p';
    if (num > 360) return '480p';
    if (num > 240) return '360p';
    if (num > 144) return '240p';
    return `${num}p`;
  }, []);

  const formatTime = (timeInSeconds: number) => {
    const totalMinutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);

    const pad = (num: number) => (num < 10 ? '0' + num : num);

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const handleSeek = useCallback(
    (time: number) => {
      if (playerRef.current) {
        playerRef.current.seek(time);
      }
    },
    [playerRef],
  );

  const handleRewind = useCallback(() => {
    handleSeek(currentTime - 10);
  }, [currentTime, handleSeek]);

  const handleForward = useCallback(() => {
    handleSeek(currentTime + 10);
  }, [currentTime, handleSeek]);

  const handlePlayPause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, [setIsPaused]);

  const handleVideoError = useCallback(
    (e: OnVideoErrorData) => {
      console.log('PlayerError', e);

      if (
        e.error?.errorString ===
          'ExoPlaybackException: ERROR_CODE_BEHIND_LIVE_WINDOW' ||
        e.error?.errorCode === '21002'
      ) {
        ToastAndroid.show(
          'Lost connection to live stream. Reconnecting...',
          ToastAndroid.SHORT,
        );
        setTimeout(() => {
          playerRef.current?.seek(duration);
        }, 100);
        return;
      }

      if (!switchToNextStream()) {
        ToastAndroid.show(
          'Video could not be played, try again later',
          ToastAndroid.SHORT,
        );
        navigation.goBack();
      }
      setShowControls(true);
    },
    [switchToNextStream, navigation, setShowControls, duration, playerRef],
  );

  useEffect(() => {
    FullScreenChz.enable();

    // Use a safe check and call the imperative method
    if (OrientationLocker && OrientationLocker.lockToLandscape) {
      OrientationLocker.lockToLandscape();
    } else {
      console.warn('OrientationLocker.lockToLandscape is not available.');
    }

    const unsubscribe = navigation.addListener('beforeRemove', () => {
      FullScreenChz.disable();
      // Use a safe check and call the imperative method
      if (OrientationLocker && OrientationLocker.lockToPortrait) {
        OrientationLocker.lockToPortrait();
      }
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (streamLoading) {
      loadingOpacity.value = withTiming(1, {duration: 800});
      loadingScale.value = withTiming(1, {duration: 800});
      loadingRotation.value = withRepeat(
        withSequence(
          withDelay(500, withTiming(180, {duration: 900})),
          withTiming(180, {duration: 600}),
          withTiming(360, {duration: 900}),
          withTiming(360, {duration: 600}),
        ),
        -1,
      );
    } else {
      loadingOpacity.value = withTiming(0, {duration: 250});
      loadingScale.value = withTiming(0.8, {duration: 250});
    }
  }, [streamLoading, loadingOpacity, loadingScale, loadingRotation]);

  useEffect(() => {
    const shouldShowLock = isPlayerLocked && showUnlockButton;
    lockButtonTranslateX.value = withTiming(shouldShowLock ? 0 : 150, {
      duration: 250,
    });
    lockButtonOpacity.value = withTiming(shouldShowLock ? 1 : 0, {
      duration: 250,
    });
    controlsOpacity.value = withTiming(
      showControls && !isPlayerLocked ? 1 : 0,
      {duration: 250},
    );
  }, [
    isPlayerLocked,
    showUnlockButton,
    showControls,
    lockButtonOpacity,
    lockButtonTranslateX,
    controlsOpacity,
  ]);

  useEffect(() => {
    settingsTranslateY.value = withTiming(
      showSettings ? 0 : Dimensions.get('window').height,
      {duration: 250},
    );
    settingsOpacity.value = withTiming(showSettings ? 1 : 0, {duration: 250});
  }, [showSettings, settingsTranslateY, settingsOpacity]);

  const handleVideoLoad = useCallback(
    (data: OnLoadData) => {
      handleLoad(data);
      if (data.audioTracks.length > 0) processAudioTracks(data.audioTracks);
      if (data.textTracks.length > 0) setTextTracks(data.textTracks);
      if (data.videoTracks.length > 0) processVideoTracks(data.videoTracks);
    },
    [processAudioTracks, setTextTracks, processVideoTracks, handleLoad],
  );

  const getQualityText = useCallback(() => {
    if (selectedQualityIndex === -1) {
      return 'Auto';
    }
    const track = videoTracks[selectedQualityIndex];
    return track ? formatQuality(track.height) : 'Auto';
  }, [selectedQualityIndex, videoTracks, formatQuality]);

  const getSubtitleText = useCallback(() => {
    if (selectedTextTrackIndex === -1) {
      return 'Off';
    }
    const track = textTracks[selectedTextTrackIndex];
    return (
      track?.title || track?.language || `Sub ${selectedTextTrackIndex + 1}`
    );
  }, [selectedTextTrackIndex, textTracks]);

  const getAudioText = useCallback(() => {
    if (selectedAudioTrackIndex === -1) {
      return 'None';
    }
    const track = audioTracks[selectedAudioTrackIndex];
    return (
      track?.title || track?.language || `Audio ${selectedAudioTrackIndex + 1}`
    );
  }, [selectedAudioTrackIndex, audioTracks]);

  if (streamError) {
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>{streamError}</Text>
      </View>
    );
  }

  if (streamLoading || !selectedStream) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.loadingContainer, loadingContainerStyle]}>
          <Animated.View style={loadingIconStyle}>
            <ActivityIndicator size="large" color={primary} />
          </Animated.View>
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />

      <TouchableNativeFeedback
        onPress={
          isPlayerLocked
            ? handleLockedScreenTap
            : () => setShowControls(!showControls)
        }>
        <View style={styles.videoWrapper}>
          <Video
            ref={playerRef}
            source={{uri: selectedStream?.link}}
            style={styles.backgroundVideo}
            controls={false}
            paused={isPaused}
            onLoad={handleVideoLoad}
            onProgress={handleProgress}
            onError={handleVideoError}
            resizeMode={resizeMode}
            rate={playbackRate}
            selectedTextTrack={selectedTextTrack}
            selectedAudioTrack={selectedAudioTrack}
            selectedVideoTrack={selectedVideoTrack}
          />

          <Animated.View
            style={[styles.controlsOverlay, controlsStyle]}
            layout={Layout}>
            <View style={styles.controlsHeader}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.headerButton}>
                <Ionicons name="chevron-back-outline" size={30} color="white" />
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.videoTitleText}>
                  {title || 'TV Channel'}
                </Text>
                {subtitle && (
                  <Text style={styles.videoSubtitleText}>{subtitle}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={togglePlayerLock}
                style={[styles.headerButton, styles.lockButton]}>
                <Ionicons
                  name={
                    isPlayerLocked ? 'lock-closed-outline' : 'lock-open-outline'
                  }
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.middleControls}>
              <TouchableOpacity
                onPress={handleRewind}
                style={styles.middleButton}>
                <Ionicons
                  name="refresh-circle-outline"
                  size={50}
                  color="white"
                  style={styles.rotateLeft}
                />
                <Text style={styles.middleButtonText}>10</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePlayPause}
                style={styles.middleButton}>
                <Ionicons
                  name={
                    isPaused ? 'play-circle-outline' : 'pause-circle-outline'
                  }
                  size={80}
                  color="white"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleForward}
                style={styles.middleButton}>
                <Ionicons
                  name="refresh-circle-outline"
                  size={50}
                  color="white"
                  style={styles.rotateRight}
                />
                <Text style={styles.middleButtonText}>10</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.controlsFooter}>
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressIndicator,
                      {width: `${(currentTime / duration) * 100}%`},
                    ]}
                  />
                </View>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>

              <View style={styles.footerButtonsContainer}>
                <TouchableOpacity
                  onPress={() => {
                    setShowSettings(!showSettings);
                    setActiveTab('audio');
                  }}
                  style={styles.footerButton}>
                  <Ionicons
                    name="volume-high-outline"
                    size={24}
                    color="white"
                  />
                  <Text style={styles.footerButtonText}>{getAudioText()}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowSettings(!showSettings);
                    setActiveTab('subtitles');
                  }}
                  style={styles.footerButton}>
                  <Ionicons
                    name="closed-captioning-outline"
                    size={24}
                    color="white"
                  />
                  <Text style={styles.footerButtonText}>
                    {getSubtitleText()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowSettings(!showSettings);
                    setActiveTab('speed');
                  }}
                  style={styles.footerButton}>
                  <MaterialIcons name="speed" size={24} color="white" />
                  <Text style={styles.footerButtonText}>{playbackRate}x</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {}}
                  style={styles.footerButton}>
                  <MaterialIcons
                    name="picture-in-picture-alt"
                    size={24}
                    color="white"
                  />
                  <Text style={styles.footerButtonText}>PIP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowSettings(!showSettings);
                    setActiveTab('quality');
                  }}
                  style={styles.footerButton}>
                  <Ionicons name="ios-resize-outline" size={24} color="white" />
                  <Text style={styles.footerButtonText}>
                    {getQualityText()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleResizeMode}
                  style={styles.footerButton}>
                  <Ionicons name="expand-outline" size={24} color="white" />
                  <Text style={styles.footerButtonText}>
                    {resizeMode === 'contain' ? 'Fit' : 'Fill'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {isPlayerLocked && showUnlockButton && (
            <Animated.View
              style={[styles.lockButtonContainer, lockButtonStyle]}
              layout={Layout}>
              <TouchableOpacity
                onPress={togglePlayerLock}
                style={styles.unlockButton}>
                <Ionicons
                  name={'lock-closed-outline'}
                  size={40}
                  color="white"
                />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </TouchableNativeFeedback>

      <Animated.View
        style={[styles.settingsModal, settingsStyle]}
        layout={Layout}>
        <View style={styles.settingsHeader}>
          <TouchableOpacity onPress={() => setShowSettings(false)}>
            <Ionicons name="close-outline" size={30} color="white" />
          </TouchableOpacity>
        </View>
        <View style={styles.settingsContent}>
          <View style={styles.settingsBody}>
            {activeTab === 'quality' && (
              <ScrollView>
                <Text style={styles.tabHeading}>Video Quality</Text>
                <TouchableOpacity
                  style={styles.trackItem}
                  onPress={() => {
                    setSelectedQualityIndex(-1);
                    setShowSettings(false);
                  }}>
                  <Text
                    style={[
                      styles.trackText,
                      {color: selectedQualityIndex === -1 ? primary : 'white'},
                    ]}>
                    Auto
                  </Text>
                  {selectedQualityIndex === -1 && (
                    <MaterialIcons name="check" size={20} color="white" />
                  )}
                </TouchableOpacity>
                {videoTracks.map((track, i) => (
                  <TouchableOpacity
                    style={styles.trackItem}
                    key={i}
                    onPress={() => {
                      setSelectedQualityIndex(i);
                      setShowSettings(false);
                    }}>
                    <Text
                      style={[
                        styles.trackText,
                        {color: selectedQualityIndex === i ? primary : 'white'},
                      ]}>
                      {formatQuality(
                        track.height > track.width ? track.width : track.height,
                      )}
                    </Text>
                    {selectedQualityIndex === i && (
                      <MaterialIcons name="check" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {activeTab === 'speed' && (
              <ScrollView>
                <Text style={styles.tabHeading}>Playback Speed</Text>
                {playbacks.map((rate, i) => (
                  <TouchableOpacity
                    style={styles.trackItem}
                    key={i}
                    onPress={() => {
                      setPlaybackRate(rate);
                      setShowSettings(false);
                    }}>
                    <Text
                      style={[
                        styles.trackText,
                        {color: playbackRate === rate ? primary : 'white'},
                      ]}>
                      {rate}x
                    </Text>
                    {playbackRate === rate && (
                      <MaterialIcons name="check" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {activeTab === 'audio' && (
              <ScrollView>
                <Text style={styles.tabHeading}>Audio Tracks</Text>
                {audioTracks.map((track, i) => (
                  <TouchableOpacity
                    style={styles.trackItem}
                    key={i}
                    onPress={() => {
                      setSelectedAudioTrackIndex(i);
                      setShowSettings(false);
                    }}>
                    <Text
                      style={[
                        styles.trackText,
                        {
                          color:
                            selectedAudioTrackIndex === i ? primary : 'white',
                        },
                      ]}>
                      {track.language || track.title || `Audio ${i + 1}`}
                    </Text>
                    {selectedAudioTrackIndex === i && (
                      <MaterialIcons name="check" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {activeTab === 'subtitles' && (
              <ScrollView>
                <Text style={styles.tabHeading}>Subtitles</Text>
                <TouchableOpacity
                  style={styles.trackItem}
                  onPress={() => {
                    setSelectedTextTrackIndex(-1);
                    setShowSettings(false);
                  }}>
                  <Text
                    style={[
                      styles.trackText,
                      {
                        color:
                          selectedTextTrackIndex === -1 ? primary : 'white',
                      },
                    ]}>
                    Off
                  </Text>
                  {selectedTextTrackIndex === -1 && (
                    <MaterialIcons name="check" size={20} color="white" />
                  )}
                </TouchableOpacity>
                {textTracks.map((track, i) => (
                  <TouchableOpacity
                    style={styles.trackItem}
                    key={i}
                    onPress={() => {
                      setSelectedTextTrackIndex(i);
                      setShowSettings(false);
                    }}>
                    <Text
                      style={[
                        styles.trackText,
                        {
                          color:
                            selectedTextTrackIndex === i ? primary : 'white',
                        },
                      ]}>
                      {track.title || track.language || `Subtitle ${i + 1}`}
                    </Text>
                    {selectedTextTrackIndex === i && (
                      <MaterialIcons name="check" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  videoWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: 'black',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  controlsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    padding: 10,
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  videoTitleText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  videoSubtitleText: {
    color: 'gray',
    fontSize: 14,
  },
  lockButton: {
    padding: 10,
    borderRadius: 50,
  },
  middleControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  middleButton: {
    alignItems: 'center',
    marginHorizontal: 30,
    position: 'relative',
  },
  middleButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    position: 'absolute',
    top: '30%',
    left: '50%',
    transform: [{translateX: -10}, {translateY: -10}],
  },
  rotateLeft: {
    transform: [{scaleX: -1}],
  },
  rotateRight: {
    transform: [{scaleX: 1}],
  },
  controlsFooter: {
    justifyContent: 'space-between',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeText: {
    color: 'white',
    fontSize: 14,
    marginHorizontal: 5,
  },
  progressBar: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 5,
  },
  progressIndicator: {
    height: '100%',
    backgroundColor: '#ff0000',
    borderRadius: 5,
  },
  footerButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerButton: {
    alignItems: 'center',
  },
  footerButtonText: {
    color: 'white',
    fontSize: 12,
  },
  settingsModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    zIndex: 20,
    paddingTop: 40,
  },
  settingsHeader: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
  },
  settingsContent: {
    flex: 1,
  },
  settingsBody: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tabHeading: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  trackText: {
    fontSize: 16,
    fontWeight: '500',
  },
  messageText: {
    color: 'white',
    fontSize: 18,
  },
  lockButtonContainer: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    transform: [{translateY: -20}],
    zIndex: 100,
  },
  unlockButton: {
    padding: 10,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});

export default TVPlayerScreen;
