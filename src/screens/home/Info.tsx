import {
  Image,
  Text,
  View,
  StatusBar,
  RefreshControl,
  FlatList,
  Linking,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  PanResponder,
} from 'react-native';
import React, {useCallback, useMemo, useRef, useState, useEffect} from 'react';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import {HomeStackParamList, TabStackParamList} from '../../App';
import LinearGradient from 'react-native-linear-gradient';
import SeasonList from '../../components/SeasonList';
import {Skeleton} from 'moti/skeleton';
import Ionicons from '@expo/vector-icons/Ionicons';
import {settingsStorage, watchListStorage} from '../../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../../lib/zustand/contentStore';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import {useNavigation} from '@react-navigation/native';
import useWatchListStore from '../../lib/zustand/watchListStore';
import {useContentDetails} from '../../lib/hooks/useContentInfo';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import Video from 'react-native-video';
import useVideoPlayer from '../../lib/hooks/useVideoPlayer';

// A simple utility to format time from seconds to HH:MM:SS
const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m > 9 ? m : h ? '0' + m : m || '0', s > 9 ? s : '0' + s]
    .filter(a => a)
    .join(':');
};

const playBackSpeeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const qualities = ['1080p', '720p', '480p']; // Simplified for demonstration

// Custom Slider component to replace @react-native-community/slider
const CustomSlider = ({
  value,
  minimumValue,
  maximumValue,
  onSlidingComplete,
  minimumTrackTintColor = '#FFF',
  maximumTrackTintColor = 'rgba(255, 255, 255, 0.5)',
  thumbTintColor = '#FFF',
  style,
}: any) => {
  const [sliderWidth, setSliderWidth] = useState(0);
  const sliderRef = useRef<View>(null);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        const x = evt.nativeEvent.locationX;
        const newValue =
          (x / sliderWidth) * (maximumValue - minimumValue) + minimumValue;
        onSlidingComplete(newValue);
      },
      onPanResponderMove: (evt, gestureState) => {
        const newPosition = Math.max(
          0,
          Math.min(gestureState.x0 + gestureState.dx, sliderWidth),
        );
        const newValue =
          (newPosition / sliderWidth) * (maximumValue - minimumValue) +
          minimumValue;
        onSlidingComplete(newValue);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const newPosition = Math.max(
          0,
          Math.min(gestureState.x0 + gestureState.dx, sliderWidth),
        );
        const newValue =
          (newPosition / sliderWidth) * (maximumValue - minimumValue) +
          minimumValue;
        onSlidingComplete(newValue);
      },
    });
  }, [sliderWidth, minimumValue, maximumValue, onSlidingComplete]);

  const onLayout = (event: any) => {
    setSliderWidth(event.nativeEvent.layout.width);
  };

  const trackWidth =
    ((value - minimumValue) / (maximumValue - minimumValue)) * sliderWidth;

  return (
    <View
      ref={sliderRef}
      onLayout={onLayout}
      style={[style, sliderStyles.container]}
      {...panResponder.current.panHandlers}>
      {/* The track */}
      <View
        style={[sliderStyles.track, {backgroundColor: maximumTrackTintColor}]}
      />
      {/* The progress */}
      <View
        style={[
          sliderStyles.track,
          sliderStyles.progress,
          {width: trackWidth, backgroundColor: minimumTrackTintColor},
        ]}
      />
      {/* The thumb */}
      <View
        style={[
          sliderStyles.thumb,
          {left: trackWidth - 7, backgroundColor: thumbTintColor},
        ]}
      />
    </View>
  );
};

const sliderStyles = StyleSheet.create({
  container: {
    height: 30,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    right: 0,
  },
  progress: {
    left: 0,
    right: 'auto',
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    elevation: 3,
  },
});

