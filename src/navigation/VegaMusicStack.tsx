import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import {
  MaterialCommunityIcons,
  Feather,
} from '@expo/vector-icons';
import useAppModeStore from '../lib/zustand/appModeStore'; // Corrected import path
import VegaMusicSearchScreen from './VegaMusicSearchScreen'; // Import the search screen component

// Define the parameter list for the stack navigator
// This is the source of truth for the screens and their parameters
export type VegaMusicStackParamList = {
  VegaMusicHome: undefined;
  VegaMusicSearch: undefined;
};

// We will create the navigator here, as this file is what's being imported
const Stack = createNativeStackNavigator<VegaMusicStackParamList>();
const { width } = Dimensions.get('window');

/**
 * A working API client function to fetch home page data from a public endpoint.
 * This function is robust and handles potential API errors gracefully.
 * @returns {Promise<object>} The home page data object.
 */
const getHomePageData = async () => {
  const API_URL = 'https://jiosaavn-api-privatecvc2.vercel.app/modules?language=hindi,english';
  console.log(`Fetching data from: ${API_URL}`);

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch home page data from API:', error);
    // Return a structured empty response to prevent app crashes
    return {
      status: 'failed',
      data: {
        'new-albums': { albums: [] },
        'top-playlists': { playlists: [] },
        charts: { list: [] },
        'promo-video': { list: [] },
        'global-artists': { list: [] },
        trending: { songs: [] },
      },
    };
  }
};

type VegaMusicHomeProps = NativeStackScreenProps<VegaMusicStackParamList, 'VegaMusicHome'>;

