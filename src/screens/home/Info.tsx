import {
  Image,
  Text,
  View,
  StatusBar,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  useWindowDimensions,
  StyleSheet,
  InteractionManager,
} from 'react-native';
import React, {useCallback, useMemo, useRef, useState, useEffect} from 'react';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {HomeStackParamList, TabStackParamList} from '../../App';
import LinearGradient from 'react-native-linear-gradient';
import SeasonList from '../../components/SeasonList';
import CastInfo from '../../components/CastInfo';
import {Skeleton} from 'moti/skeleton';
import Ionicons from '@expo/vector-icons/Ionicons';
import {settingsStorage, watchListStorage} from '../../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../../lib/zustand/contentStore';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import {useNavigation, useIsFocused} from '@react-navigation/native';
import useWatchListStore from '../../lib/zustand/watchListStore';
import {useContentDetails} from '../../lib/hooks/useContentInfo';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import YoutubePlayer from 'react-native-youtube-iframe';

// --- CONFIGURATION ---
const TMDB_API_KEY = 'YOUR TMDB API KEY';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// --- UTILITIES ---
const extractYouTubeId = (input: string): string | null => {
  if (!input) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    if (url.hostname.includes('youtu')) {
      const params = new URLSearchParams(url.search);
      if (params.get('v')) return params.get('v');
      const path = url.pathname.split('/');
      if (path.length > 1) return path[path.length - 1];
    }
  } catch {}
  return null;
};

