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
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons, Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

// Get the window width for responsive design
const { width } = Dimensions.get('window');

/**
 * Data class to represent the structure of a music item (Album, Song, Chart, Artist).
 * This mirrors the structure of the data fetched from the API.
 *
 * @param id The unique identifier of the item.
 * @param name The name of the item.
 * @param subtitle The subtitle, often used for artists or descriptions.
 * @param image The list of image links with different sizes.
 * @param artists A list of artist objects, used for songs and albums.
 * @param color A color for the item, used for genres/playlists.
 */
interface MusicItem {
  id?: string;
  name?: string;
  subtitle?: string;
  image?: Array<{ link?: string }>;
  artists?: Array<{ name?: string }>;
  color?: string;
  url?: string;
  album?: {
    id: string;
    name: string;
    url: string;
  };
}

/**
 * Data class to hold the entire home page data.
 */
interface HomePageData {
  'trending-songs'?: { songs: MusicItem[] };
  'new-albums'?: { albums: MusicItem[] };
  charts?: { charts: MusicItem[] };
  'top-playlists'?: { playlists: MusicItem[] };
  'artist-reco'?: { artists: MusicItem[] };
  'top-albums'?: { albums: MusicItem[] };
  genres?: { genres: MusicItem[] };
  'radio-stations'?: { stations: MusicItem[] };
}

/**
 * Utility function to make API calls to the new JioSaavn API.
 * The old API was unstable, so this function is updated to use a new, reliable one.
 * @param path The API endpoint path.
 * @returns The fetched data or null if an error occurs.
 */
const API_BASE_URL = 'https://saavn.dev/api';
const fetchData = async (path: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`Failed to fetch data from ${path}:`, error);
    Toast.show({
      type: 'error',
      text1: 'API Error',
      text2: 'Could not fetch data. Please check your network connection.',
    });
    return null;
  }
};

/**
 * Fetches the initial data for the home screen.
 * It fetches multiple modules to populate different sections of the home page.
 */
const fetchHomePageData = async () => {
  const data = await fetchData('/modules?language=english,hindi');
  if (data) {
    // Mapping the API response to the HomePageData interface
    const homePageData: HomePageData = {
      'trending-songs': data['trending-songs'],
      'new-albums': data['new-albums'],
      charts: data['charts'],
      'top-playlists': data['top-playlists'],
      'artist-reco': data['artist-reco'],
      'top-albums': data['top-albums'],
      genres: data['genres'],
      'radio-stations': data['radio-stations'],
    };
    return homePageData;
  }
  return null;
};

/**
 * Fetches search results for a given query.
 * @param query The search term.
 */
const fetchSearchResults = async (query: string) => {
  if (!query) return null;
  const data = await fetchData(`/search/songs?query=${query}`);
  return data;
};