// The WatchTrailer component is now included here for a self-contained solution.
function WatchTrailer({
  route,
  navigation,
}: NativeStackScreenProps<
  HomeStackParamList,
  'WatchTrailer'
>): React.JSX.Element {
  const {videoId} = route.params;

  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<
    'settings' | 'quality' | 'speed' | 'audio' | 'caption' | null
  >(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [captionEnabled, setCaptionEnabled] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
  const [captionTracks, setCaptionTracks] = useState([]);
  const [selectedCaptionTrack, setSelectedCaptionTrack] = useState(null);
  const [pipEnabled, setPipEnabled] = useState(false);

  // A simple timer to hide controls after a few seconds of inactivity
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showControls && isPlaying) {
      timer = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [showControls, isPlaying]);

  const togglePlayPause = () => {
    setIsPlaying(prev => !prev);
    setShowControls(true);
  };

  const onProgress = (data: {currentTime: number}) => {
    setCurrentTime(data.currentTime);
  };

  const onLoad = (data: {
    duration: number;
    audioTracks: any[];
    textTracks: any[];
  }) => {
    setDuration(data.duration);
    setAudioTracks(data.audioTracks || []);
    setCaptionTracks(data.textTracks || []);
  };

  const onEnd = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const onSeek = (value: number) => {
    if (videoRef.current) {
      videoRef.current.seek(value);
      setCurrentTime(value);
    }
  };

  const toggleFullScreen = () => {
    setIsFullScreen(prev => !prev);
  };

  const togglePIP = () => {
    setPipEnabled(prev => !prev);
  };

  const openModal = (
    type: 'settings' | 'quality' | 'speed' | 'audio' | 'caption',
  ) => {
    setModalType(type);
    setModalVisible(true);
  };

  const selectPlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    setModalVisible(false);
  };

  const selectQuality = (quality: string) => {
    setSelectedQuality(quality);
    setModalVisible(false);
  };

  const selectAudioTrack = (track: any) => {
    setSelectedAudioTrack(track);
    setModalVisible(false);
  };

  const selectCaptionTrack = (track: any) => {
    setSelectedCaptionTrack(track);
    setModalVisible(false);
  };

  const renderModalContent = () => {
    switch (modalType) {
      case 'quality':
        return (
          <View>
            <Text style={trailerStyles.modalTitle}>Select Video Quality</Text>
            <FlatList
              data={qualities}
              renderItem={({item}) => (
                <TouchableOpacity
                  onPress={() => selectQuality(item)}
                  style={trailerStyles.modalItem}>
                  <Text style={trailerStyles.modalText}>{item}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item}
            />
          </View>
        );
      case 'speed':
        return (
          <View>
            <Text style={trailerStyles.modalTitle}>Select Playback Speed</Text>
            <FlatList
              data={playBackSpeeds}
              renderItem={({item}) => (
                <TouchableOpacity
                  onPress={() => selectPlaybackSpeed(item)}
                  style={trailerStyles.modalItem}>
                  <Text style={trailerStyles.modalText}>{item}x</Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item.toString()}
            />
          </View>
        );
      case 'audio':
        return (
          <View>
            <Text style={trailerStyles.modalTitle}>Select Audio Track</Text>
            <FlatList
              data={audioTracks}
              renderItem={({item}) => (
                <TouchableOpacity
                  onPress={() => selectAudioTrack(item)}
                  style={trailerStyles.modalItem}>
                  <Text style={trailerStyles.modalText}>
                    {item.language} - {item.title || 'Unknown'}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item.id}
            />
          </View>
        );
      case 'caption':
        return (
          <View>
            <Text style={trailerStyles.modalTitle}>Select Caption Track</Text>
            <FlatList
              data={captionTracks}
              renderItem={({item}) => (
                <TouchableOpacity
                  onPress={() => selectCaptionTrack(item)}
                  style={trailerStyles.modalItem}>
                  <Text style={trailerStyles.modalText}>
                    {item.language} - {item.title || 'Unknown'}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item.language}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={trailerStyles.container}>
      <TouchableOpacity
        onPress={() => setShowControls(true)}
        activeOpacity={1}
        style={trailerStyles.videoContainer}>
        <Video
          ref={videoRef}
          source={{uri: `https://www.youtube.com/watch?v=${videoId}`}}
          style={
            isFullScreen
              ? trailerStyles.fullscreenPlayer
              : trailerStyles.videoPlayer
          }
          resizeMode="contain"
          onProgress={onProgress}
          onLoad={onLoad}
          onEnd={onEnd}
          paused={!isPlaying}
          rate={playbackSpeed}
          pictureInPicture={pipEnabled}
          controls={false}
          textTracks={captionEnabled ? captionTracks : []}
          selectedTextTrack={captionEnabled ? selectedCaptionTrack : undefined}
          selectedTextTrackType="language"
          selectedAudioTrack={selectedAudioTrack}
          selectedAudioTrackType="language"
        />
        {showControls && (
          <View style={trailerStyles.controlsContainer}>
            {/* Top controls */}
            <View style={trailerStyles.topControls}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={trailerStyles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={trailerStyles.videoTitle}>Trailer</Text>
            </View>

            {/* Center play/pause button */}
            <TouchableOpacity
              onPress={togglePlayPause}
              style={trailerStyles.playPauseButton}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={60}
                color="#FFF"
              />
            </TouchableOpacity>

            {/* Bottom controls */}
            <View style={trailerStyles.bottomControls}>
              <View style={trailerStyles.playbackControls}>
                <Text style={trailerStyles.timeText}>
                  {formatTime(currentTime)}
                </Text>
                <CustomSlider
                  style={trailerStyles.slider}
                  minimumValue={0}
                  maximumValue={duration}
                  value={currentTime}
                  onSlidingComplete={onSeek}
                  minimumTrackTintColor="#FFF"
                  maximumTrackTintColor="rgba(255, 255, 255, 0.5)"
                  thumbTintColor="#FFF"
                />
                <Text style={trailerStyles.timeText}>
                  {formatTime(duration)}
                </Text>
              </View>

              {/* Action buttons */}
              <View style={trailerStyles.actionButtons}>
                <TouchableOpacity
                  onPress={() => openModal('quality')}
                  style={trailerStyles.actionButton}>
                  <Ionicons name="settings-sharp" size={24} color="#FFF" />
                  <Text style={trailerStyles.actionText}>
                    {selectedQuality}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openModal('speed')}
                  style={trailerStyles.actionButton}>
                  <MaterialCommunityIcons
                    name="speedometer"
                    size={24}
                    color="#FFF"
                  />
                  <Text style={trailerStyles.actionText}>{playbackSpeed}x</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openModal('caption')}
                  style={trailerStyles.actionButton}>
                  <MaterialCommunityIcons
                    name={
                      captionEnabled
                        ? 'closed-caption'
                        : 'closed-caption-outline'
                    }
                    size={24}
                    color="#FFF"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openModal('audio')}
                  style={trailerStyles.actionButton}>
                  <Ionicons name="volume-high-outline" size={24} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={togglePIP}
                  style={trailerStyles.actionButton}>
                  <MaterialCommunityIcons
                    name={
                      pipEnabled ? 'arrow-collapse-left' : 'arrow-expand-all'
                    }
                    size={24}
                    color="#FFF"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleFullScreen}
                  style={trailerStyles.actionButton}>
                  <Ionicons
                    name={isFullScreen ? 'arrow-down-left' : 'expand'}
                    size={24}
                    color="#FFF"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Modal for settings */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={trailerStyles.modalView}>
          {renderModalContent()}
          <TouchableOpacity
            style={trailerStyles.closeModalButton}
            onPress={() => setModalVisible(false)}>
            <Text style={trailerStyles.closeModalText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const trailerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: 250, // Fixed height for non-fullscreen
  },
  fullscreenPlayer: {
    width: '100%',
    height: '100%',
  },
  controlsContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'space-between',
    padding: 10,
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  backButton: {
    position: 'absolute',
    left: 10,
  },
  videoTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playPauseButton: {
    alignSelf: 'center',
    opacity: 0.8,
  },
  bottomControls: {
    width: '100%',
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeText: {
    color: '#FFF',
    fontSize: 12,
  },
  slider: {
    flex: 1,
    marginHorizontal: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  actionText: {
    color: '#FFF',
    marginLeft: 5,
    fontSize: 12,
  },
  modalView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 20,
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    width: 200,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#FFF',
  },
  closeModalButton: {
    marginTop: 20,
    backgroundColor: 'red',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  closeModalText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});

// Mock function to simulate a call to the Gemini API to search for a YouTube video ID.
// In a real-world scenario, you would replace this with a proper API call
// to a backend service that interacts with the YouTube API.
const getYoutubeTrailerId = async (
  title: string,
  year: string,
): Promise<string | null> => {
  // Use gemini-2.5-flash-preview-05-20 to search for the trailer.
  const prompt = `Find the YouTube video ID for the official trailer of "${title}" (${year}). Provide only the video ID. If no official trailer is found, return "null".`;
  let chatHistory = [];
  chatHistory.push({role: 'user', parts: [{text: prompt}]});
  const payload = {contents: chatHistory};
  const apiKey = 'AIzaSyBTpP0-7enNqizPGetb_2G5Km_pKdguNF8'; // Leave as empty string for automatic provision
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  // Exponential backoff retry logic
  let retries = 0;
  const maxRetries = 5;
  const initialDelay = 1000;

  while (retries < maxRetries) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // If the error is a rate limit error, retry with exponential backoff
        if (response.status === 429) {
          retries++;
          const delay = initialDelay * Math.pow(2, retries - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Continue to the next retry attempt
        } else {
          // For other errors, throw an error to exit the loop
          throw new Error(`API error: ${response.statusText}`);
        }
      }

      const result = await response.json();
      const videoId = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      // Basic validation for the video ID format
      if (videoId && typeof videoId === 'string' && videoId.length === 11) {
        return videoId;
      }
      return null;
    } catch (error) {
      console.error('Error fetching YouTube video ID:', error);
      retries++;
      const delay = initialDelay * Math.pow(2, retries - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error('Max retries reached. Failed to fetch YouTube video ID.');
  return null;
};

type Props = NativeStackScreenProps<HomeStackParamList, 'Info'>;

// Custom Switch component with the color change logic inverted
const CustomSwitch = ({label, icon, active, onToggle, primaryColor}: any) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onToggle}
      // The background color is now the primary color when INACTIVE
      className={`flex-1 flex-row items-center p-3 rounded-xl transition-colors duration-300 ${
        active ? 'bg-[#1A1A1A]' : `bg-[${primaryColor}]`
      }`}>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        // Icon color is now white when INACTIVE
        color={active ? primaryColor : '#FFFFFF'}
      />
      <Text
        className={`text-sm font-semibold ml-2 transition-colors duration-300 ${
          // Text color is now white when INACTIVE
          active ? 'text-gray-400' : 'text-white'
        }`}>
        {label}
      </Text>
      <View
        className={`ml-auto w-10 h-5 rounded-full transition-colors duration-300 ${
          active ? 'bg-gray-600' : `bg-gray-600`
        }`}
        style={{
          justifyContent: 'center',
          alignItems: active ? 'flex-end' : 'flex-start',
          paddingHorizontal: 2,
        }}>
        <View className="w-4 h-4 rounded-full bg-white shadow-md" />
      </View>
    </TouchableOpacity>
  );
};

export default function Info({route, navigation}: Props): React.JSX.Element {
  // All hooks must be called unconditionally at the top of the component
  const searchNavigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const {primary} = useThemeStore(state => state);
  const {addItem, removeItem} = useWatchListStore(state => state);
  const {provider} = useContentStore(state => state);

  const {
    info,
    meta,
    isLoading: infoLoading,
    error,
    refetch,
  } = useContentDetails(
    route.params.link,
    route.params.provider || provider.value,
  );

  const [threeDotsMenuOpen, setThreeDotsMenuOpen] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [menuPosition, setMenuPosition] = useState({top: -1000, right: 0});
  const [backgroundColor, setBackgroundColor] = useState('transparent');
  const [logoError, setLogoError] = useState(false);
  const [inLibrary, setInLibrary] = useState(
    watchListStorage.isInWatchList(route.params.link),
  );

  const [useExternalPlayer, setUseExternalPlayer] = useState(
    settingsStorage.getBool('useExternalPlayer', false),
  );
  const [useExternalDownloader, setUseExternalDownloader] = useState(
    settingsStorage.getBool('alwaysExternalDownloader', false),
  );

  // New state for the YouTube video ID and loading status
  const [ytVideoId, setYtVideoId] = useState<string | null>(null);
  const [isFetchingTrailer, setIsFetchingTrailer] = useState(false);

  const threeDotsRef = useRef<any>();

  // This ref will be used to track if the component is mounted,
  // preventing state updates on unmounted components.
  const isMounted = useRef(true);

  // Set up the isMounted ref and its cleanup function
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const openThreeDotsMenu = useCallback(() => {
    if (threeDotsRef.current) {
      threeDotsRef.current.measure(
        (
          x: number,
          y: number,
          width: number,
          height: number,
          pageX: number,
          pageY: number,
        ) => {
          setMenuPosition({top: pageY - 35, right: 35});
          setThreeDotsMenuOpen(true);
        },
      );
    }
  }, []);

  const handleScroll = useCallback((event: any) => {
    setBackgroundColor(
      event.nativeEvent.contentOffset.y > 150 ? 'black' : 'transparent',
    );
  }, []);

  const addLibrary = useCallback(() => {
    ReactNativeHapticFeedback.trigger('effectClick', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    addItem({
      title: meta?.name || info?.title,
      poster: meta?.poster || route.params.poster || info?.image,
      link: route.params.link,
      provider: route.params.provider || provider.value,
    });
    setInLibrary(true);
  }, [meta, info, route.params, provider.value, addItem]);

  const removeLibrary = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    removeItem(route.params.link);
    setInLibrary(false);
  }, [route.params.link, removeItem]);

  const synopsis = useMemo(() => {
    return meta?.description || info?.synopsis || 'No synopsis available';
  }, [meta?.description, info?.synopsis]);

  const displayTitle = useMemo(() => {
    return meta?.name || info?.title;
  }, [meta?.name, info?.title]);

  const posterImage = useMemo(() => {
    return (
      meta?.poster ||
      route.params.poster ||
      info?.image ||
      'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega'
    );
  }, [meta?.poster, route.params.poster, info?.image]);

  const backgroundImage = useMemo(() => {
    return (
      meta?.background ||
      info?.image ||
      'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega'
    );
  }, [meta?.background, info?.image]);

  // Fix: De-duplicate the link list to resolve the "duplicate key" error
  const filteredLinkList = useMemo(() => {
    if (!info?.linkList) {
      return [];
    }
    const excludedQualities = settingsStorage.getExcludedQualities();
    const filtered = info.linkList.filter(
      (item: any) =>
        !item.quality || !excludedQualities.includes(item.quality as string),
    );

    // Use a Map to filter out duplicate links, keeping the first one found
    const uniqueLinksMap = new Map();
    filtered.forEach(item => {
      if (item.link && !uniqueLinksMap.has(item.link)) {
        uniqueLinksMap.set(item.link, item);
      }
    });

    const filteredAndUnique = Array.from(uniqueLinksMap.values());

    // Return the unique list, or the original list if the filtered one is empty.
    return filteredAndUnique.length > 0 ? filteredAndUnique : info.linkList;
  }, [info?.linkList]);

  const castList = useMemo(() => {
    return meta?.cast?.length! > 0 ? meta?.cast : info?.cast;
  }, [meta?.cast, info?.cast]);

  const handleRefresh = useCallback(async () => {
    try {
      await refetch();
      setInLibrary(watchListStorage.isInWatchList(route.params.link));
      setUseExternalPlayer(settingsStorage.getBool('useExternalPlayer', false));
      setUseExternalDownloader(
        settingsStorage.getBool('alwaysExternalDownloader', false),
      );
    } catch (refreshError) {
      console.error('Error refreshing content:', refreshError);
    }
  }, [refetch]);

  const handleToggleExternalPlayer = useCallback(() => {
    const newState = !useExternalPlayer;
    setUseExternalPlayer(newState);
    settingsStorage.setBool('useExternalPlayer', newState);
  }, [useExternalPlayer]);

  const handleToggleExternalDownloader = useCallback(() => {
    const newState = !useExternalDownloader;
    setUseExternalDownloader(newState);
    settingsStorage.setBool('alwaysExternalDownloader', newState);
  }, [useExternalDownloader]);

  const handleExternalPlayer = useCallback(() => {
    const videoUrl = filteredLinkList?.[0]?.link;
    if (videoUrl) {
      Linking.openURL(videoUrl).catch(err =>
        console.error('Failed to open URL:', err),
      );
    } else {
      console.warn('No video URL found for external playback.');
    }
  }, [filteredLinkList]);

  const handleExternalDownload = useCallback(() => {
    const downloadUrl = filteredLinkList?.[0]?.link;
    if (downloadUrl) {
      Linking.openURL(downloadUrl).catch(err =>
        console.error('Failed to open URL:', err),
      );
    } else {
      console.warn('No download URL found.');
    }
  }, [filteredLinkList]);

  // useEffect to fetch trailer if one is not provided by the current provider.
  useEffect(() => {
    const fetchTrailer = async () => {
      // Check if a trailer is already available from the provider
      const providerTrailer = meta?.trailers?.[0]?.source;
      if (providerTrailer) {
        if (isMounted.current) {
          setYtVideoId(providerTrailer);
        }
        return;
      }

      // If not, fetch from YouTube API
      if (displayTitle && meta?.year && !infoLoading) {
        if (isMounted.current) {
          setIsFetchingTrailer(true);
        }
        const videoId = await getYoutubeTrailerId(displayTitle, meta.year);
        if (isMounted.current) {
          setYtVideoId(videoId);
          setIsFetchingTrailer(false);
        }
      }
    };

    fetchTrailer();
  }, [displayTitle, meta?.year, meta?.trailers, infoLoading]);

  // Conditionally render based on error state after all hooks are called
  if (error) {
    return (
      <View className="h-full w-full bg-black justify-center items-center p-4">
        <StatusBar
          showHideTransition={'slide'}
          animated={true}
          translucent={true}
          backgroundColor="black"
        />
        <Text className="text-red-400 text-lg font-bold mb-4 text-center">
          Failed to load content
        </Text>
        <Text className="text-gray-400 text-sm mb-6 text-center">
          {error.message ||
            'An unexpected error occurred while loading the content'}
        </Text>
        <TouchableOpacity
          onPress={handleRefresh}
          className="bg-red-600 px-6 py-3 rounded-lg mb-4">
          <Text className="text-white font-semibold">Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-gray-600 px-6 py-3 rounded-lg">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Conditionally render the main content or loading state
  const renderContent = () => {
    if (infoLoading || !info) {
      return (
        <View className="gap-y-3 items-start mb-4 p-3 bg-black">
          <Skeleton show={true} colorMode="dark" height={30} width={80} />
          {[...Array(3)].map((_, i) => (
            <View
              className="bg-tertiary p-1 rounded-md gap-3 mt-3 w-full"
              key={i}>
              <Skeleton
                show={true}
                colorMode="dark"
                height={20}
                width={'100%'}
              />
            </View>
          ))}
        </View>
      );
    }

    const seasonList = (
      <SeasonList
        refreshing={false}
        providerValue={route.params.provider || provider.value}
        LinkList={filteredLinkList}
        poster={{
          logo: meta?.logo,
          poster: posterImage,
          background: backgroundImage,
        }}
        type={info?.type || 'series'}
        metaTitle={displayTitle}
        routeParams={route.params}
      />
    );

    return (
      <>
        <View className="p-4 bg-black">
          <View className="flex-row gap-x-3 gap-y-1 flex-wrap items-center mb-4">
            {meta?.year && (
              <Text className="text-white text-lg bg-tertiary px-2 rounded-md">
                {meta?.year}
              </Text>
            )}
            {meta?.runtime && (
              <Text className="text-white text-lg bg-tertiary px-2 rounded-md">
                {meta?.runtime}
              </Text>
            )}
            {meta?.genres?.slice(0, 2).map((genre: string) => (
              <Text
                key={genre}
                className="text-white text-lg bg-tertiary px-2 rounded-md">
                {genre}
              </Text>
            ))}
            {info?.tags?.slice(0, 3)?.map((tag: string) => (
              <Text
                key={tag}
                className="text-white text-lg bg-tertiary px-2 rounded-md">
                {tag}
              </Text>
            ))}
          </View>
          {meta?.awards && (
            <View className="mb-2 w-full flex-row items-baseline gap-2">
              <Text className="text-white text-sm font-semibold">Awards:</Text>
              <Text className="text-white text-xs px-1 bg-tertiary rounded-sm">
                {meta?.awards?.length > 50
                  ? meta?.awards.slice(0, 50) + '...'
                  : meta?.awards}
              </Text>
            </View>
          )}
          {castList && castList.length > 0 && (
            <View className="mb-2 w-full flex-row items-start gap-2">
              <Text className="text-white text-lg font-semibold pt-[0.9px]">
                Cast
              </Text>
              <View className="flex-row gap-1 flex-wrap">
                {castList?.slice(0, 3).map((actor: string, index: number) => (
                  <Text
                    key={actor}
                    className={`text-xs bg-tertiary p-1 px-2 rounded-md ${
                      index % 3 === 0
                        ? 'text-red-500'
                        : index % 3 === 1
                        ? 'text-blue-500'
                        : 'text-green-500'
                    }`}>
                    {actor}
                  </Text>
                ))}
              </View>
            </View>
          )}
          <View className="mb-2 w-full flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-white text-lg font-semibold">Synopsis</Text>
              <Text className="text-white text-xs bg-tertiary p-1 px-2 rounded-md">
                {route.params.provider || provider.value}
              </Text>
            </View>
            <View className="flex-row items-center gap-4 mb-1">
              {/* Conditional rendering for the trailer button */}
              {isFetchingTrailer ? (
                <View className="p-2 rounded-full bg-slate-800">
                  <MaterialCommunityIcons
                    name="loading"
                    size={25}
                    color="rgb(156 163 175)"
                  />
                </View>
              ) : ytVideoId ? (
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('WatchTrailer', {
                      videoId: ytVideoId,
                    });
                  }}
                  className="p-2 rounded-full bg-slate-800">
                  <MaterialCommunityIcons
                    name="movie-open"
                    size={25}
                    color="rgb(156 163 175)"
                  />
                </TouchableOpacity>
              ) : null}
              {inLibrary ? (
                <Ionicons
                  name="bookmark"
                  size={30}
                  color={primary}
                  onPress={() => removeLibrary()}
                />
              ) : (
                <Ionicons
                  name="bookmark-outline"
                  size={30}
                  color={primary}
                  onPress={() => addLibrary()}
                />
              )}
              <TouchableOpacity
                onPress={() => openThreeDotsMenu()}
                ref={threeDotsRef}>
                <MaterialCommunityIcons
                  name="dots-vertical"
                  size={25}
                  color="rgb(156 163 175)"
                />
              </TouchableOpacity>
              {
                <Modal
                  animationType="none"
                  transparent={true}
                  visible={threeDotsMenuOpen}
                  onRequestClose={() => {
                    setThreeDotsMenuOpen(false);
                  }}>
                  <Pressable
                    onPress={() => setThreeDotsMenuOpen(false)}
                    className="flex-1 bg-opacity-50">
                    <View
                      className="rounded-md p-2 w-48 bg-quaternary absolute right-10 top-[330px]"
                      style={{
                        top: menuPosition.top,
                        right: menuPosition.right,
                      }}>
                      <TouchableOpacity
                        className="flex-row items-center gap-2"
                        onPress={async () => {
                          setThreeDotsMenuOpen(false);
                          navigation.navigate('Webview', {
                            link: route.params.link,
                          });
                        }}>
                        <MaterialCommunityIcons
                          name="web"
                          size={21}
                          color="rgb(156 163 175)"
                        />
                        <Text className="text-white text-base">
                          Open in Web
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-row items-center gap-2 mt-1"
                        onPress={async () => {
                          setThreeDotsMenuOpen(false);
                          //@ts-ignore
                          searchNavigation.navigate('SearchStack', {
                            screen: 'SearchResults',
                            params: {
                              filter: displayTitle,
                            },
                          });
                        }}>
                        <Ionicons
                          name="search"
                          size={21}
                          color="rgb(156 163 175)"
                        />
                        <Text className="text-white text-base">
                          Search Title
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                </Modal>
              }
            </View>
          </View>
          <Text className="text-gray-200 text-sm px-2 py-1 bg-tertiary rounded-md">
            {synopsis.length > 180 && !readMore
              ? synopsis.slice(0, 180) + '... '
              : synopsis}
            {synopsis.length > 180 && !readMore && (
              <Text
                onPress={() => setReadMore(!readMore)}
                className="text-white font-extrabold text-xs px-2 bg-tertiary rounded-md">
                read more
              </Text>
            )}
          </Text>
        </View>

        <View className="px-4 py-4 bg-black">
          <Text className="text-white text-lg font-semibold mb-2"></Text>
          <View className="flex-row justify-between items-center w-full gap-2">
            <CustomSwitch
              label="External Play"
              icon="play-circle-outline"
              active={useExternalPlayer}
              onToggle={handleToggleExternalPlayer}
              primaryColor={primary}
            />

            <CustomSwitch
              label="External Down"
              icon="download-circle-outline"
              active={useExternalDownloader}
              onToggle={handleToggleExternalDownloader}
              primaryColor={primary}
            />
          </View>
        </View>

        <View className="p-4 bg-black">{seasonList}</View>
      </>
    );
  };

  return (
    <QueryErrorBoundary>
      <View className="h-full w-full">
        <StatusBar
          showHideTransition={'slide'}
          animated={true}
          translucent={true}
          backgroundColor={backgroundColor}
        />
        <View>
          <View className="absolute w-full h-[256px]">
            <Skeleton
              show={infoLoading}
              colorMode="dark"
              height={'100%'}
              width={'100%'}>
              <Image
                source={{uri: backgroundImage}}
                className=" h-[256] w-full"
                onError={e => {
                  console.warn('Background image failed to load:', e);
                }}
              />
            </Skeleton>
          </View>
          <FlatList
            data={[]}
            keyExtractor={(_, i) => i.toString()}
            renderItem={() => <View />}
            ListHeaderComponent={
              <>
                <View className="relative w-full h-[256px]">
                  <LinearGradient
                    colors={['transparent', 'black']}
                    className="absolute h-full w-full"
                  />
                  <View className="absolute bottom-0 right-0 w-screen flex-row justify-between items-baseline px-2">
                    {(meta?.logo && !logoError) || infoLoading ? (
                      <Image
                        onError={() => setLogoError(true)}
                        source={{uri: meta?.logo}}
                        style={{width: 200, height: 100, resizeMode: 'contain'}}
                      />
                    ) : (
                      <Text className="text-white text-2xl mt-3 capitalize font-semibold w-3/4 truncate">
                        {displayTitle}
                      </Text>
                    )}
                    {/* rating */}
                    {(meta?.imdbRating || info?.rating) && (
                      <Text className="text-white text-2xl font-semibold">
                        {meta?.imdbRating || info?.rating}
                        <Text className="text-white text-lg">/10</Text>
                      </Text>
                    )}
                  </View>
                </View>
                {renderContent()}
              </>
            }
            ListFooterComponent={<View className="h-16" />}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                colors={[primary]}
                tintColor={primary}
                progressBackgroundColor={'black'}
                refreshing={false}
                onRefresh={handleRefresh}
              />
            }
          />
        </View>
      </View>
    </QueryErrorBoundary>
  );
}
