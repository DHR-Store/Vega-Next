import {
  Image,
  Text,
  View,
  StatusBar,
  RefreshControl,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  PanResponder,
  Animated,
  Easing,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import React, {useCallback, useMemo, useRef, useState, useEffect} from 'react';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {HomeStackParamList, TabStackParamList} from '../../App';
import LinearGradient from 'react-native-linear-gradient';
import SeasonList from '../../components/SeasonList';
import CastInfo from '../../components/CastInfo'; // ADDED NEW IMPORT
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
import YoutubePlayer from 'react-native-youtube-iframe';

// --- CONFIGURATION ---
const TMDB_API_KEY = '9d2bff12ed955c7f1f74b83187f188ae';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// --- UTILITIES ---

const getTmdbTrailer = async (
  title: string,
  type: string = 'movie',
  year?: string,
  imdbId?: string, // Added IMDB ID support
): Promise<string | null> => {
  if (!TMDB_API_KEY) {
    console.warn('TMDB API Key missing. Trailer fallback disabled.');
    return null;
  }

  try {
    const searchType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
    let tmdbId: number | null = null;

    // --- STRATEGY 1: FIND BY IMDB ID (Most Accurate) ---
    if (imdbId) {
      try {
        const findUrl = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const findRes = await fetch(findUrl);
        const findData = await findRes.json();

        const results =
          searchType === 'movie' ? findData.movie_results : findData.tv_results;
        if (results && results.length > 0) {
          tmdbId = results[0].id;
        }
      } catch (e) {
        console.warn('IMDB lookup failed, falling back to search');
      }
    }

    // --- STRATEGY 2: SEARCH BY TITLE + YEAR (Strict) ---
    if (!tmdbId) {
      const query = encodeURIComponent(title);
      let yearParam = '';
      if (year) {
        // Use correct parameter for TV shows vs Movies
        yearParam =
          searchType === 'movie'
            ? `&year=${year}`
            : `&first_air_date_year=${year}`;
      }

      const searchUrl = `${TMDB_BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${query}${yearParam}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (searchData.results && searchData.results.length > 0) {
        tmdbId = searchData.results[0].id;
      }
    }

    // --- STRATEGY 3: SEARCH BY TITLE ONLY (Fallback) ---
    // If strict search failed (e.g. wrong year), try loose search
    if (!tmdbId && year) {
      const query = encodeURIComponent(title);
      // Omit the year parameter for a broader search
      const looseUrl = `${TMDB_BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${query}`;
      const looseRes = await fetch(looseUrl);
      const looseData = await looseRes.json();

      if (looseData.results && looseData.results.length > 0) {
        tmdbId = looseData.results[0].id;
      }
    }

    // If still no ID found, return null
    if (!tmdbId) return null;

    // --- FETCH VIDEOS ---
    const videoUrl = `${TMDB_BASE_URL}/${searchType}/${tmdbId}/videos?api_key=${TMDB_API_KEY}`;
    const videoRes = await fetch(videoUrl);
    const videoData = await videoRes.json();

    if (videoData.results && videoData.results.length > 0) {
      // Prioritize official Trailers from YouTube
      const trailer = videoData.results.find(
        (v: any) =>
          v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
      );
      // Fallback to the first available video if no specific trailer found
      return trailer ? trailer.key : videoData.results[0].key;
    }
    return null;
  } catch (error) {
    console.error('Error fetching TMDB trailer:', error);
    return null;
  }
};

// --- COMPONENTS ---

// 3D Flip Header Component
const FlipHeader = ({
  posterImage,
  trailerId,
  meta,
  infoLoading,
  setLogoError,
  displayTitle,
  logoError,
  onInteract,
  isFetchingTrailer,
}: any) => {
  const [showVideo, setShowVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const animatedValue = useRef(new Animated.Value(0)).current;
  const {width} = useWindowDimensions();
  const hasAutoFlipped = useRef(false);

  // Calculate correct 16:9 height based on screen width
  const videoHeight = width * (9 / 16);
  const headerHeight = 256;

  // Animation to show Video (Back Side)
  const flipToVideo = useCallback(() => {
    setShowVideo(true);
    Animated.timing(animatedValue, {
      toValue: 180,
      duration: 600,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        setIsPlaying(true);
      }
    });
  }, [animatedValue]);

  // Animation to show Poster (Front Side)
  const flipToPoster = useCallback(() => {
    setIsPlaying(false);
    setShowVideo(false);
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 600,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [animatedValue]);

  // Auto-flip logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (trailerId && !hasAutoFlipped.current && !showVideo) {
      timer = setTimeout(() => {
        flipToVideo();
        hasAutoFlipped.current = true;
      }, 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [trailerId, showVideo, flipToVideo]);

  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') {
      setIsPlaying(false);
      // Optional: Auto-flip back to poster when ended
      // flipToPoster();
    }
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 50;
        if (gestureState.dx > threshold) {
          if (showVideo) flipToPoster();
        } else if (gestureState.dx < -threshold) {
          if (!showVideo) flipToVideo();
        }
        if (onInteract) onInteract();
      },
    }),
  ).current;

  // Interpolations
  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = animatedValue.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });

  const backOpacity = animatedValue.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
  });

  return (
    <View
      style={{height: headerHeight, width: '100%', position: 'relative'}}
      {...panResponder.panHandlers}>
      {/* --- FRONT SIDE (Poster) --- */}
      <Animated.View
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          backfaceVisibility: 'hidden',
          transform: [{rotateY: frontInterpolate}, {perspective: 1000}],
          opacity: frontOpacity,
          zIndex: showVideo ? 0 : 1,
        }}>
        <Skeleton
          show={infoLoading}
          colorMode="dark"
          height={'100%'}
          width={'100%'}>
          <Image
            source={{uri: posterImage}}
            className="h-[256] w-full"
            resizeMode="cover"
            onError={e => console.warn('Background image failed:', e)}
          />
        </Skeleton>
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
          {(meta?.imdbRating || infoLoading) && (
            <Text className="text-white text-2xl font-semibold">
              {meta?.imdbRating}
              <Text className="text-white text-lg">/10</Text>
            </Text>
          )}
        </View>

        {/* --- DOTS FOR FRONT (Poster Active) --- */}
        <View className="absolute bottom-2 w-full flex-row justify-center items-center gap-2 z-50">
          {/* Active Dot (Poster) */}
          <View className="w-2 h-2 rounded-full bg-white scale-125" />

          {/* Inactive Dot (Go to Video) */}
          {trailerId ? (
            <TouchableOpacity
              onPress={flipToVideo}
              hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
              <View className="w-2 h-2 rounded-full bg-white/30" />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>

      {/* --- BACK SIDE (Trailer) --- */}
      <Animated.View
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          backfaceVisibility: 'hidden',
          backgroundColor: 'black',
          transform: [{rotateY: backInterpolate}, {perspective: 1000}],
          opacity: backOpacity,
          zIndex: showVideo ? 1 : 0,
        }}>
        {trailerId ? (
          <View
            style={{
              flex: 1,
              backgroundColor: 'black',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            {/* Video Player Container - Full Fixed Width/Height Centered */}
            <View
              style={{
                height: videoHeight,
                width: width,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <YoutubePlayer
                height={videoHeight}
                width={width}
                play={playerReady && isPlaying}
                videoId={trailerId}
                mute={true}
                onReady={() => setPlayerReady(true)}
                onChangeState={onStateChange}
                initialPlayerParams={{
                  controls: true, // ENABLED: Shows Progress Bar and Controls
                  modestbranding: true,
                  loop: false,
                  rel: false,
                  iv_load_policy: 3,
                  cc_load_policy: 0,
                  fs: false,
                  playsinline: true,
                }}
              />
            </View>

            {/* --- SMALL BELOW OVERLAY (Dots) --- */}
            {/* Click the first dot to return to poster */}
            <View className="absolute bottom-2 w-full flex-row justify-center items-center gap-2 z-50">
              <TouchableOpacity
                onPress={flipToPoster}
                hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                <View className="w-2 h-2 rounded-full bg-white/30" />
              </TouchableOpacity>
              <View className="w-2 h-2 rounded-full bg-white scale-125" />
            </View>
          </View>
        ) : (
          <View className="flex-1 justify-center items-center bg-zinc-900">
            {isFetchingTrailer ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View className="items-center gap-2">
                <Text className="text-white/50 text-xs">No Trailer</Text>
                {/* Return Dot */}
                <TouchableOpacity onPress={flipToPoster} className="p-2">
                  <View className="w-2 h-2 rounded-full bg-white/30" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
};

function WatchTrailer({
  route,
  navigation,
}: NativeStackScreenProps<
  HomeStackParamList,
  'WatchTrailer'
>): React.JSX.Element {
  const {videoId} = route.params;
  const {width} = useWindowDimensions();
  const [playing, setPlaying] = useState(true);

  return (
    <View style={{flex: 1, backgroundColor: 'black', justifyContent: 'center'}}>
      <StatusBar hidden />
      <View style={{width: '100%', aspectRatio: 16 / 9}}>
        <YoutubePlayer
          height={width * (9 / 16)}
          width={width}
          mute={false}
          play={playing}
          videoId={videoId}
          initialPlayerParams={{
            controls: true,
            modestbranding: true,
          }}
        />
      </View>

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{
          position: 'absolute',
          top: 40,
          left: 20,
          padding: 10,
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: 20,
        }}>
        <Ionicons name="close" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

// --- MAIN INFO COMPONENT ---

type Props = NativeStackScreenProps<HomeStackParamList, 'Info'>;

const CustomSwitch = ({label, icon, active, onToggle, primaryColor}: any) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onToggle}
      className={`flex-1 flex-row items-center p-3 rounded-xl transition-colors duration-300 ${
        active ? 'bg-[#1A1A1A]' : `bg-[${primaryColor}]`
      }`}>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={active ? primaryColor : '#FFFFFF'}
      />
      <Text
        className={`text-sm font-semibold ml-2 transition-colors duration-300 ${
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

  const [ytVideoId, setYtVideoId] = useState<string | null>(null);
  const [isFetchingTrailer, setIsFetchingTrailer] = useState(false);

  const threeDotsRef = useRef<any>();
  const isMounted = useRef(true);

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

  const filteredLinkList = useMemo(() => {
    if (!info?.linkList) {
      return [];
    }
    const excludedQualities = settingsStorage.getExcludedQualities();
    const filtered = info.linkList.filter(
      (item: any) =>
        !item.quality || !excludedQualities.includes(item.quality as string),
    );

    const uniqueLinksMap = new Map();
    filtered.forEach(item => {
      if (item.link && !uniqueLinksMap.has(item.link)) {
        uniqueLinksMap.set(item.link, item);
      }
    });

    const filteredAndUnique = Array.from(uniqueLinksMap.values());
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

  // --- TRAILER FETCHING LOGIC ---
  useEffect(() => {
    const fetchTrailer = async () => {
      // 1. Try to get trailer from Content Provider
      const providerTrailer = meta?.trailers?.[0]?.source;

      if (providerTrailer) {
        if (isMounted.current) {
          setYtVideoId(providerTrailer);
        }
        return;
      }

      // 2. If no provider trailer, try TMDB Search (With the new fallback logic)
      if (displayTitle && !infoLoading) {
        if (isMounted.current) {
          setIsFetchingTrailer(true);
        }

        const videoId = await getTmdbTrailer(
          displayTitle,
          info?.type, // 'movie' or 'series'
          meta?.year,
          meta?.imdbId || meta?.imdb_id, // Pass IMDB ID if available
        );

        if (isMounted.current) {
          setYtVideoId(videoId);
          setIsFetchingTrailer(false);
        }
      }
    };

    fetchTrailer();
  }, [
    displayTitle,
    meta?.year,
    meta?.trailers,
    meta?.imdbId,
    meta?.imdb_id,
    infoLoading,
    info?.type,
  ]);

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

  const renderContent = () => {
    // Fallback loading state for skeleton
    if (infoLoading || !info) {
      return (
        <View>
          <FlipHeader
            posterImage={backgroundImage}
            trailerId={null}
            title={displayTitle}
            meta={meta}
            infoLoading={true}
            setLogoError={setLogoError}
            displayTitle={displayTitle}
            logoError={logoError}
            navigation={navigation}
            isFetchingTrailer={false}
          />
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
      <View>
        <FlipHeader
          posterImage={backgroundImage}
          trailerId={ytVideoId}
          title={displayTitle}
          meta={meta}
          infoLoading={infoLoading}
          setLogoError={setLogoError}
          displayTitle={displayTitle}
          logoError={logoError}
          navigation={navigation}
          isFetchingTrailer={isFetchingTrailer}
        />

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

          {/* --- ADDED CAST INFO COMPONENT --- */}
          {displayTitle && (
            <CastInfo
              title={displayTitle}
              type={info?.type}
              year={meta?.year}
              imdbId={meta?.imdbId || meta?.imdb_id}
              fallbackCast={castList}
            />
          )}

          <View className="mb-2 w-full flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-white text-lg font-semibold">Synopsis</Text>
              <Text className="text-white text-xs bg-tertiary p-1 px-2 rounded-md">
                {route.params.provider || provider.value}
              </Text>
            </View>
            <View className="flex-row items-center gap-4 mb-1">
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
      </View>
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
          <FlatList
            data={[]}
            keyExtractor={(_, i) => i.toString()}
            renderItem={() => <View />}
            ListHeaderComponent={renderContent()}
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