const getTmdbTrailer = async (
  title: string,
  type: string = 'movie',
  year?: string,
  imdbId?: string,
): Promise<string | null> => {
  if (!TMDB_API_KEY) return null;
  try {
    const searchType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
    let tmdbId: number | null = null;

    if (imdbId) {
      try {
        const findUrl = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const findRes = await fetch(findUrl);
        const findData = await findRes.json();
        const results =
          searchType === 'movie' ? findData.movie_results : findData.tv_results;
        if (results?.length > 0) tmdbId = results[0].id;
      } catch (e) {
        console.warn('IMDB lookup failed');
      }
    }

    if (!tmdbId) {
      const query = encodeURIComponent(title);
      let yearParam = year
        ? searchType === 'movie'
          ? `&year=${year}`
          : `&first_air_date_year=${year}`
        : '';
      const searchUrl = `${TMDB_BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${query}${yearParam}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      if (searchData.results?.length > 0) tmdbId = searchData.results[0].id;
    }

    if (!tmdbId && year) {
      const query = encodeURIComponent(title);
      const looseUrl = `${TMDB_BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${query}`;
      const looseRes = await fetch(looseUrl);
      const looseData = await looseRes.json();
      if (looseData.results?.length > 0) tmdbId = looseData.results[0].id;
    }

    if (!tmdbId) return null;

    const videoUrl = `${TMDB_BASE_URL}/${searchType}/${tmdbId}/videos?api_key=${TMDB_API_KEY}`;
    const videoRes = await fetch(videoUrl);
    const videoData = await videoRes.json();
    if (videoData.results?.length > 0) {
      const trailer = videoData.results.find(
        (v: any) =>
          v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
      );
      return trailer ? trailer.key : videoData.results[0].key;
    }
    return null;
  } catch (error) {
    console.error('Error fetching TMDB trailer:', error);
    return null;
  }
};

// --- ISOLATED MEMOIZED SUB-COMPONENTS ---

const HeroHeader = React.memo(
  ({
    posterImage,
    trailerId,
    meta,
    infoLoading,
    setLogoError,
    displayTitle,
    logoError,
    showTrailer,
    onCloseTrailer,
  }: any) => {
    const isFocused = useIsFocused();
    const [playerReady, setPlayerReady] = useState(false);
    const {width} = useWindowDimensions();
    const videoHeight = width * (9 / 16);
    const headerHeight = 256;

    const onStateChange = useCallback(
      (state: string) => {
        if (state === 'ended') onCloseTrailer?.();
      },
      [onCloseTrailer],
    );

    return (
      <View style={{height: headerHeight, width: '100%', position: 'relative'}}>
        <View style={StyleSheet.absoluteFillObject}>
          <Skeleton
            show={infoLoading}
            colorMode="dark"
            height="100%"
            width="100%">
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
        </View>

        {showTrailer && trailerId ? (
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'black',
              zIndex: 20,
            }}>
            <View
              style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
              <YoutubePlayer
                height={videoHeight}
                width={width}
                play={playerReady && isFocused}
                videoId={trailerId}
                mute={true}
                onReady={() => setPlayerReady(true)}
                onChangeState={onStateChange}
                initialPlayerParams={{
                  controls: true,
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
            <TouchableOpacity
              onPress={() => onCloseTrailer?.()}
              style={{
                position: 'absolute',
                top: 20,
                right: 10,
                zIndex: 30,
                padding: 8,
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20,
              }}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  },
);

const CustomSwitch = React.memo(
  ({label, icon, active, onToggle, primaryColor}: any) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onToggle}
      style={{
        backgroundColor: active ? primaryColor : '#1A1A1A',
        shadowColor: active ? primaryColor : 'transparent',
        shadowOffset: {width: 0, height: 0},
        shadowOpacity: active ? 0.6 : 0,
        shadowRadius: active ? 10 : 0,
        elevation: active ? 8 : 0,
      }}
      className="flex-1 flex-row items-center p-3 rounded-xl transition-colors duration-300">
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={active ? '#FFFFFF' : primaryColor}
      />
      <Text
        className={`text-sm font-semibold ml-2 transition-colors duration-300 ${active ? 'text-white' : 'text-gray-400'}`}>
        {label}
      </Text>
      <View
        className="ml-auto w-10 h-5 rounded-full transition-colors duration-300"
        style={{
          backgroundColor: active ? 'rgba(255, 255, 255, 0.4)' : '#4B5563',
          justifyContent: 'center',
          alignItems: active ? 'flex-end' : 'flex-start',
          paddingHorizontal: 2,
        }}>
        <View className="w-4 h-4 rounded-full bg-white shadow-md" />
      </View>
    </TouchableOpacity>
  ),
);

const SynopsisBlock = React.memo(({synopsis}: {synopsis: string}) => {
  const [readMore, setReadMore] = useState(false);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setReadMore(prev => !prev)}
      className="bg-tertiary rounded-md p-2 mt-1">
      <Text className="text-gray-200 text-sm">
        {synopsis.length > 180 && !readMore
          ? synopsis.slice(0, 180) + '... '
          : synopsis}
        {synopsis.length > 180 && !readMore && (
          <Text className="text-white font-extrabold text-xs ml-1">
            read more
          </Text>
        )}
      </Text>
    </TouchableOpacity>
  );
});

const InfoTags = React.memo(({meta, info}: {meta: any; info: any}) => (
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
));

const ExternalSettings = React.memo(({primary}: {primary: string}) => {
  const [useExternalPlayer, setUseExternalPlayer] = useState(
    settingsStorage.getBool('useExternalPlayer', false),
  );
  const [useExternalDownloader, setUseExternalDownloader] = useState(
    settingsStorage.getBool('alwaysExternalDownloader', false),
  );

  const togglePlayer = useCallback(
    () =>
      setUseExternalPlayer(p => {
        const n = !p;
        settingsStorage.setBool('useExternalPlayer', n);
        return n;
      }),
    [],
  );
  const toggleDownloader = useCallback(
    () =>
      setUseExternalDownloader(p => {
        const n = !p;
        settingsStorage.setBool('alwaysExternalDownloader', n);
        return n;
      }),
    [],
  );

  return (
    <View className="flex-row justify-between items-center w-full gap-2">
      <CustomSwitch
        label="External Play"
        icon="play-circle-outline"
        active={useExternalPlayer}
        onToggle={togglePlayer}
        primaryColor={primary}
      />
      <CustomSwitch
        label="External Down"
        icon="download-circle-outline"
        active={useExternalDownloader}
        onToggle={toggleDownloader}
        primaryColor={primary}
      />
    </View>
  );
});

const ActionButtons = React.memo(
  ({
    ytVideoId,
    isFetchingTrailer,
    onPlayTrailer,
    inLibrary,
    onToggleLibrary,
    displayTitle,
    link,
    providerValue,
  }: any) => {
    const navigation =
      useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
    const searchNavigation =
      useNavigation<NativeStackNavigationProp<TabStackParamList>>();
    const {primary} = useThemeStore(state => state);

    const [threeDotsMenuOpen, setThreeDotsMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({top: -1000, right: 0});
    const threeDotsRef = useRef<any>();

    const openThreeDotsMenu = useCallback(() => {
      if (threeDotsRef.current) {
        threeDotsRef.current.measure(
          (
            _x: number,
            _y: number,
            _w: number,
            _h: number,
            _pageX: number,
            pageY: number,
          ) => {
            setMenuPosition({top: pageY - 35, right: 35});
            setThreeDotsMenuOpen(true);
          },
        );
      }
    }, []);

    return (
      <View className="mb-2 w-full flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="text-white text-lg font-semibold">Synopsis</Text>
          <Text className="text-white text-xs bg-tertiary p-1 px-2 rounded-md">
            {providerValue}
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
              activeOpacity={0.7}
              onPress={onPlayTrailer}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              className="p-2 rounded-full bg-slate-800">
              <MaterialCommunityIcons
                name="movie-open"
                size={25}
                color="rgb(156 163 175)"
              />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onToggleLibrary}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons
              name={inLibrary ? 'bookmark' : 'bookmark-outline'}
              size={30}
              color={primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={openThreeDotsMenu}
            ref={threeDotsRef}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <MaterialCommunityIcons
              name="dots-vertical"
              size={25}
              color="rgb(156 163 175)"
            />
          </TouchableOpacity>

          <Modal
            animationType="none"
            transparent={true}
            visible={threeDotsMenuOpen}
            onRequestClose={() => setThreeDotsMenuOpen(false)}>
            <Pressable
              onPress={() => setThreeDotsMenuOpen(false)}
              className="flex-1 bg-opacity-50">
              <View
                className="rounded-md p-2 w-48 bg-quaternary absolute"
                style={{top: menuPosition.top, right: menuPosition.right}}>
                <TouchableOpacity
                  className="flex-row items-center gap-2"
                  onPress={() => {
                    setThreeDotsMenuOpen(false);
                    navigation.navigate('Webview', {link});
                  }}>
                  <MaterialCommunityIcons
                    name="web"
                    size={21}
                    color="rgb(156 163 175)"
                  />
                  <Text className="text-white text-base">Open in Web</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center gap-2 mt-1"
                  onPress={() => {
                    setThreeDotsMenuOpen(false);
                    //@ts-ignore
                    searchNavigation.navigate('SearchStack', {
                      screen: 'SearchResults',
                      params: {filter: displayTitle},
                    });
                  }}>
                  <Ionicons name="search" size={21} color="rgb(156 163 175)" />
                  <Text className="text-white text-base">Search Title</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        </View>
      </View>
    );
  },
);

type Props = NativeStackScreenProps<HomeStackParamList, 'Info'>;

export default function Info({route, navigation}: Props): React.JSX.Element {
  const {primary} = useThemeStore(state => state);
  const {addItem, removeItem} = useWatchListStore(state => state);
  const {provider} = useContentStore(state => state);
  const providerValue = route.params.provider || provider.value;

  const {
    info,
    meta,
    isLoading: infoLoading,
    error,
    refetch,
  } = useContentDetails(route.params.link, providerValue);

  const cachedInfo = useRef<any>(null);
  const cachedMeta = useRef<any>(null);

  useEffect(() => {
    if (info) cachedInfo.current = info;
  }, [info]);
  useEffect(() => {
    if (meta) cachedMeta.current = meta;
  }, [meta]);

  const stableInfo = info ?? cachedInfo.current;
  const stableMeta = meta ?? cachedMeta.current;
  const isFirstLoad = infoLoading && !cachedInfo.current;

  const [backgroundColor, setBackgroundColor] = useState('transparent');
  const [logoError, setLogoError] = useState(false);
  const [inLibrary, setInLibrary] = useState(
    watchListStorage.isInWatchList(route.params.link),
  );

  const [ytVideoId, setYtVideoId] = useState<string | null>(null);
  const [isFetchingTrailer, setIsFetchingTrailer] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const trailerFetchedRef = useRef(false);

  const displayTitle = useMemo(
    () => stableMeta?.name || stableInfo?.title,
    [stableMeta?.name, stableInfo?.title],
  );

  useEffect(() => {
    if (trailerFetchedRef.current || !displayTitle || isFirstLoad) return;
    let isMounted = true;

    InteractionManager.runAfterInteractions(async () => {
      if (!isMounted) return;

      const providerTrailerRaw = stableMeta?.trailers?.[0];
      const providerTrailerId =
        extractYouTubeId(providerTrailerRaw?.id) ||
        extractYouTubeId(providerTrailerRaw?.source);

      if (providerTrailerId) {
        setYtVideoId(providerTrailerId);
        trailerFetchedRef.current = true;
        return;
      }

      setIsFetchingTrailer(true);
      const videoId = await getTmdbTrailer(
        displayTitle,
        stableInfo?.type,
        stableMeta?.year,
        stableMeta?.imdbId || stableMeta?.imdb_id,
      );

      if (isMounted) {
        setYtVideoId(videoId);
        setIsFetchingTrailer(false);
        trailerFetchedRef.current = true;
      }
    });

    return () => {
      isMounted = false;
    };
  }, [stableMeta, stableInfo, displayTitle, isFirstLoad]);

  const handleScroll = useCallback((event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    setBackgroundColor(prev => {
      const newColor = currentY > 150 ? 'black' : 'transparent';
      return prev !== newColor ? newColor : prev;
    });
  }, []);

  const toggleLibrary = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled?.()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    if (inLibrary) {
      removeItem(route.params.link);
      setInLibrary(false);
    } else {
      addItem({
        title: displayTitle,
        poster: stableMeta?.poster || route.params.poster || stableInfo?.image,
        link: route.params.link,
        provider: providerValue,
      });
      setInLibrary(true);
    }
  }, [
    inLibrary,
    displayTitle,
    stableMeta,
    stableInfo,
    route.params,
    providerValue,
    addItem,
    removeItem,
  ]);

  const synopsis = useMemo(
    () =>
      stableMeta?.description ||
      stableInfo?.synopsis ||
      'No synopsis available',
    [stableMeta?.description, stableInfo?.synopsis],
  );
  const posterImage = useMemo(
    () =>
      stableMeta?.poster ||
      route.params.poster ||
      stableInfo?.image ||
      'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega',
    [stableMeta?.poster, route.params.poster, stableInfo?.image],
  );
  const backgroundImage = useMemo(
    () =>
      stableMeta?.background ||
      stableInfo?.image ||
      'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega',
    [stableMeta?.background, stableInfo?.image],
  );

  const filteredLinkList = useMemo(() => {
    if (!stableInfo?.linkList) return [];
    const excludedQualities = settingsStorage.getExcludedQualities();
    const filtered = stableInfo.linkList.filter(
      (item: any) =>
        !item.quality || !excludedQualities.includes(item.quality as string),
    );
    const uniqueLinksMap = new Map();
    filtered.forEach((item: any) => {
      if (item.link && !uniqueLinksMap.has(item.link))
        uniqueLinksMap.set(item.link, item);
    });
    const result = Array.from(uniqueLinksMap.values());
    return result.length > 0 ? result : stableInfo.linkList;
  }, [stableInfo?.linkList]);

  const castList = useMemo(
    () => (stableMeta?.cast?.length ? stableMeta?.cast : stableInfo?.cast),
    [stableMeta?.cast, stableInfo?.cast],
  );

  const handleRefresh = useCallback(async () => {
    try {
      await refetch();
      setInLibrary(watchListStorage.isInWatchList(route.params.link));
    } catch (refreshError) {
      console.error('Error refreshing content:', refreshError);
    }
  }, [refetch, route.params.link]);

  // SAFE TOP LEVEL HOOK DECLARATION (Executed deterministically on every render)
  const memoizedSeasonListContent = useMemo(() => {
    if (isFirstLoad || !stableInfo) return null;
    return (
      <SeasonList
        refreshing={false}
        providerValue={providerValue}
        LinkList={filteredLinkList}
        poster={{
          logo: stableMeta?.logo,
          poster: posterImage,
          background: backgroundImage,
        }}
        type={stableInfo?.type || 'series'}
        metaTitle={displayTitle}
        routeParams={route.params}
      />
    );
  }, [
    isFirstLoad,
    stableInfo,
    providerValue,
    filteredLinkList,
    stableMeta?.logo,
    posterImage,
    backgroundImage,
    stableInfo?.type,
    displayTitle,
    route.params,
  ]);

  if (error && !cachedInfo.current) {
    return (
      <View className="flex-1 bg-black justify-center items-center p-4">
        <StatusBar
          hidden={false}
          showHideTransition="slide"
          animated
          translucent
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

  return (
    <QueryErrorBoundary>
      <View className="flex-1 bg-black">
        <StatusBar
          hidden={false}
          showHideTransition="slide"
          animated
          translucent
          backgroundColor={backgroundColor}
        />
        <ScrollView
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              colors={[primary]}
              tintColor={primary}
              progressBackgroundColor="black"
              refreshing={false}
              onRefresh={handleRefresh}
            />
          }>
          <HeroHeader
            posterImage={backgroundImage}
            trailerId={ytVideoId}
            meta={stableMeta}
            infoLoading={isFirstLoad}
            setLogoError={setLogoError}
            displayTitle={displayTitle}
            logoError={logoError}
            showTrailer={showTrailer}
            onCloseTrailer={() => setShowTrailer(false)}
          />

          {isFirstLoad || !stableInfo ? (
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
                    width="100%"
                  />
                </View>
              ))}
            </View>
          ) : (
            <>
              <View className="p-4 bg-black">
                <InfoTags meta={stableMeta} info={stableInfo} />
                {stableMeta?.awards && (
                  <View className="mb-2 w-full flex-row items-baseline gap-2">
                    <Text className="text-white text-sm font-semibold">
                      Awards:
                    </Text>
                    <Text className="text-white text-xs px-1 bg-tertiary rounded-sm">
                      {stableMeta?.awards?.length > 50
                        ? stableMeta?.awards.slice(0, 50) + '...'
                        : stableMeta?.awards}
                    </Text>
                  </View>
                )}
                {displayTitle && (
                  <CastInfo
                    title={displayTitle}
                    type={stableInfo?.type}
                    year={stableMeta?.year}
                    imdbId={stableMeta?.imdbId || stableMeta?.imdb_id}
                    fallbackCast={castList}
                  />
                )}

                <ActionButtons
                  ytVideoId={ytVideoId}
                  isFetchingTrailer={isFetchingTrailer}
                  onPlayTrailer={() => setShowTrailer(true)}
                  inLibrary={inLibrary}
                  onToggleLibrary={toggleLibrary}
                  displayTitle={displayTitle}
                  link={route.params.link}
                  providerValue={providerValue}
                />

                <SynopsisBlock synopsis={synopsis} />
              </View>

              <View className="px-4 py-4 bg-black">
                <ExternalSettings primary={primary} />
              </View>

              <View className="p-4 bg-black">{memoizedSeasonListContent}</View>
            </>
          )}
          <View className="h-16 bg-black" />
        </ScrollView>
      </View>
    </QueryErrorBoundary>
  );
}
