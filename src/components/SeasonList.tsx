import React, {useState, useMemo, useCallback, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ToastAndroid,
  Modal,
  FlatList,
  ActivityIndicator,
  Pressable,
  TextInput,
  Animated,
  Easing,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import {Dropdown} from 'react-native-element-dropdown';
import {MotiView} from 'moti';
import {Skeleton} from 'moti/skeleton';
import * as IntentLauncher from 'expo-intent-launcher';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {LinearGradient} from 'expo-linear-gradient';

import {EpisodeLink, Link} from '../lib/providers/types';
import {RootStackParamList} from '../App';
import Downloader from './Downloader';
import {cacheStorage, mainStorage, settingsStorage} from '../lib/storage';
import {ifExists} from '../lib/file/ifExists';
import {useEpisodes, useStreamData} from '../lib/hooks/useEpisodes';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import useThemeStore from '../lib/zustand/themeStore';

interface SeasonListProps {
  LinkList: Link[];
  poster: {
    logo?: string;
    poster?: string;
    background?: string;
  };
  type: string;
  metaTitle: string;
  providerValue: string;
  refreshing?: boolean;
  routeParams: Readonly<{
    link: string;
    provider?: string;
    poster?: string;
  }>;
}

interface PlayHandlerProps {
  linkIndex: number;
  type: string;
  primaryTitle: string;
  secondaryTitle?: string;
  seasonTitle: string;
  episodeData: EpisodeLink[] | Link['directLinks'];
}

interface StickyMenuState {
  active: boolean;
  link?: string;
  type?: string;
}

// ============================================================================
// --- CUSTOM EPISODE ROW COMPONENT (OPTIMIZED) ---
// ============================================================================
const EpisodeRow = React.memo(
  ({
    item,
    index,
    activeSeason,
    metaTitle,
    type,
    providerValue,
    playHandler,
    getWatchProgressData,
    stickyMenu,
    titleAlignment,
    onLongPressHandler,
    primary,
    episodesData,
  }: any) => {
    const watchData = getWatchProgressData(item.link);

    // --- No more download progress polling – faster touch response ---

    return (
      <View
        className={`w-full justify-center items-center gap-2 flex-row my-1 ${
          watchData.isCompleted || stickyMenu.link === item.link
            ? 'opacity-60'
            : watchData.inProgress
              ? 'opacity-80'
              : ''
        }`}>
        <View className="flex-row w-full justify-between gap-2 items-center">
          <TouchableOpacity
            delayPressIn={0}
            activeOpacity={0.65}
            delayLongPress={400}
            className={`rounded-md ${
              watchData.isCompleted || watchData.inProgress
                ? 'bg-white/15'
                : 'bg-white/30'
            } w-[80%] min-h-[48px] items-center p-2 flex-row gap-x-2 relative overflow-hidden ${titleAlignment}`}
            onPress={() =>
              playHandler({
                linkIndex: index,
                type: type,
                primaryTitle: metaTitle,
                secondaryTitle: item.title,
                seasonTitle: activeSeason?.title || '',
                episodeData: episodesData,
              })
            }
            onLongPress={() => onLongPressHandler(true, item.link, 'series')}>
            {/* WATCH PROGRESS GRADIENT (Primary to Green) */}
            {watchData.percentage > 0 && (
              <LinearGradient
                colors={[primary, '#00C853']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${watchData.percentage}%`,
                  opacity: 0.4,
                }}
              />
            )}

            {/* DOWNLOAD PROGRESS removed for performance */}

            <Ionicons
              name="play-circle"
              size={28}
              color={primary}
              style={{zIndex: 1}}
            />

            <View
              className="flex-1 flex-col justify-center"
              style={{zIndex: 1}}>
              <Text
                className="text-white bg-transparent font-medium"
                numberOfLines={1}>
                {item.title}
              </Text>
              {watchData.text ? (
                <Text
                  style={{
                    color: primary,
                    fontSize: 11,
                    fontWeight: 'bold',
                    marginTop: 2,
                  }}>
                  {watchData.text}
                </Text>
              ) : null}
            </View>

            {/* Download percentage text removed */}
          </TouchableOpacity>

          <Downloader
            providerValue={providerValue}
            link={item.link}
            type={type}
            title={
              metaTitle.length > 30
                ? metaTitle.slice(0, 30) + '... ' + item.title
                : metaTitle + ' ' + item.title
            }
            fileName={(
              metaTitle +
              (activeSeason?.title || '') +
              item.title
            ).replaceAll(/[^a-zA-Z0-9]/g, '_')}
          />
        </View>
      </View>
    );
  },
);

// ============================================================================
// --- CUSTOM DIRECT LINK ROW COMPONENT (OPTIMIZED) ---
// ============================================================================
const DirectLinkRow = React.memo(
  ({
    item,
    index,
    activeSeason,
    metaTitle,
    type,
    providerValue,
    playHandler,
    getWatchProgressData,
    stickyMenu,
    titleAlignment,
    onLongPressHandler,
    primary,
    directLinksData,
  }: any) => {
    const watchData = getWatchProgressData(item.link);

    // --- No more download progress polling – faster touch response ---

    return (
      <View
        className={`w-full justify-center items-center my-2 gap-2 flex-row ${
          watchData.isCompleted || stickyMenu.link === item.link
            ? 'opacity-60'
            : watchData.inProgress
              ? 'opacity-80'
              : ''
        }`}>
        <View className="flex-row w-full justify-between gap-2 items-center">
          <TouchableOpacity
            delayPressIn={0}
            activeOpacity={0.65}
            delayLongPress={400}
            className={`rounded-md ${
              watchData.isCompleted || watchData.inProgress
                ? 'bg-white/15'
                : 'bg-white/30'
            } w-[80%] min-h-[48px] items-center p-2 flex-row gap-x-2 relative overflow-hidden ${titleAlignment}`}
            onPress={() =>
              playHandler({
                linkIndex: index,
                type: type,
                primaryTitle: metaTitle,
                secondaryTitle: item.title,
                seasonTitle: activeSeason?.title || '',
                episodeData: directLinksData,
              })
            }
            onLongPress={() =>
              onLongPressHandler(true, item.link, item?.type || 'series')
            }>
            {/* WATCH PROGRESS GRADIENT (Primary to Green) */}
            {watchData.percentage > 0 && (
              <LinearGradient
                colors={[primary, '#00C853']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${watchData.percentage}%`,
                  opacity: 0.4,
                }}
              />
            )}

            {/* DOWNLOAD PROGRESS removed for performance */}

            <Ionicons
              name="play-circle"
              size={28}
              color={primary}
              style={{zIndex: 1}}
            />

            <View
              className="flex-1 flex-col justify-center"
              style={{zIndex: 1}}>
              <Text
                className="text-white bg-transparent font-medium"
                numberOfLines={1}>
                {activeSeason?.directLinks?.length &&
                activeSeason?.directLinks?.length > 1
                  ? item.title
                  : 'Play'}
              </Text>
              {watchData.text ? (
                <Text
                  style={{
                    color: primary,
                    fontSize: 11,
                    fontWeight: 'bold',
                    marginTop: 2,
                  }}>
                  {watchData.text}
                </Text>
              ) : null}
            </View>

            {/* Download percentage text removed */}
          </TouchableOpacity>

          <Downloader
            providerValue={providerValue}
            link={item.link}
            type={type}
            title={
              metaTitle.length > 30
                ? metaTitle.slice(0, 30) + '... ' + item.title
                : metaTitle + ' ' + item.title
            }
            fileName={(
              metaTitle +
              (activeSeason?.title || '') +
              item.title
            ).replaceAll(/[^a-zA-Z0-9]/g, '_')}
          />
        </View>
      </View>
    );
  },
);

