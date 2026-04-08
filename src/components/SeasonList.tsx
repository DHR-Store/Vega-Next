import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ToastAndroid,
  Modal,
  FlatList,
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
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

// --- NEW IMPORTS ---
import AsyncStorage from '@react-native-async-storage/async-storage';
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
// --- CUSTOM EPISODE ROW COMPONENT WITH PROGRESS BUTTON ---
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
    isCompleted,
    stickyMenu,
    titleAlignment,
    onLongPressHandler,
    primary,
    episodesData,
  }: any) => {
    const [progress, setProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const fileName = (
      metaTitle +
      (activeSeason?.title || '') +
      item.title
    ).replaceAll(/[^a-zA-Z0-9]/g, '_');

    useEffect(() => {
      let interval: NodeJS.Timeout;
      const checkStatus = async () => {
        try {
          const taskData = await AsyncStorage.getItem(`download_${fileName}`);
          if (taskData) {
            const task = JSON.parse(taskData);
            if (task.totalBytes > 0) {
              const pct = (task.downloadedBytes / task.totalBytes) * 100;
              setProgress(pct);
              setIsDownloading(pct < 100); // Stop animating once it hits 100%
            } else {
              setIsDownloading(true);
              setProgress(0);
            }
          } else {
            setIsDownloading(false);
            setProgress(0);
          }
        } catch (error) {
          // Safe to ignore polling errors
        }
      };

      interval = setInterval(checkStatus, 1000);
      checkStatus(); // Initial Check
      return () => clearInterval(interval);
    }, [fileName]);

    return (
      <View
        className={`w-full justify-center items-center gap-2 flex-row my-1 ${
          isCompleted(item.link) || stickyMenu.link === item.link
            ? 'opacity-60'
            : ''
        }`}>
        <View className="flex-row w-full justify-between gap-2 items-center">
          {/* Main Episode Button with Background Gradient Progress */}
          <TouchableOpacity
            className={`rounded-md bg-white/30 w-[80%] h-12 items-center p-1 flex-row gap-x-2 relative overflow-hidden ${titleAlignment}`}
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
            {/* Animated Background Filling Up */}
            {isDownloading && (
              <LinearGradient
                colors={['#FF416C', '#FF4B2B']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${progress}%`,
                  opacity: 0.85,
                }}
              />
            )}

            <Ionicons name="play-circle" size={28} color={primary} />
            <Text className="text-white bg-transparent">
              {item.title.length > 30
                ? item.title.slice(0, 30) + '...'
                : item.title}
            </Text>

            {/* Download Percentage Text displayed on the Button */}
            {isDownloading && (
              <Text
                className="text-white font-bold ml-auto pr-2 bg-transparent"
                style={{fontSize: 12}}>
                {Math.floor(progress)}%
              </Text>
            )}
          </TouchableOpacity>

          {/* Existing Downloader untouched */}
          <Downloader
            providerValue={providerValue}
            link={item.link}
            type={type}
            title={
              metaTitle.length > 30
                ? metaTitle.slice(0, 30) + '... ' + item.title
                : metaTitle + ' ' + item.title
            }
            fileName={fileName}
          />
        </View>
      </View>
    );
  },
);

// ============================================================================
// --- CUSTOM DIRECT LINK ROW COMPONENT WITH PROGRESS BUTTON ---
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
    isCompleted,
    stickyMenu,
    titleAlignment,
    onLongPressHandler,
    primary,
    directLinksData,
  }: any) => {
    const [progress, setProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const fileName = (
      metaTitle +
      (activeSeason?.title || '') +
      item.title
    ).replaceAll(/[^a-zA-Z0-9]/g, '_');

    useEffect(() => {
      let interval: NodeJS.Timeout;
      const checkStatus = async () => {
        try {
          const taskData = await AsyncStorage.getItem(`download_${fileName}`);
          if (taskData) {
            const task = JSON.parse(taskData);
            if (task.totalBytes > 0) {
              const pct = (task.downloadedBytes / task.totalBytes) * 100;
              setProgress(pct);
              setIsDownloading(pct < 100);
            } else {
              setIsDownloading(true);
              setProgress(0);
            }
          } else {
            setIsDownloading(false);
            setProgress(0);
          }
        } catch (error) {
          // Safe to ignore
        }
      };

      interval = setInterval(checkStatus, 1000);
      checkStatus();
      return () => clearInterval(interval);
    }, [fileName]);

    return (
      <View
        className={`w-full justify-center items-center my-2 gap-2 flex-row ${
          isCompleted(item.link) || stickyMenu.link === item.link
            ? 'opacity-60'
            : ''
        }`}>
        <View className="flex-row w-full justify-between gap-2 items-center">
          {/* Main DirectLink Button with Background Gradient Progress */}
          <TouchableOpacity
            className={`rounded-md bg-white/30 w-[80%] h-12 items-center p-2 flex-row gap-x-2 relative overflow-hidden ${titleAlignment}`}
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
            {isDownloading && (
              <LinearGradient
                colors={['#FF416C', '#FF4B2B']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${progress}%`,
                  opacity: 0.85,
                }}
              />
            )}

            <Ionicons name="play-circle" size={28} color={primary} />
            <Text className="text-white bg-transparent">
              {activeSeason?.directLinks?.length &&
              activeSeason?.directLinks?.length > 1
                ? item.title?.length > 27
                  ? item.title.slice(0, 27) + '...'
                  : item.title
                : 'Play'}
            </Text>

            {isDownloading && (
              <Text
                className="text-white font-bold ml-auto pr-2 bg-transparent"
                style={{fontSize: 12}}>
                {Math.floor(progress)}%
              </Text>
            )}
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
            fileName={fileName}
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
      } catch (error) {
        console.warn('Failed to parse cached season:', error);
      }
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

  const filteredAndSortedEpisodes = useMemo(() => {
    if (!episodeList || !Array.isArray(episodeList)) return [];
    let episodes = episodeList.filter(
      episode => episode && episode.title && episode.link,
    );
    if (searchText.trim()) {
      episodes = episodes.filter(
        episode =>
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
      links = links.filter(
        link => link?.title?.toLowerCase().includes(searchText.toLowerCase()),
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

  const isCompleted = useCallback((link: string) => {
    const watchProgress = JSON.parse(cacheStorage.getString(link) || '{}');
    const percentage =
      (watchProgress?.position / watchProgress?.duration) * 100;
    return percentage > 85;
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
      setVlcLoading(true);
      setIsLoadingStreams(true);
      try {
        const streams = await fetchStreams(link, type, providerValue);
        if (!streams || streams.length === 0) {
          ToastAndroid.show('No stream available', ToastAndroid.SHORT);
          return;
        }
        setExternalPlayerStreams([...streams]);
        setIsLoadingStreams(false);
        setVlcLoading(false);
        setShowServerModal(true);
      } catch (error) {
        ToastAndroid.show('Failed to load streams', ToastAndroid.SHORT);
      } finally {
        setVlcLoading(false);
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
        id: routeParams.link,
        link: routeParams.link,
        title: primaryTitle,
        poster: poster?.poster,
        provider: providerValue,
        lastPlayed: Date.now(),
        episodeTitle: secondaryTitle,
        playbackRate: 1,
        currentTime: 0,
        duration: 1,
      });
      if (!episodeData || episodeData.length === 0) return;

      const link = episodeData[linkIndex].link;
      const file = (
        metaTitle +
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
        providerValue: providerValue,
        infoUrl: routeParams.link,
        poster: poster?.poster || routeParams?.poster || undefined,
        providerName: providerValue,
      });
    },
    [
      addItem,
      routeParams.link,
      poster,
      providerValue,
      metaTitle,
      handleExternalPlayer,
      navigation,
    ],
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
          isCompleted={isCompleted}
          stickyMenu={stickyMenu}
          titleAlignment={titleAlignment}
          onLongPressHandler={onLongPressHandler}
          primary={primary}
          episodesData={filteredAndSortedEpisodes}
        />
      );
    },
    [
      isCompleted,
      stickyMenu.link,
      titleAlignment,
      playHandler,
      metaTitle,
      activeSeason,
      filteredAndSortedEpisodes,
      onLongPressHandler,
      primary,
      providerValue,
      type,
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
          isCompleted={isCompleted}
          stickyMenu={stickyMenu}
          titleAlignment={titleAlignment}
          onLongPressHandler={onLongPressHandler}
          primary={primary}
          directLinksData={filteredAndSortedDirectLinks}
        />
      );
    },
    [
      isCompleted,
      stickyMenu.link,
      titleAlignment,
      playHandler,
      metaTitle,
      activeSeason,
      filteredAndSortedDirectLinks,
      onLongPressHandler,
      primary,
      providerValue,
      type,
    ],
  );

  const renderServerItem = useCallback(
    (item: any, index: number) => (
      <TouchableOpacity
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
            getItemLayout={(data, index) => ({
              length: 60,
              offset: 60 * index,
              index,
            })}
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
              getItemLayout={(data, index) => ({
                length: 68,
                offset: 68 * index,
                index,
              })}
            />
          </View>
        )}
      </View>

      <Modal
        animationType="fade"
        visible={stickyMenu.active}
        transparent={true}
        onRequestClose={() => setStickyMenu({active: false})}>
        <Pressable
          className="flex-1 justify-end items-center"
          onPress={() => setStickyMenu({active: false})}>
          <View className="w-full h-14 bg-quaternary flex-row justify-evenly items-center pt-2">
            {isCompleted(stickyMenu.link || '') ? (
              <TouchableOpacity
                className="flex-row justify-center items-center gap-2 p-2"
                onPress={markAsUnwatched}>
                <Text className="text-white">Marked as Unwatched</Text>
                <Ionicons name="checkmark-done" size={30} color={primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="flex-row justify-center items-center gap-2 pt-0 pb-2 px-2 bg-tertiary rounded-md"
                onPress={markAsWatched}>
                <Text className="text-white">Mark as Watched</Text>
                <Ionicons name="checkmark" size={25} color={primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
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
    </View>
  );
};

export default SeasonList;