const VegaMusicHome = () => {
  const isMountedRef = useRef(true);
  const navigation = useNavigation(); // Use useNavigation hook to get navigation prop
  const setAppMode = useAppModeStore(state => state.setAppMode); // Get the setAppMode function from the store

  // We'll use custom colors inspired by suzam19.html
  const primaryColor = '#00c3ff'; // A vibrant blue
  const secondaryColor = '#b3b3b3'; // A light gray for secondary text
  const primaryBg = '#121212'; // Dark background
  const secondaryBg = '#1e1e1e'; // Slightly lighter dark background
  const tertiaryBg = '#282828'; // Another lighter dark background

  // Initialize state with empty, safe values to prevent render errors
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [homeData, setHomeData] = useState({
    newAlbums: [],
    moodsAndGenres: [],
    charts: [],
    videoCharts: [],
    topArtists: [],
    trendingSongs: [],
  });

  /**
   * Fetches home page data from the API and updates state.
   * This function is wrapped in useCallback to prevent unnecessary re-creations.
   */
  const fetchData = useCallback(async () => {
    if (!isMountedRef.current) return;
    setLoading(true);
    try {
      const response = await getHomePageData();

      if (isMountedRef.current && response.status === 'success') {
        const newAlbumsList = response?.data?.['new-albums']?.albums || [];
        const moodsAndGenresList = response?.data?.['top-playlists']?.playlists || [];
        const chartsList = response?.data?.charts?.list || [];
        const videoChartsList = response?.data?.['promo-video']?.list || [];
        const topArtistsList = response?.data?.['global-artists']?.list || [];
        const trendingSongsList = response?.data?.trending?.songs || [];

        setHomeData({
          newAlbums: newAlbumsList,
          moodsAndGenres: moodsAndGenresList,
          charts: chartsList,
          videoCharts: videoChartsList,
          topArtists: topArtistsList,
          trendingSongs: trendingSongsList,
        });
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Failed to fetch music data:', error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * useEffect to trigger the data fetching once the component mounts.
   * The cleanup function ensures we don't try to update state on an unmounted component.
   */
  useEffect(() => {
    fetchData();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);

  /**
   * Navigates back to a different screen to exit music mode.
   * This assumes a screen named 'TabStack' exists in the navigation stack, as per your code.
   */
  const handleExitMusicMode = useCallback(() => {
    console.log('Exiting music mode.');
    // The user's App.tsx code switches to `TabStack` for video mode
    // We will navigate back to that root screen.
    // The setAppMode function from the zustand store is used to trigger the switch.
    setAppMode('video');
  }, [setAppMode]);

  const navigateToSearch = useCallback(() => {
    // Corrected navigation call to use 'VegaMusicSearch'
    navigation.navigate('VegaMusicSearch');
  }, [navigation]);

  // Render functions for list items
  const renderAlbumItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.horizontalScrollItem}>
      <Image
        source={{ uri: item.image?.[2]?.link || 'https://placehold.co/128x128/1F2937/FFFFFF?text=Album' }}
        style={styles.albumImage}
        resizeMode="cover"
      />
      <Text numberOfLines={1} style={styles.songName}>
        {item.name || 'Unknown Album'}
      </Text>
      <Text numberOfLines={1} style={styles.songArtist}>
        {item.artists?.map((artist: { name: string }) => artist.name).join(', ') || item.artist || 'Unknown Artist'}
      </Text>
    </TouchableOpacity>
  );

  const renderTrendingSongItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.horizontalScrollItem}>
      <Image
        source={{ uri: item.image?.[2]?.link || 'https://placehold.co/128x128/1F2937/FFFFFF?text=Song' }}
        style={styles.albumImage}
        resizeMode="cover"
      />
      <Text numberOfLines={1} style={styles.songName}>
        {item.name || 'Unknown Song'}
      </Text>
      <Text numberOfLines={1} style={styles.songArtist}>
        {item.artists?.map((artist: { name: string }) => artist.name).join(', ') || item.artist || 'Unknown Artist'}
      </Text>
    </TouchableOpacity>
  );

  const renderGenreItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={[styles.genreCard, { backgroundColor: item.color || tertiaryBg }]}>
      <Text style={styles.genreTitle}>{item.title || 'Playlist'}</Text>
    </TouchableOpacity>
  );

  const renderChartItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.horizontalScrollItem}>
      <Image
        source={{ uri: item.image?.[2]?.link || 'https://placehold.co/128x128/1F2937/FFFFFF?text=Chart' }}
        style={styles.albumImage}
        resizeMode="cover"
      />
      <Text numberOfLines={1} style={styles.songName}>
        {item.name || 'Unknown Chart'}
      </Text>
      <Text numberOfLines={1} style={styles.songArtist}>
        {item.subtitle || ''}
      </Text>
    </TouchableOpacity>
  );

  const renderArtistItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity style={styles.artistListItem}>
      <View style={styles.artistInfoContainer}>
        <Text style={styles.artistIndex}>{index + 1}</Text>
        <Image
          source={{ uri: item.image?.[2]?.link || 'https://placehold.co/48x48/1F2937/FFFFFF?text=Artist' }}
          style={styles.artistImage}
          resizeMode="cover"
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.artistName}>
            {item.name || 'Unknown Artist'}
          </Text>
          <Text numberOfLines={1} style={styles.artistSubtitle}>
            {item.subtitle || ''}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={secondaryColor} />
    </TouchableOpacity>
  );

  const isDataAvailable = [
    homeData.newAlbums,
    homeData.moodsAndGenres,
    homeData.charts,
    homeData.videoCharts,
    homeData.topArtists,
    homeData.trendingSongs
  ].some(list => list.length > 0);

  const renderHomeContent = () => (
    <View style={styles.contentContainer}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={styles.loadingText}>Loading music...</Text>
        </View>
      ) : isDataAvailable ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {homeData.trendingSongs.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Trending Songs</Text>
                <Feather name="arrow-right" size={20} color={secondaryColor} />
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={homeData.trendingSongs}
                renderItem={renderTrendingSongItem}
                keyExtractor={(item, index) => item.id || index.toString()}
                contentContainerStyle={{ paddingRight: 10 }}
              />
            </View>
          )}
          {homeData.newAlbums.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>New Albums</Text>
                <Feather name="arrow-right" size={20} color={secondaryColor} />
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={homeData.newAlbums}
                renderItem={renderAlbumItem}
                keyExtractor={(item, index) => item.id || index.toString()}
                contentContainerStyle={{ paddingRight: 10 }}
              />
            </View>
          )}
          {homeData.moodsAndGenres.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Top Playlists</Text>
                <Feather name="arrow-right" size={20} color={secondaryColor} />
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={homeData.moodsAndGenres}
                renderItem={renderGenreItem}
                keyExtractor={(item, index) => item.id || index.toString()}
                contentContainerStyle={{ paddingRight: 10 }}
              />
            </View>
          )}
          {homeData.charts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Charts</Text>
                <Feather name="arrow-right" size={20} color={secondaryColor} />
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={homeData.charts}
                renderItem={renderChartItem}
                keyExtractor={(item, index) => item.id || index.toString()}
                contentContainerStyle={{ paddingRight: 10 }}
              />
            </View>
          )}
          {homeData.videoCharts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Video charts</Text>
                <Feather name="arrow-right" size={20} color={secondaryColor} />
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={homeData.videoCharts}
                renderItem={renderChartItem}
                keyExtractor={(item, index) => item.id || index.toString()}
                contentContainerStyle={{ paddingRight: 10 }}
              />
            </View>
          )}
          {homeData.topArtists.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Top Artists</Text>
                <Feather name="arrow-right" size={20} color={secondaryColor} />
              </View>
              <FlatList
                data={homeData.topArtists}
                renderItem={renderArtistItem}
                keyExtractor={(item, index) => item.id || index.toString()}
                scrollEnabled={false}
              />
            </View>
          )}
          <Text style={styles.bottomText}>
            Log in to your account for more content
          </Text>
        </ScrollView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.noDataTitle}>No music data available</Text>
          <Text style={styles.noDataText}>
            Please check your internet connection or try again later.
          </Text>
        </View>
      )}
    </View>
  );

  const renderPlaylistsContent = () => (
    <View style={[styles.contentArea, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={styles.noDataTitle}>Playlists</Text>
      <Text style={styles.noDataText}>
        Your saved playlists will appear here.
      </Text>
    </View>
  );

  const renderSettingsContent = () => (
    <View style={styles.contentArea}>
      <Text style={styles.sectionTitle}>Settings</Text>
      <TouchableOpacity
        onPress={handleExitMusicMode}
        style={styles.settingItem}>
        <View style={styles.settingItemContent}>
          <Feather name="x-circle" size={24} color="#f44336" style={{ marginRight: 10 }} />
          <Text style={styles.settingItemText}>Exit VegaMusic Mode</Text>
        </View>
        <Feather name="chevron-right" size={20} color={secondaryColor} />
      </TouchableOpacity>
      <Text style={styles.bottomText}>
        More settings options will be here in the future.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <View>
          <TouchableOpacity onPress={handleExitMusicMode} style={{ marginBottom: 32 }}>
            <Feather name="x-circle" size={28} color={primaryColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('home')}
            style={[styles.navButton, activeTab === 'home' && styles.navButtonActive]}>
            <Feather
              name="home"
              size={24}
              color={activeTab === 'home' ? primaryColor : secondaryColor}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('playlists')}
            style={[styles.navButton, activeTab === 'playlists' && styles.navButtonActive]}>
            <MaterialCommunityIcons
              name="playlist-music"
              size={24}
              color={activeTab === 'playlists' ? primaryColor : secondaryColor}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={navigateToSearch}
            style={styles.navButton}>
            <Feather name="search" size={24} color={secondaryColor} />
          </TouchableOpacity>
        </View>

        <View>
          <TouchableOpacity
            onPress={() => setActiveTab('settings')}
            style={[styles.navButton, activeTab === 'settings' && styles.navButtonActive]}>
            <Feather
              name="settings"
              size={24}
              color={activeTab === 'settings' ? primaryColor : secondaryColor}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainContent}>
        {activeTab === 'home' && renderHomeContent()}
        {activeTab === 'playlists' && renderPlaylistsContent()}
        {activeTab === 'settings' && renderSettingsContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#000',
  },
  navBar: {
    width: 80,
    backgroundColor: '#1A1A1A',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 24,
  },
  navButtonActive: {
    backgroundColor: '#262626',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#121212',
  },
  contentContainer: {
    flex: 1,
    padding: 15,
    backgroundColor: '#121212',
    paddingTop: 20,
  },
  contentArea: {
    flex: 1,
    padding: 15,
    backgroundColor: '#121212',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  horizontalScrollItem: {
    flexShrink: 0,
    width: 130,
    marginRight: 15,
  },
  albumImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  songName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  songArtist: {
    fontSize: 12,
    color: '#b3b3b3',
  },
  genreCard: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  genreTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  artistListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  artistInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artistIndex: {
    color: '#b3b3b3',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
    width: 25,
  },
  artistImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  artistName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  artistSubtitle: {
    color: '#b3b3b3',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 256,
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 16,
  },
  noDataTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noDataText: {
    color: '#b3b3b3',
    textAlign: 'center',
    marginTop: 8,
  },
  bottomText: {
    color: '#b3b3b3',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#262626',
    borderRadius: 8,
    marginBottom: 16,
  },
  settingItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
});

// Correctly defines the stack navigator without nesting a NavigationContainer
const VegaMusicStack = () => {
  return (
    <Stack.Navigator initialRouteName="VegaMusicHome">
      <Stack.Screen name="VegaMusicHome" component={VegaMusicHome} options={{ headerShown: false }} />
      <Stack.Screen name="VegaMusicSearch" component={VegaMusicSearchScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};

export default VegaMusicStack;