// ============================================================================
// --- MAIN SEASON LIST COMPONENT ---
// ============================================================================
const SeasonList: React.FC<SeasonListProps> = ({
  LinkList,
  poster,
  type,
  metaTitle,
  providerValue,
  refreshing: _refreshing,
  routeParams,
}) => {
  const {primary} = useThemeStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {addItem} = useWatchHistoryStore(state => state);
  const {fetchStreams} = useStreamData();

  if (!LinkList || LinkList.length === 0) {
    return (
      <View className="p-4">
        <Text className="text-white text-center">No Streams Available</Text>
      </View>
    );
  }

  const [activeSeason, setActiveSeason] = useState<Link>(() => {
    if (!LinkList || LinkList.length === 0) return {} as Link;
    const cached = cacheStorage.getString(
      `ActiveSeason${metaTitle + providerValue}`,
    );
    if (cached) {
      try {
        const parsedSeason = JSON.parse(cached);
        const seasonExists = LinkList.find(
          link => link.title === parsedSeason.title,
        );
        if (seasonExists) return parsedSeason;
      } catch (error) {}
    }
    return LinkList[0];
  });

  const {
    data: episodeList = [],
    isLoading: episodeLoading,
    error: episodeError,
    refetch: refetchEpisodes,
  } = useEpisodes(
    activeSeason?.episodesLink,
    providerValue,
    activeSeason?.episodesLink ? true : false,
  );

  const [vlcLoading, setVlcLoading] = useState<boolean>(false);
  const [stickyMenu, setStickyMenu] = useState<StickyMenuState>({
    active: false,
  });
  const [searchText, setSearchText] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() =>
    mainStorage.getString('episodeSortOrder') === 'desc' ? 'desc' : 'asc',
  );

  const [showServerModal, setShowServerModal] = useState<boolean>(false);
  const [externalPlayerStreams, setExternalPlayerStreams] = useState<any[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState<boolean>(false);

  const vlcSpinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (vlcLoading) {
      vlcSpinValue.setValue(0);
      Animated.loop(
        Animated.timing(vlcSpinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      vlcSpinValue.stopAnimation();
    }
  }, [vlcLoading, vlcSpinValue]);

  const vlcSpin = vlcSpinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const filteredAndSortedEpisodes = useMemo(() => {
    if (!episodeList || !Array.isArray(episodeList)) return [];
    let episodes = episodeList.filter(
      episode => episode && episode.title && episode.link,
    );
    if (searchText.trim()) {
      episodes = episodes.filter(episode =>
        episode?.title?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }
    if (sortOrder === 'desc') episodes = [...episodes].reverse();
    return episodes;
  }, [episodeList, searchText, sortOrder]);

  const filteredAndSortedDirectLinks = useMemo(() => {
    if (!activeSeason?.directLinks || !Array.isArray(activeSeason.directLinks))
      return [];
    let links = activeSeason.directLinks.filter(
      link => link && link.title && link.link,
    );
    if (searchText.trim()) {
      links = links.filter(link =>
        link?.title?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }
    if (sortOrder === 'desc') links = [...links].reverse();
    return links;
  }, [activeSeason?.directLinks, searchText, sortOrder]);

  const titleAlignment = useMemo(() => {
    const hasLongTitles =
      filteredAndSortedEpisodes.some(ep => ep?.title && ep.title.length > 27) ||
      filteredAndSortedDirectLinks.some(
        link => link?.title && link.title.length > 27,
      );
    return hasLongTitles ? 'justify-start' : 'justify-center';
  }, [filteredAndSortedEpisodes, filteredAndSortedDirectLinks]);

  const getWatchProgressData = useCallback((link: string) => {
    try {
      const watchProgress = JSON.parse(cacheStorage.getString(link) || '{}');
      if (watchProgress?.duration && watchProgress?.position !== undefined) {
        const percentage =
          (watchProgress.position / watchProgress.duration) * 100;
        let text = '';

        if (watchProgress.duration === 1 && watchProgress.position >= 1) {
          return {
            isCompleted: true,
            inProgress: false,
            percentage: 100,
            text: 'Watched',
          };
        }

        if (percentage >= 85) {
          return {
            isCompleted: true,
            inProgress: false,
            percentage: Math.min(100, percentage),
            text: 'Watched',
          };
        }

        if (percentage > 0) {
          const format = (val: number) => {
            let sec = val;
            if (watchProgress.duration > 20000) sec = Math.floor(val / 1000);
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = Math.floor(sec % 60);
            if (h > 0) return `${h}h ${m}m`;
            if (m > 0) return `${m}m`;
            return `${s}s`;
          };
          text = `${format(watchProgress.position)} / ${format(watchProgress.duration)} (${Math.floor(percentage)}%)`;
          return {isCompleted: false, inProgress: true, percentage, text};
        }
      }
    } catch (e) {}
    return {isCompleted: false, inProgress: false, percentage: 0, text: ''};
  }, []);

  const toggleSortOrder = useCallback(() => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    mainStorage.setString('episodeSortOrder', newOrder);
  }, [sortOrder]);

  const handleSeasonChange = useCallback(
    (item: Link) => {
      setActiveSeason(item);
      cacheStorage.setString(
        `ActiveSeason${metaTitle + providerValue}`,
        JSON.stringify(item),
      );
    },
    [metaTitle, providerValue],
  );

  const handleExternalPlayer = useCallback(
    async (link: string, type: string) => {
      setShowServerModal(true);
      setIsLoadingStreams(true);
      try {
        const streams = await fetchStreams(link, type, providerValue);
        if (!streams || streams.length === 0) {
          setShowServerModal(false);
          ToastAndroid.show('No stream available', ToastAndroid.SHORT);
          return;
        }
        setExternalPlayerStreams([...streams]);
      } catch (error) {
        setShowServerModal(false);
        ToastAndroid.show('Failed to load streams', ToastAndroid.SHORT);
      } finally {
        setIsLoadingStreams(false);
      }
    },
    [fetchStreams, providerValue],
  );

  const openExternalPlayer = useCallback(async (streamUrl: string) => {
    setShowServerModal(false);
    setVlcLoading(true);
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: streamUrl,
        type: 'video/*',
      });
    } catch (error) {
      ToastAndroid.show('Failed to open external player', ToastAndroid.SHORT);
    } finally {
      setVlcLoading(false);
    }
  }, []);

  // --- Stable playHandler using useRefs for values that shouldn't cause re-creation ---
  const metaTitleRef = useRef(metaTitle);
  metaTitleRef.current = metaTitle;
  const routeParamsRef = useRef(routeParams);
  routeParamsRef.current = routeParams;
  const posterRef = useRef(poster);
  posterRef.current = poster;
  const providerValueRef = useRef(providerValue);
  providerValueRef.current = providerValue;

  const playHandler = useCallback(
    async ({
      linkIndex,
      type,
      primaryTitle,
      secondaryTitle,
      seasonTitle,
      episodeData,
    }: PlayHandlerProps) => {
      addItem({
        id: routeParamsRef.current.link,
        link: routeParamsRef.current.link,
        title: primaryTitle,
        poster: posterRef.current?.poster,
        provider: providerValueRef.current,
        lastPlayed: Date.now(),
        episodeTitle: secondaryTitle,
        playbackRate: 1,
        currentTime: 0,
        duration: 1,
      });
      if (!episodeData || episodeData.length === 0) return;

      const link = episodeData[linkIndex].link;
      const file = (
        metaTitleRef.current +
        seasonTitle +
        episodeData[linkIndex]?.title
      ).replaceAll(/[^a-zA-Z0-9]/g, '_');
      const externalPlayer = settingsStorage.getBool('useExternalPlayer');
      const dwFile = await ifExists(file);

      if (externalPlayer) {
        if (dwFile) {
          await IntentLauncher.startActivityAsync(
            'android.intent.action.VIEW',
            {data: dwFile, type: 'video/*'},
          );
          return;
        }
        handleExternalPlayer(link, type);
        return;
      }

      navigation.navigate('Player', {
        linkIndex,
        episodeList: episodeData,
        type: type,
        primaryTitle: primaryTitle,
        secondaryTitle: seasonTitle,
        providerValue: providerValueRef.current,
        infoUrl: routeParamsRef.current.link,
        poster:
          posterRef.current?.poster ||
          routeParamsRef.current?.poster ||
          undefined,
        providerName: providerValueRef.current,
      });
    },
    [addItem, navigation, handleExternalPlayer],
  );

  const onLongPressHandler = useCallback(
    (active: boolean, link: string, type?: string) => {
      if (settingsStorage.isHapticFeedbackEnabled()) {
        RNReactNativeHapticFeedback.trigger('effectTick', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      setStickyMenu({active: active, link: link, type: type});
    },
    [],
  );

  const markAsWatched = useCallback(() => {
    if (stickyMenu.link) {
      cacheStorage.setString(
        stickyMenu.link,
        JSON.stringify({position: 10000, duration: 1}),
      );
      setStickyMenu({active: false});
    }
  }, [stickyMenu.link]);

  const markAsUnwatched = useCallback(() => {
    if (stickyMenu.link) {
      cacheStorage.setString(
        stickyMenu.link,
        JSON.stringify({position: 0, duration: 1}),
      );
      setStickyMenu({active: false});
    }
  }, [stickyMenu.link]);

  const handleStickyMenuExternalPlayer = useCallback(() => {
    setStickyMenu({active: false});
    if (stickyMenu.link && stickyMenu.type) {
      handleExternalPlayer(stickyMenu.link, stickyMenu.type);
    }
  }, [stickyMenu.link, stickyMenu.type, handleExternalPlayer]);

  // --- Render helpers with minimal dependencies ---
  const renderEpisodeItem = useCallback(
    ({item, index}: {item: EpisodeLink; index: number}) => {
      if (!item || !item.link || !item.title) return null;
      return (
        <EpisodeRow
          key={item.link + index}
          item={item}
          index={index}
          activeSeason={activeSeason}
          metaTitle={metaTitle}
          type={type}
          providerValue={providerValue}
          playHandler={playHandler}
          getWatchProgressData={getWatchProgressData}
          stickyMenu={stickyMenu}
          titleAlignment={titleAlignment}
          onLongPressHandler={onLongPressHandler}
          primary={primary}
          episodesData={filteredAndSortedEpisodes}
        />
      );
    },
    [
      activeSeason,
      metaTitle,
      type,
      providerValue,
      playHandler,
      getWatchProgressData,
      stickyMenu,
      titleAlignment,
      onLongPressHandler,
      primary,
      filteredAndSortedEpisodes,
    ],
  );

  const renderDirectLinkItem = useCallback(
    ({item, index}: {item: any; index: number}) => {
      if (!item || !item.link || !item.title) return null;
      return (
        <DirectLinkRow
          key={item.link + index}
          item={item}
          index={index}
          activeSeason={activeSeason}
          metaTitle={metaTitle}
          type={type}
          providerValue={providerValue}
          playHandler={playHandler}
          getWatchProgressData={getWatchProgressData}
          stickyMenu={stickyMenu}
          titleAlignment={titleAlignment}
          onLongPressHandler={onLongPressHandler}
          primary={primary}
          directLinksData={filteredAndSortedDirectLinks}
        />
      );
    },
    [
      activeSeason,
      metaTitle,
      type,
      providerValue,
      playHandler,
      getWatchProgressData,
      stickyMenu,
      titleAlignment,
      onLongPressHandler,
      primary,
      filteredAndSortedDirectLinks,
    ],
  );

  const renderServerItem = useCallback(
    (item: any, index: number) => (
      <TouchableOpacity
        delayPressIn={0}
        activeOpacity={0.65}
        key={`server-${index}-${item.server}`}
        className="bg-black/30 p-3 rounded-lg mb-2 flex-row justify-between items-center"
        style={{borderColor: primary, borderWidth: 1}}
        onPress={() => openExternalPlayer(item.link)}>
        <View>
          <Text className="text-white text-lg capitalize font-bold">
            {item.server || `Server ${index + 1}`}
          </Text>
          <Text className="text-white text-xs opacity-80">
            {item.type ? `Format: ${item.type.toUpperCase()}` : ''}
          </Text>
        </View>
        <MaterialCommunityIcons name="vlc" size={24} color={primary} />
      </TouchableOpacity>
    ),
    [primary, openExternalPlayer],
  );

  if (episodeLoading) {
    return (
      <View>
        {LinkList.length > 1 && (
          <Dropdown
            key={LinkList.length} // force re‑mount when list changes
            selectedTextStyle={{
              color: primary,
              overflow: 'hidden',
              height: 20,
              fontWeight: 'bold',
            }}
            labelField={'title'}
            valueField={
              LinkList[0]?.episodesLink ? 'episodesLink' : 'directLinks'
            }
            onChange={handleSeasonChange}
            value={activeSeason}
            data={LinkList}
            style={{
              width: '98%',
              alignSelf: 'center',
              minHeight: 48,
              marginTop: 5,
              marginBottom: 5,
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: '#2f302f',
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: 'black',
            }}
            containerStyle={{
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'gray',
              borderRadius: 8,
              backgroundColor: 'black',
            }}
            renderItem={item => (
              <View
                className={`px-3 py-2 bg-black text-white flex-row justify-start items-center border-b border-gray-500 text-center ${
                  activeSeason === item ? 'bg-quaternary' : ''
                }`}>
                <Text className="text-white">{item?.title || 'Unknown'}</Text>
              </View>
            )}
          />
        )}
        <MotiView
          animate={{backgroundColor: '#0000'}}
          delay={0}
          transition={{type: 'timing'}}
          style={{
            width: '100%',
            padding: 10,
            alignItems: 'flex-start',
            gap: 20,
          }}>
          <Skeleton colorMode={'dark'} width={'85%'} height={48} />
          <Skeleton colorMode={'dark'} width={'85%'} height={48} />
          <Skeleton colorMode={'dark'} width={'85%'} height={48} />
          <Skeleton colorMode={'dark'} width={'85%'} height={48} />
        </MotiView>
      </View>
    );
  }

  if (episodeError) {
    return (
      <View className="p-4">
        <Text className="text-red-500 text-center">
          Failed to load episodes. Please try again.
        </Text>
        <TouchableOpacity
          delayPressIn={0}
          activeOpacity={0.65}
          className="mt-2 bg-red-600 p-2 rounded-md"
          onPress={() => refetchEpisodes()}>
          <Text className="text-white text-center">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {LinkList.length > 1 ? (
        <Dropdown
          key={LinkList.length}
          selectedTextStyle={{
            color: primary,
            overflow: 'hidden',
            height: 20,
            fontWeight: 'bold',
          }}
          labelField={'title'}
          valueField={
            LinkList[0]?.episodesLink ? 'episodesLink' : 'directLinks'
          }
          onChange={handleSeasonChange}
          value={activeSeason}
          data={LinkList}
          style={{
            width: '98%',
            alignSelf: 'center',
            minHeight: 48,
            marginTop: 5,
            marginBottom: 5,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: '#2f302f',
            paddingHorizontal: 12,
            borderRadius: 8,
            backgroundColor: 'black',
          }}
          containerStyle={{
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'gray',
            borderRadius: 8,
            backgroundColor: 'black',
          }}
          renderItem={item => (
            <View
              className={`px-3 py-2 bg-black text-white flex-row justify-start items-center border-b border-gray-500 text-center ${
                activeSeason === item ? 'bg-quaternary' : ''
              }`}>
              <Text className="text-white">{item?.title || 'Unknown'}</Text>
            </View>
          )}
        />
      ) : (
        <Text className="text-red-600 text-lg font-semibold px-2">
          {LinkList[0]?.title || 'Unknown Season'}
        </Text>
      )}

      {(filteredAndSortedEpisodes.length > 8 ||
        filteredAndSortedDirectLinks.length > 8) && (
        <View className="flex-row justify-between items-center mt-2">
          <TextInput
            placeholder="Search..."
            className="bg-black/30 text-white rounded-md p-2 h-10 w-[80%] border-collapse border border-white/10"
            value={searchText}
            onChangeText={setSearchText}
          />
          <TouchableOpacity
            delayPressIn={0}
            activeOpacity={0.65}
            className="bg-black/30 rounded-md p-2 h-10 w-[15%] flex-row justify-center items-center"
            onPress={toggleSortOrder}>
            <MaterialCommunityIcons
              name={sortOrder === 'asc' ? 'sort-ascending' : 'sort-descending'}
              size={24}
              color={primary}
            />
          </TouchableOpacity>
        </View>
      )}

      <View className="flex-row flex-wrap justify-center gap-x-2 gap-y-2">
        {filteredAndSortedEpisodes.length > 0 && (
          <FlatList
            data={filteredAndSortedEpisodes}
            keyExtractor={(item, index) => `episode-${item.link}-${index}`}
            renderItem={renderEpisodeItem}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={true}
            // getItemLayout removed – dynamic heights no longer cause crashes
          />
        )}
        {filteredAndSortedDirectLinks.length > 0 && (
          <View className="w-full justify-center items-center gap-y-2 mt-3 p-2">
            <FlatList
              data={filteredAndSortedDirectLinks}
              keyExtractor={(item, index) => `direct-${item.link}-${index}`}
              renderItem={renderDirectLinkItem}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={true}
              // getItemLayout removed
            />
          </View>
        )}
      </View>

      {/* Sticky Menu Modal */}
      <Modal
        animationType="fade"
        visible={stickyMenu.active}
        transparent={true}
        onRequestClose={() => setStickyMenu({active: false})}>
        <Pressable
          className="flex-1 justify-end items-center"
          onPress={() => setStickyMenu({active: false})}>
          <View className="w-full h-14 bg-quaternary flex-row justify-evenly items-center pt-2">
            {getWatchProgressData(stickyMenu.link || '').isCompleted ? (
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={0.65}
                className="flex-row justify-center items-center gap-2 p-2"
                onPress={markAsUnwatched}>
                <Text className="text-white">Marked as Unwatched</Text>
                <Ionicons name="checkmark-done" size={30} color={primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={0.65}
                className="flex-row justify-center items-center gap-2 pt-0 pb-2 px-2 bg-tertiary rounded-md"
                onPress={markAsWatched}>
                <Text className="text-white">Mark as Watched</Text>
                <Ionicons name="checkmark" size={25} color={primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              delayPressIn={0}
              activeOpacity={0.65}
              className="flex-row justify-center bg-tertiary rounded-md items-center pt-0 pb-2 px-2 gap-2"
              onPress={handleStickyMenuExternalPlayer}>
              <Text className="text-white font-bold text-base">
                External Player
              </Text>
              <Feather name="external-link" size={20} color={primary} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Server Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showServerModal}
        onRequestClose={() => setShowServerModal(false)}>
        <Pressable
          className="flex-1 justify-end bg-black/60"
          onPress={() => setShowServerModal(false)}>
          <Pressable className="w-full bg-zinc-900 rounded-t-2xl p-5 min-h-[30%] max-h-[70%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">
                Select Server
              </Text>
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={0.65}
                onPress={() => setShowServerModal(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {isLoadingStreams ? (
              <View className="py-10 items-center justify-center">
                <ActivityIndicator size="large" color={primary} />
                <Text className="text-gray-400 mt-4 text-base">
                  Fetching Streams...
                </Text>
              </View>
            ) : externalPlayerStreams.length > 0 ? (
              <FlatList
                data={externalPlayerStreams}
                keyExtractor={(item, index) => `server-${index}-${item.server}`}
                renderItem={({item, index}) => renderServerItem(item, index)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{paddingBottom: 20}}
              />
            ) : (
              <View className="py-10 items-center justify-center">
                <Text className="text-gray-400 text-base">
                  No streams found.
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* VLC Loading Modal */}
      <Modal visible={vlcLoading} transparent={true} animationType="fade">
        <View className="flex-1 bg-black/80 justify-center items-center">
          <Animated.View style={{transform: [{rotate: vlcSpin}]}}>
            <MaterialCommunityIcons name="vlc" size={80} color={primary} />
          </Animated.View>
          <Text className="text-white text-lg font-semibold mt-4">
            Opening External Player...
          </Text>
        </View>
      </Modal>
    </View>
  );
};

export default SeasonList;
