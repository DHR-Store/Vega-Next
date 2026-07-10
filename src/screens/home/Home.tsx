import {
  SafeAreaView,
  RefreshControl,
  View,
  Text,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
} from 'react-native';
import Slider from '../../components/Slider';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import HeroOptimized from '../../components/Hero';
import {mainStorage} from '../../lib/storage';
import useContentStore from '../../lib/zustand/contentStore';
import useHeroStore from '../../lib/zustand/herostore';
import {
  useHomePageData,
  getRandomHeroPost,
} from '../../lib/hooks/useHomePageData';
import useThemeStore from '../../lib/zustand/themeStore';
import ProviderDrawer from '../../components/ProviderDrawer';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../../App';
import DrawerLayout from 'react-native-gesture-handler/DrawerLayout';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import ContinueWatching from '../../components/ContinueWatching';
import {providerManager} from '../../lib/services/ProviderManager';
import Tutorial from '../../components/Touturial';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import {StatusBar} from 'expo-status-bar';
import {FlashList} from '@shopify/flash-list'; // Replaced FlatList with FlashList

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const Home = ({}: Props) => {
  const {primary} = useThemeStore(state => state);
  const [backgroundColor, setBackgroundColor] = useState('transparent');
  const drawer = useRef<DrawerLayout>(null);

  const [isDrawerOpen] = useState(false);

  const disableDrawer = useMemo(
    () => mainStorage.getBool('disableDrawer') || false,
    [],
  );

  const {provider, installedProviders} = useContentStore(state => state);
  const {setHero} = useHeroStore(state => state);

  const {
    data: homeData = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useHomePageData({
    provider,
    enabled: !!(installedProviders?.length && provider?.value),
  });

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollY = event.nativeEvent.contentOffset.y;
      const newBackgroundColor = scrollY > 10 ? 'black' : 'transparent';

      if (backgroundColor !== newBackgroundColor) {
        setBackgroundColor(newBackgroundColor);
      }
    },
    [backgroundColor],
  );

  const heroPost = useMemo(() => {
    if (!homeData || homeData.length === 0) {
      return null;
    }
    return getRandomHeroPost(homeData);
  }, [homeData]);

  React.useEffect(() => {
    if (heroPost) {
      setHero(heroPost);
    } else {
      setHero({link: '', image: '', title: ''});
    }
  }, [heroPost, setHero]);

  const handleRefresh = useCallback(async () => {
    try {
      await refetch();
    } catch (refreshError) {
      console.error('Error refreshing home data:', refreshError);
    }
  }, [refetch]);

  const skeletonData = useMemo(() => {
    if (!provider?.value) return [];
    return providerManager.getCatalog({providerValue: provider.value});
  }, [provider?.value]);

  const listData = useMemo(() => {
    if (isLoading) return skeletonData;
    return homeData;
  }, [isLoading, skeletonData, homeData]);

  const renderItem = useCallback(
    ({item}: {item: any}) => {
      return (
        <Slider
          isLoading={isLoading}
          title={item.title}
          posts={isLoading ? [] : item.Posts}
          filter={item.filter}
        />
      );
    },
    [isLoading],
  );

  const ListHeader = useMemo(() => {
    return (
      <View>
        <HeroOptimized drawerRef={drawer} isDrawerOpen={isDrawerOpen} />
        <ContinueWatching />
        <View className="-mt-6 relative z-20" />
      </View>
    );
  }, [isDrawerOpen]);

  const ListFooter = useMemo(() => {
    if (error) {
      return (
        <View className="p-4 m-4 bg-red-500/20 rounded-lg min-h-64 flex-1 justify-center items-center">
          <Text className="text-red-400 text-center font-medium">
            {error?.message || 'Failed to load content'}
          </Text>
          <Text className="text-gray-400 text-center text-sm mt-1">
            Pull to refresh and try again
          </Text>
        </View>
      );
    }
    return <View className="h-16" />;
  }, [error]);

  if (
    !installedProviders ||
    installedProviders.length === 0 ||
    !provider?.value
  ) {
    return <Tutorial />;
  }

  return (
    <QueryErrorBoundary>
      {/* Extracted inline style to prevent object recreation on render */}
      <SafeAreaView className="bg-black flex-1">
        <DrawerLayout
          drawerPosition="left"
          drawerWidth={200}
          drawerLockMode={disableDrawer ? 'locked-closed' : 'unlocked'}
          drawerType="front"
          edgeWidth={70}
          ref={drawer}
          drawerBackgroundColor="transparent"
          renderNavigationView={() =>
            !disableDrawer && <ProviderDrawer drawerRef={drawer} />
          }>
          <StatusBar
            style="light"
            animated={true}
            translucent={true}
            backgroundColor={backgroundColor}
          />

          {/* FlashList requires a View with a bounded size (flex: 1) to render properly */}
          <View style={styles.flex1} className="bg-black">
            <FlashList
              data={listData}
              renderItem={renderItem}
              keyExtractor={(item, index) =>
                `${item.filter || 'section'}-${index}`
              }
              // FlashList strictly requires an estimatedItemSize for fast layouts
              // 250 is roughly the height of a title + horizontal poster slider
              estimatedItemSize={250}
              ListHeaderComponent={ListHeader}
              ListFooterComponent={ListFooter}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              refreshControl={
                <RefreshControl
                  colors={[primary]}
                  tintColor={primary}
                  progressBackgroundColor="black"
                  refreshing={isRefetching}
                  onRefresh={handleRefresh}
                />
              }
            />
          </View>
        </DrawerLayout>
      </SafeAreaView>
    </QueryErrorBoundary>
  );
};

// Moving static styles out of the component scope
const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
});

export default React.memo(Home);