const HomePageView = ({ navigation }: { navigation: any }) => {
  const [data, setData] = useState<HomePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MusicItem[] | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Fetch initial home page data on component mount
    const loadData = async () => {
      setLoading(true);
      const homeData = await fetchHomePageData();
      setData(homeData);
      setLoading(false);
    };
    loadData();
  }, []);

  // Handle the search functionality
  const handleSearch = useCallback(async () => {
    if (!searchQuery) {
      setSearchResults(null);
      return;
    }
    setLoading(true);
    const results = await fetchSearchResults(searchQuery);
    setSearchResults(results);
    setLoading(false);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, [searchQuery]);

  // Handle the back button to show home screen again
  const handleGoBack = useCallback(() => {
    setSearchQuery('');
    setSearchResults(null);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, []);

  const renderCardItem = ({ item }: { item: MusicItem }) => (
    <TouchableOpacity
      style={styles.musicItemContainer}
      onPress={() => console.log('Playing:', item.name)}
    >
      <Image
        source={{ uri: item.image?.find(img => img.link)?.link || 'https://placehold.co/128x128.png?text=Vega' }}
        style={styles.musicItemImage}
      />
      <Text style={styles.musicItemTitle} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.musicItemSubtitle} numberOfLines={1}>
        {item.artists?.map(artist => artist.name).join(', ') || item.subtitle}
      </Text>
    </TouchableOpacity>
  );

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <TouchableOpacity onPress={() => console.log('See all:', title)}>
        <Text style={styles.seeAllText}>See all</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPlaylist = ({ item }: { item: MusicItem }) => (
    <TouchableOpacity
      style={[
        styles.playlistItemContainer,
        { backgroundColor: item.color || '#1e1e1e' },
      ]}
      onPress={() => console.log('Viewing playlist:', item.name)}
    >
      <Text style={styles.playlistItemText} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderArtist = ({ item }: { item: MusicItem }) => (
    <TouchableOpacity
      style={styles.artistListItem}
      onPress={() => console.log('Viewing artist:', item.name)}
    >
      <View style={styles.artistListItemContent}>
        <Image
          source={{ uri: item.image?.find(img => img.link)?.link || 'https://placehold.co/48x48.png?text=Artist' }}
          style={styles.artistListItemImage}
        />
        <View style={styles.artistListItemTextContainer}>
          <Text style={styles.artistListItemTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.artistListItemSubtitle} numberOfLines={1}>
            {item.subtitle || 'Artist'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSearchResults = ({ item }: { item: MusicItem }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => console.log('Playing search result:', item.name)}
    >
      <Image
        source={{ uri: item.image?.find(img => img.link)?.link || 'https://placehold.co/64x64.png?text=Song' }}
        style={styles.searchResultImage}
      />
      <View style={styles.searchResultTextContainer}>
        <Text style={styles.searchResultTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.searchResultSubtitle} numberOfLines={1}>
          {item.album?.name || item.subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Loading indicator for fetching data
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Loading Music...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Handle the case where no data is available
  if (!data && !searchResults) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>No music data available.</Text>
          <Text style={styles.errorSubText}>Please check your network and try again.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        {searchResults && (
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
        <View style={styles.searchBar}>
          <Feather name="search" size={20} color="#b3b3b3" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for songs, artists, or albums"
            placeholderTextColor="#b3b3b3"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
        </View>
      </View>

      <ScrollView ref={scrollViewRef} style={styles.scrollView}>
        {searchResults ? (
          <View style={styles.searchResultSection}>
            <Text style={styles.searchResultCount}>
              Found {searchResults.length} results for "{searchQuery}"
            </Text>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id || Math.random().toString()}
              renderItem={renderSearchResults}
              nestedScrollEnabled
            />
          </View>
        ) : (
          <>
            {/* Trending Songs Section */}
            {data?.['trending-songs']?.songs && data['trending-songs'].songs.length > 0 && (
              <View>
                {renderSectionHeader('Trending Songs')}
                <FlatList
                  data={data['trending-songs'].songs}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={renderCardItem}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {/* New Albums Section */}
            {data?.['new-albums']?.albums && data['new-albums'].albums.length > 0 && (
              <View>
                {renderSectionHeader('New Albums')}
                <FlatList
                  data={data['new-albums'].albums}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={renderCardItem}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {/* Top Playlists Section */}
            {data?.['top-playlists']?.playlists && data['top-playlists'].playlists.length > 0 && (
              <View>
                {renderSectionHeader('Top Playlists')}
                <FlatList
                  data={data['top-playlists'].playlists}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={renderPlaylist}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {/* Top Artists Section */}
            {data?.['artist-reco']?.artists && data['artist-reco'].artists.length > 0 && (
              <View>
                {renderSectionHeader('Artists for You')}
                <FlatList
                  data={data['artist-reco'].artists}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={renderArtist}
                  nestedScrollEnabled
                />
              </View>
            )}

            {/* Top Albums Section */}
            {data?.['top-albums']?.albums && data['top-albums'].albums.length > 0 && (
              <View>
                {renderSectionHeader('Top Albums')}
                <FlatList
                  data={data['top-albums'].albums}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={renderCardItem}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {/* Charts Section */}
            {data?.['charts']?.charts && data['charts'].charts.length > 0 && (
              <View>
                {renderSectionHeader('Charts')}
                <FlatList
                  data={data['charts'].charts}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={renderCardItem}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {/* Genres Section */}
            {data?.['genres']?.genres && data['genres'].genres.length > 0 && (
              <View>
                {renderSectionHeader('Genres')}
                <FlatList
                  data={data['genres'].genres}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={renderPlaylist}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {/* Radio Stations Section */}
            {data?.['radio-stations']?.stations && data['radio-stations'].stations.length > 0 && (
              <View>
                {renderSectionHeader('Radio Stations')}
                <FlatList
                  data={data['radio-stations'].stations}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={renderCardItem}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    color: '#ff6347',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  errorSubText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  seeAllText: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  horizontalListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  musicItemContainer: {
    width: 128,
    marginRight: 16,
  },
  musicItemImage: {
    width: 128,
    height: 128,
    borderRadius: 8,
  },
  musicItemTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  musicItemSubtitle: {
    color: '#B3B3B3',
    fontSize: 12,
    marginTop: 4,
  },
  playlistItemContainer: {
    width: 128,
    height: 64,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    padding: 8,
  },
  playlistItemText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  artistListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  artistListItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  artistListItemImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  artistListItemTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  artistListItemTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  artistListItemSubtitle: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#282828',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
  },
  backButton: {
    marginRight: 10,
    padding: 5,
  },
  searchResultSection: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  searchResultCount: {
    color: '#B3B3B3',
    fontSize: 14,
    marginBottom: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  searchResultImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
  },
  searchResultTextContainer: {
    flex: 1,
  },
  searchResultTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchResultSubtitle: {
    color: '#B3B3B3',
    fontSize: 12,
    marginTop: 4,
  },
});

export default function App() {
  const navigation = useNavigation();

  // Create a placeholder for the actual app container to display HomePageView
  // In a real React Native app, this would be part of a navigation stack
  return (
    <View style={{ flex: 1 }}>
      <HomePageView navigation={navigation} />
    </View>
  );
}
