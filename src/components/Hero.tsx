import {Image, MotiView, View} from 'moti';
import React, {memo, useState, useCallback, useEffect, useMemo} from 'react';
import {
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import FontAwesome6 from '@expo/vector-icons/FontAwesome';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {HomeStackParamList, SearchStackParamList} from '../App';
import useContentStore from '../lib/zustand/contentStore';
import useHeroStore from '../lib/zustand/herostore';
import {Skeleton} from 'moti/skeleton';
import {settingsStorage, watchListStorage} from '../lib/storage'; // Watchlist Storage Add
import {DrawerLayout} from 'react-native-gesture-handler';
import {useHeroMetadata} from '../lib/hooks/useHomePageData';
import useWatchListStore from '../lib/zustand/watchListStore'; // Watchlist Store Add
import ReactNativeHapticFeedback from 'react-native-haptic-feedback'; // Haptic Add
import {providerManager} from '../lib/services/ProviderManager'; // Scraper Add

interface HeroProps {
  isDrawerOpen: boolean;
  drawerRef: React.RefObject<DrawerLayout>;
}

const Hero = memo(({isDrawerOpen, drawerRef}: HeroProps) => {
  const [searchActive, setSearchActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // States for interactive buttons
  const [isSaved, setIsSaved] = useState(false);
  const [isPlayLoading, setIsPlayLoading] = useState(false);

  const {provider} = useContentStore(state => state);
  const {hero, heroes} = useHeroStore(state => state as any);
  const {addItem, removeItem} = useWatchListStore(state => state);

  const [showHamburgerMenu] = useState(() =>
    settingsStorage.showHamburgerMenu(),
  );
  const [isDrawerDisabled] = useState(
    () => settingsStorage.getBool('disableDrawer') || false,
  );

  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const searchNavigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();

  const heroList = useMemo(() => {
    if (heroes && heroes.length > 0) return heroes;
    if (hero) return [hero];
    return [];
  }, [heroes, hero]);

  const currentHero = heroList[currentIndex];

  // Auto-rotate hero content every 6 seconds
  useEffect(() => {
    if (heroList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % heroList.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [heroList.length]);

  // Sync watchlist icon state when hero rotates or updates
  useEffect(() => {
    if (currentHero?.link) {
      setIsSaved(watchListStorage.isInWatchList(currentHero.link));
    }
  }, [currentHero]);

  const {
    data: heroData,
    isLoading,
    error,
  } = useHeroMetadata(currentHero?.link || '', provider.value);

  const handleKeyboardHide = useCallback(() => {
    setSearchActive(false);
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener(
      'keyboardDidHide',
      handleKeyboardHide,
    );
    return () => subscription?.remove();
  }, [handleKeyboardHide]);

  const handleSearchSubmit = useCallback(
    (text: string) => {
      if (text.startsWith('https://')) {
        navigation.navigate('Info', {link: text});
      } else {
        searchNavigation.navigate('ScrollList', {
          providerValue: provider.value,
          filter: text,
          title: provider.display_name,
          isSearch: true,
        });
      }
    },
    [navigation, searchNavigation, provider.value, provider.display_name],
  );

  // --- FIXED PLAY PRESS (Fetches proper stream links before opening player) ---
  const handlePlayPress = useCallback(async () => {
    if (!currentHero?.link) return;

    setIsPlayLoading(true); // Shows Loading spinner on Play Button
    try {
      // 1. Fetch info dynamically to extract real playable links (linkList)
      const info = await providerManager.getInfo(
        currentHero.link,
        provider.value,
      );

      const episodes = info?.linkList || info?.episodes;

      if (episodes && episodes.length > 0) {
        const primaryTitle =
          info?.title ||
          heroData?.name ||
          heroData?.title ||
          currentHero?.title ||
          'Movie';

        // 2. Direct play on Player using safely resolved episodes
        (navigation as any).navigate('Player', {
          linkIndex: 0,
          episodeList: episodes,
          type: info?.type || heroData?.type || 'movie',
          primaryTitle: primaryTitle,
          poster: {
            logo: info?.logo || heroData?.logo,
            poster:
              info?.poster ||
              info?.image ||
              heroData?.poster ||
              heroData?.image,
            background:
              info?.background || heroData?.background || heroData?.image,
          },
          providerValue: provider.value,
          infoUrl: currentHero.link,
        });
      } else {
        // Fallback: If no links extracted, go to Info screen to let user choose manually
        navigation.navigate('Info', {
          link: currentHero.link,
          provider: provider.value,
          poster: heroData?.image || heroData?.poster || heroData?.background,
        });
      }
    } catch (err) {
      console.error('Direct play extraction failed:', err);
      // Fallback on error
      navigation.navigate('Info', {
        link: currentHero.link,
        provider: provider.value,
        poster: heroData?.image || heroData?.poster || heroData?.background,
      });
    } finally {
      setIsPlayLoading(false);
    }
  }, [navigation, currentHero, provider.value, heroData]);

  const handleInfoPress = useCallback(() => {
    if (currentHero?.link) {
      navigation.navigate('Info', {
        link: currentHero.link,
        provider: provider.value,
        poster: heroData?.image || heroData?.poster || heroData?.background,
      });
    }
  }, [navigation, currentHero?.link, provider.value, heroData]);

  // --- FIXED WATCHLIST BUTTON TOGGLE LOGIC ---
  const handleToggleWatchlist = useCallback(() => {
    if (!currentHero?.link) return;

    // Optional Haptics for premium feel
    ReactNativeHapticFeedback.trigger('effectClick', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });

    if (isSaved) {
      removeItem(currentHero.link);
      setIsSaved(false);
    } else {
      addItem({
        title: heroData?.name || heroData?.title || currentHero.title,
        poster:
          heroData?.poster ||
          heroData?.image ||
          heroData?.background ||
          currentHero.image,
        link: currentHero.link,
        provider: provider.value,
      });
      setIsSaved(true);
    }
  }, [isSaved, currentHero, heroData, provider.value, addItem, removeItem]);

  const handleImageError = useCallback(() => {
    console.warn('Hero image failed to load');
  }, []);

  const imageSource = useMemo(() => {
    const fallbackImage =
      'https://placehold.jp/24/363636/ffffff/500x500.png?text=Vega';
    if (!heroData) return {uri: fallbackImage};
    return {
      uri:
        heroData.background ||
        heroData.image ||
        heroData.poster ||
        fallbackImage,
    };
  }, [heroData]);

  const displayGenres = useMemo(() => {
    if (!heroData) return [];
    return (heroData.genre || heroData.tags || []).slice(0, 3);
  }, [heroData]);

  if (error) {
    console.error('Hero metadata error:', error);
  }

  return (
    <View className="relative h-[60vh] bg-black">
      <MotiView
        key={`bg-${currentIndex}`}
        from={{opacity: 0.4}}
        animate={{opacity: 1}}
        transition={{type: 'timing', duration: 800}}
        className="absolute w-full h-full z-0">
        <Skeleton show={isLoading} colorMode="dark">
          <Image
            source={imageSource}
            onError={handleImageError}
            className="h-full w-full"
            style={{resizeMode: 'cover'}}
          />
        </Skeleton>
      </MotiView>

      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent', 'black']}
        locations={[0, 0.4, 1]}
        className="absolute h-full w-full z-10"
      />
      {searchActive && (
        <LinearGradient
          colors={['black', 'transparent']}
          locations={[0, 0.5]}
          className="absolute h-[40%] w-full z-10"
        />
      )}

      <View className="absolute pt-3 w-full top-10 px-4 z-40 flex-row justify-between items-center">
        {!searchActive && (
          <View
            className={`${
              showHamburgerMenu && !isDrawerDisabled
                ? 'opacity-100'
                : 'opacity-0'
            }`}>
            <Pressable
              className={`${isDrawerOpen ? 'opacity-0' : 'opacity-100'}`}
              onPress={() => drawerRef.current?.openDrawer()}>
              <Ionicons name="menu-sharp" size={28} color="white" />
            </Pressable>
          </View>
        )}

        {searchActive && (
          <MotiView
            from={{opacity: 0, scale: 0.9, translateX: -20}}
            animate={{opacity: 1, scale: 1, translateX: 0}}
            transition={{type: 'timing', duration: 250}}
            className="flex-1 mr-4">
            <TextInput
              onBlur={() => setSearchActive(false)}
              autoFocus={true}
              onSubmitEditing={e => handleSearchSubmit(e.nativeEvent.text)}
              placeholder={`Search in ${provider.display_name}`}
              className="w-full px-5 h-11 rounded-full border-white border bg-black/50 text-white"
              placeholderTextColor="#ccc"
            />
          </MotiView>
        )}

        <Pressable
          onPress={() => setSearchActive(!searchActive)}
          className="p-2 rounded-full bg-black/20">
          <Feather
            name={searchActive ? 'x' : 'search'}
            size={24}
            color="white"
          />
        </Pressable>
      </View>

      <MotiView
        key={`content-${currentIndex}`}
        from={{opacity: 0, translateY: 15}}
        animate={{opacity: 1, translateY: 0}}
        transition={{type: 'timing', duration: 600}}
        className="absolute bottom-8 w-full z-30 px-4">
        {!isLoading && heroData ? (
          <View className="items-center gap-y-3">
            {heroData.logo ? (
              <Image
                source={{uri: heroData.logo}}
                style={{width: 220, height: 90, resizeMode: 'contain'}}
                onError={() => console.warn('Logo failed to load')}
              />
            ) : (
              <Text className="text-white text-center text-3xl font-extrabold tracking-wide drop-shadow-lg">
                {heroData.name || heroData.title}
              </Text>
            )}

            {displayGenres.length > 0 && (
              <View className="flex-row items-center justify-center space-x-2 mt-1">
                {displayGenres.map((genre: string, index: number) => (
                  <React.Fragment key={index}>
                    <Text className="text-gray-200 text-xs font-semibold tracking-wider uppercase">
                      {genre}
                    </Text>
                    {index < displayGenres.length - 1 && (
                      <View className="w-1 h-1 rounded-full bg-red-600" />
                    )}
                  </React.Fragment>
                ))}
              </View>
            )}

            <View className="flex-row items-center justify-center space-x-10 w-full mt-4">
              <TouchableOpacity
                className="items-center justify-center"
                onPress={handleToggleWatchlist}
                activeOpacity={0.7}>
                <Feather
                  name={isSaved ? 'check' : 'plus'}
                  size={24}
                  color="white"
                />
                <Text className="text-white text-[10px] font-bold mt-1 uppercase">
                  My List
                </Text>
              </TouchableOpacity>

              {currentHero?.link && (
                <TouchableOpacity
                  className="bg-white px-8 py-2.5 rounded-md flex-row items-center justify-center space-x-2 shadow-lg"
                  onPress={handlePlayPress}
                  disabled={isPlayLoading}
                  activeOpacity={0.8}>
                  {isPlayLoading ? (
                    <ActivityIndicator size="small" color="black" />
                  ) : (
                    <FontAwesome6 name="play" size={18} color="black" />
                  )}
                  <Text className="text-black font-bold text-lg">
                    {isPlayLoading ? 'Loading...' : 'Play'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                className="items-center justify-center"
                onPress={handleInfoPress}
                activeOpacity={0.7}>
                <Feather name="info" size={24} color="white" />
                <Text className="text-white text-[10px] font-bold mt-1 uppercase">
                  Info
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="items-center">
            {isLoading ? (
              <Skeleton show={true} height={45} width={160} colorMode="dark" />
            ) : (
              <>
                <Text className="text-white text-center text-xl font-bold">
                  {currentHero?.title || 'Content Unavailable'}
                </Text>
                <Text className="text-gray-400 text-sm mt-2">
                  Unable to load details
                </Text>
              </>
            )}
          </View>
        )}
      </MotiView>
    </View>
  );
});

Hero.displayName = 'Hero';

export default Hero;
