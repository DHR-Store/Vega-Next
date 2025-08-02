import React, {useCallback, useState, useEffect, useRef} from 'react';
import {
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Pressable,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../../App'; // Assuming HomeStackParamList is in App.tsx
import YoutubeIframe from 'react-native-youtube-iframe';
import Ionicons from '@expo/vector-icons/Ionicons';
import useThemeStore from '../../lib/zustand/themeStore';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

// You will need to install these libraries
// npm install react-native-reanimated react-native-gesture-handler
// or yarn add react-native-reanimated react-native-gesture-handler

type Props = NativeStackScreenProps<HomeStackParamList, 'WatchTrailer'>;

// Get screen dimensions for responsive video player sizing
const {width} = Dimensions.get('window');
const videoHeight = (width / 16) * 9; // Maintain a 16:9 aspect ratio

const WatchTrailer = ({navigation, route}: Props): React.JSX.Element => {
  const {videoId} = route.params;
  const {primary} = useThemeStore(state => state);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef(null);

  // Reanimated shared values for UI visibility
  const controlsOpacity = useSharedValue(1);

  // Hide controls after a few seconds
  const hideControls = useCallback(() => {
    controlsOpacity.value = withTiming(0, {duration: 300});
  }, [controlsOpacity]);

  // Show controls and reset the timer to hide them
  const showControls = useCallback(() => {
    controlsOpacity.value = withTiming(1, {duration: 300});
  }, [controlsOpacity]);

  const onStateChange = useCallback(
    (state: string) => {
      if (state === 'playing') {
        setIsLoading(false);
        setIsPlaying(true);
        // Automatically hide controls after 3 seconds of playing
        setTimeout(hideControls, 3000);
      } else if (state === 'paused') {
        setIsPlaying(false);
        showControls();
      } else if (state === 'error') {
        setIsError(true);
        setIsLoading(false);
        showControls();
      } else if (state === 'buffering') {
        setIsLoading(true);
      }
    },
    [hideControls, showControls],
  );

  useEffect(() => {
    if (videoId) {
      setIsLoading(true);
      setIsError(false);
    } else {
      setIsLoading(false);
      setIsError(true);
    }
  }, [videoId]);

  const togglePlayPause = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    }
  };

  const seekTo = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true);
    }
  };

  const onReady = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.getDuration().then(setVideoDuration);
    }
  }, []);

  const onPlaybackRateChange = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.getCurrentTime().then(setCurrentTime);
    }
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const controlsAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: controlsOpacity.value,
    };
  });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (controlsOpacity.value === 0) {
      showControls();
    } else {
      hideControls();
    }
  });

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <StatusBar
          barStyle="light-content"
          translucent={true}
          backgroundColor="transparent"
        />
        <SafeAreaView style={styles.safeArea}>
          {/* Absolute positioned header for the back button and title */}
          <Animated.View
            entering={FadeIn.delay(100).duration(500)}
            style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[
                styles.backButton,
                {backgroundColor: 'rgba(0,0,0,0.5)'},
              ]}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Trailer</Text>
          </Animated.View>

          {/* Video Player Container */}
          <View style={styles.videoContainer}>
            {videoId && !isError ? (
              <GestureDetector gesture={tapGesture}>
                <View style={styles.playerWrapper}>
                  {isLoading && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color={primary} />
                      <Text style={styles.loadingText}>
                        Loading trailer...
                      </Text>
                    </View>
                  )}
                  <Animated.View
                    entering={FadeIn.duration(800)}
                    style={styles.iframeWrapper}>
                    <YoutubeIframe
                      ref={playerRef}
                      height={videoHeight}
                      play={isPlaying}
                      videoId={videoId}
                      onReady={onReady}
                      onChangeState={onStateChange}
                      onPlaybackRateChange={onPlaybackRateChange}
                      webViewProps={{
                        androidLayerType: 'hardware',
                      }}
                    />
                  </Animated.View>

                  <Animated.View
                    style={[styles.controlsOverlay, controlsAnimatedStyle]}>
                    <View style={styles.topControls} />
                    <View style={styles.middleControls}>
                      <TouchableOpacity
                        onPress={() => seekTo(currentTime - 10)}
                        style={styles.controlButton}>
                        <Ionicons
                          name="play-back-outline"
                          size={40}
                          color="white"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={togglePlayPause}
                        style={styles.controlButton}>
                        <Ionicons
                          name={isPlaying ? 'pause' : 'play'}
                          size={60}
                          color="white"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => seekTo(currentTime + 10)}
                        style={styles.controlButton}>
                        <Ionicons
                          name="play-forward-outline"
                          size={40}
                          color="white"
                        />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.bottomControls}>
                      <Pressable
                        style={styles.progressBarContainer}
                        onPressIn={e => {
                          const {locationX} = e.nativeEvent;
                          const progress = locationX / width;
                          seekTo(progress * videoDuration);
                        }}>
                        <View style={styles.progressBarBackground} />
                        <View
                          style={[
                            styles.progressBarFill,
                            {width: `${(currentTime / videoDuration) * 100}%`},
                          ]}
                        />
                      </Pressable>
                      <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>
                          {formatTime(currentTime)}
                        </Text>
                        <Text style={styles.timeText}>
                          {formatTime(videoDuration)}
                        </Text>
                      </View>
                    </View>
                  </Animated.View>
                </View>
              </GestureDetector>
            ) : (
              <Animated.View
                entering={FadeIn.duration(800)}
                style={styles.noTrailerContainer}>
                <Ionicons name="film-outline" size={60} color="gray" />
                <Text style={styles.noTrailerText}>
                  No trailer available for this movie.
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={[styles.goBackButton, {backgroundColor: primary}]}>
                  <Text style={styles.goBackText}>Go Back</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
};

// Stylesheet for a cleaner and more structured approach
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    zIndex: 10,
    marginTop: 32, // To account for the SafeAreaView and give some space
  },
  backButton: {
    padding: 8,
    borderRadius: 9999,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerWrapper: {
    width: '100%',
    height: videoHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 2,
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  iframeWrapper: {
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  noTrailerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noTrailerText: {
    color: 'gray',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  goBackButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  goBackText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
    zIndex: 3,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  middleControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
  },
  bottomControls: {
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  controlButton: {
    padding: 10,
  },
  progressBarContainer: {
    height: 5,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 5,
  },
  progressBarBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 5,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  timeText: {
    color: 'white',
    fontSize: 12,
  },
});

export default WatchTrailer;