import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  Pressable,
  DeviceEventEmitter,
  ActivityIndicator,
} from 'react-native';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import {mainStorage as MMKV} from '../lib/storage/StorageService';
import {useNavigation} from '@react-navigation/native';
import useThemeStore from '../lib/zustand/themeStore';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {TabStackParamList} from '../App';
import AntDesign from '@expo/vector-icons/AntDesign';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {TMDB_API_KEY, TMDB_IMAGE_BASE} from '../lib/config/aiConfig';
import {useContentDetails} from '../lib/hooks/useContentInfo'; // adjust path

// --- TMDB fallback (with corrected URL) ---
const fetchTmdbImage = async (title: string): Promise<string | null> => {
  if (!title) return null;
  try {
    const cleanTitle = title.split(/[\(–\-]/)[0].trim();
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data?.results?.length > 0 && data.results[0].poster_path) {
      const base = TMDB_IMAGE_BASE.endsWith('/')
        ? TMDB_IMAGE_BASE
        : TMDB_IMAGE_BASE + '/';
      return `${base}w342${data.results[0].poster_path}`;
    }
  } catch (error) {
    console.warn('TMDB fallback error:', error);
  }
  return null;
};

// --- Sub-component with full fallback chain ---
const MovieCard = React.memo(
  ({
    item,
    progress,
    isSelected,
    selectionMode,
    primary,
    onPress,
    onLongPress,
  }: {
    item: any;
    progress: number;
    isSelected: boolean;
    selectionMode: boolean;
    primary: string;
    onPress: () => void;
    onLongPress: () => void;
  }) => {
    // 1) Start with the provider poster
    const [imageUri, setImageUri] = useState<string | null>(
      item?.poster || null,
    );
    const [imageError, setImageError] = useState(false);
    const [isLoadingFallback, setIsLoadingFallback] = useState(false);
    const [fallbackAttempted, setFallbackAttempted] = useState(false);

    // 2) React Query hook – fetches metadata from your own provider/Cinemeta
    const {info: metadata} = useContentDetails(item.link, item.provider);

    // ----- EFFECT 1: Immediately try TMDB if provider poster missing -----
    useEffect(() => {
      if (!item.poster && !fallbackAttempted) {
        setIsLoadingFallback(true);
        fetchTmdbImage(item.title).then(uri => {
          setFallbackAttempted(true);
          setIsLoadingFallback(false);
          if (uri) {
            setImageUri(uri);
            setImageError(false);
          } else {
            // If TMDB also fails, we'll wait for metadata (handled in effect 2)
            setImageUri(null);
          }
        });
      }
    }, [item.poster, item.title, fallbackAttempted]);

    // ----- EFFECT 2: Use metadata image if still missing after TMDB attempt -----
    useEffect(() => {
      // Only act when TMDB fallback has finished (or was never needed) and we still have no image
      if (fallbackAttempted && !imageUri && metadata) {
        const metaImage = metadata.image || metadata.poster; // depends on your data structure
        if (metaImage) {
          setImageUri(metaImage);
          setImageError(false);
        }
      }
    }, [fallbackAttempted, imageUri, metadata]);

    // ----- Image error handler (for any URI that fails to load) -----
    const handleImageError = () => {
      if (imageError && fallbackAttempted) return; // already attempted everything

      setImageError(true);
      if (!fallbackAttempted) {
        setIsLoadingFallback(true);
        fetchTmdbImage(item.title).then(uri => {
          setFallbackAttempted(true);
          setIsLoadingFallback(false);
          if (uri) {
            setImageUri(uri);
            setImageError(false);
          } else {
            // TMDB failed, metadata will take over via effect 2
            setImageUri(null);
          }
        });
      }
    };

    const showPlaceholder = (!imageUri || imageError) && !isLoadingFallback;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        className="max-w-[100px] mx-2"
        onLongPress={e => {
          e.stopPropagation();
          onLongPress();
        }}
        onPress={e => {
          e.stopPropagation();
          onPress();
        }}>
        <View className="relative">
          {isLoadingFallback ? (
            <View
              className="bg-gray-800 rounded-md flex items-center justify-center"
              style={{width: 100, height: 150}}>
              <ActivityIndicator color="#6B7280" size="small" />
              <Text className="text-gray-400 text-xs mt-1">Loading...</Text>
            </View>
          ) : showPlaceholder ? (
            <View
              className="bg-gray-800 rounded-md flex items-center justify-center"
              style={{width: 100, height: 150}}>
              <MaterialCommunityIcons
                name="image-off-outline"
                size={30}
                color="#6B7280"
              />
              <Text className="text-gray-400 text-xs mt-1">No Image</Text>
            </View>
          ) : (
            <Image
              source={{uri: imageUri!}}
              className="rounded-md bg-gray-800"
              style={{width: 100, height: 150}}
              resizeMode="cover"
              onError={handleImageError}
            />
          )}

          {selectionMode && (
            <View className="absolute top-2 right-2 z-50">
              <View
                className={`w-5 h-5 rounded-full flex items-center justify-center ${isSelected ? '' : 'bg-white/30'}`}
                style={{
                  borderWidth: 1,
                  borderColor: 'white',
                  backgroundColor: isSelected ? primary : undefined,
                }}>
                {isSelected && (
                  <AntDesign name="check" size={12} color="white" />
                )}
              </View>
            </View>
          )}

          {isSelected && (
            <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/30 rounded-lg" />
          )}

          <View
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${progress}%`,
                backgroundColor: primary,
              }}
            />
          </View>
        </View>
        <Text
          className="text-white text-center truncate w-24 text-xs mt-1"
          numberOfLines={2}>
          {item.title}
        </Text>
      </TouchableOpacity>
    );
  },
);

// --- Main component (unchanged) ---
const ContinueWatching = () => {
  const {primary} = useThemeStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const {history, removeItem} = useWatchHistoryStore(state => state);
  const [progressData, setProgressData] = useState<Record<string, number>>({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);

  const [isVisible, setIsVisible] = useState(() => {
    const val = MMKV.getBool('showRecentlyWatched');
    if (val === 'false' || val === false) return false;
    if (val === 'true' || val === true) return true;
    return true;
  });

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener(
      'changeRecentlyWatched',
      newValue => {
        setIsVisible(newValue === true || newValue === 'true');
      },
    );
    return () => listener.remove();
  }, []);

  const recentItems = React.useMemo(() => {
    const seen = new Set();
    return history
      .filter(item => {
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
      })
      .slice(0, 10);
  }, [history]);

  useEffect(() => {
    const progressMap: Record<string, number> = {};
    recentItems.forEach(item => {
      try {
        const historyKey = item.link;
        const historyProgressKey = `watch_history_progress_${historyKey}`;
        const storedProgress = MMKV.getString(historyProgressKey);
        if (storedProgress) {
          const parsed = JSON.parse(storedProgress);
          if (parsed.percentage) {
            progressMap[item.link] = Math.min(
              Math.max(parsed.percentage, 0),
              100,
            );
          } else if (parsed.currentTime && parsed.duration) {
            progressMap[item.link] = Math.min(
              Math.max((parsed.currentTime / parsed.duration) * 100, 0),
              100,
            );
          }
        } else if (item.currentTime && item.duration) {
          progressMap[item.link] = Math.min(
            Math.max((item.currentTime / item.duration) * 100, 0),
            100,
          );
        }
      } catch (e) {
        console.error('Progress error:', e);
      }
    });
    setProgressData(progressMap);
  }, [recentItems]);

  const handleNavigateToInfo = (item: any) => {
    try {
      let linkData = item.link;
      if (typeof item.link === 'string' && item.link.startsWith('{')) {
        linkData = JSON.parse(item.link);
      }
      navigation.navigate('HomeStack', {
        screen: 'Info',
        params: {link: linkData, provider: item.provider, poster: item.poster},
      } as any);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const toggleItemSelection = (link: string) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      newSelected.has(link) ? newSelected.delete(link) : newSelected.add(link);
      if (newSelected.size === 0) setSelectionMode(false);
      return newSelected;
    });
  };

  const handleLongPress = (link: string) => {
    ReactNativeHapticFeedback.trigger('effectClick', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    if (!selectionMode) setSelectionMode(true);
    toggleItemSelection(link);
  };

  const handlePress = (item: any) => {
    selectionMode ? toggleItemSelection(item.link) : handleNavigateToInfo(item);
  };

  const deleteSelectedItems = () => {
    recentItems.forEach(item => {
      if (selectedItems.has(item.link)) removeItem(item);
    });
    setSelectedItems(new Set());
    setSelectionMode(false);
  };

  const exitSelectionMode = () => {
    setSelectedItems(new Set());
    setSelectionMode(false);
  };

  if (!isVisible || recentItems.length === 0) return null;

  return (
    <Pressable
      onPress={() => selectionMode && exitSelectionMode()}
      className="mt-3 mb-8">
      <View className="flex flex-row justify-between items-center px-2 mb-3">
        <Text className="text-2xl font-semibold" style={{color: primary}}>
          Continue Watching
        </Text>
        {selectionMode && selectedItems.size > 0 && (
          <View className="flex flex-row items-center">
            <Text className="text-white mr-1">
              {selectedItems.size} selected
            </Text>
            <TouchableOpacity
              onPress={deleteSelectedItems}
              className="rounded-full mr-2">
              <MaterialCommunityIcons
                name="delete-outline"
                size={25}
                color={primary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <FlatList
        data={recentItems}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.link}
        contentContainerStyle={{paddingHorizontal: 12}}
        renderItem={({item}) => (
          <MovieCard
            item={item}
            progress={progressData[item.link] || 0}
            isSelected={selectedItems.has(item.link)}
            selectionMode={selectionMode}
            primary={primary}
            onPress={() => handlePress(item)}
            onLongPress={() => handleLongPress(item.link)}
          />
        )}
      />
    </Pressable>
  );
};

export default ContinueWatching;
