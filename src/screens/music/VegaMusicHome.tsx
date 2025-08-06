import React, {useCallback, useEffect, useState, useRef} from 'react';
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
  TextInput,
  Keyboard,
} from 'react-native';
import {Feather, Ionicons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import {LinearGradient} from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

const {width} = Dimensions.get('window');

// API base URL from user request
const API_BASE_URL = 'https://jiosaavn-api-privatecvc2.vercel.app';

/**
 * Data class to represent the structure of a music item (Album, Song, Chart, Artist).
 */
interface MusicItem {
  id?: string;
  name?: string;
  subtitle?: string;
  image?: Array<{link?: string}>;
  artists?: Array<{name?: string}>;
  color?: string;
  url?: string;
}

/**
 * Interface for the overall music data structure.
 */
interface MusicData {
  charts: MusicItem[];
  albums: MusicItem[];
  newReleases: MusicItem[];
}

// Component to render a section title
const SectionTitle = ({title}: {title: string}) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

// Component to render a horizontal list of music items
const MusicHorizontalList = ({data}: {data: MusicItem[]}) => (
  <FlatList
    data={data}
    horizontal
    showsHorizontalScrollIndicator={false}
    keyExtractor={item => item.id || Math.random().toString()}
    renderItem={({item}) => (
      <View style={styles.itemContainer}>
        <Image source={{uri: item.image?.[0]?.link}} style={styles.itemImage} />
        <Text style={styles.itemTitle}>{item.name}</Text>
        <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
      </View>
    )}
  />
);

// Component to render a list of search results
const SearchResultsList = ({data}: {data: MusicItem[]}) => (
  <FlatList
    data={data}
    keyExtractor={item => item.id || Math.random().toString()}
    renderItem={({item}) => (
      <TouchableOpacity style={styles.searchItemContainer}>
        <Image
          source={{uri: item.image?.[0]?.link}}
          style={styles.searchItemImage}
        />
        <View style={styles.searchItemTextContainer}>
          <Text style={styles.searchItemTitle}>{item.name}</Text>
          <Text style={styles.searchItemSubtitle}>{item.subtitle}</Text>
        </View>
      </TouchableOpacity>
    )}
  />
);

const VegaMusicHome = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [musicData, setMusicData] = useState<MusicData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MusicItem[] | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Ref to track if the component is mounted.
  const isMounted = useRef(true);

  // Set isMounted to false when the component unmounts.
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Fetches music data for the home screen from the Saavn API.
   */
  const fetchMusicDataFromSaavn = useCallback(async () => {
    try {
      if (!isMounted.current) return;
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/modules?language=english`);
      const data = await response.json();

      if (isMounted.current) {
        if (data.status === 'SUCCESS' && data.data) {
          const apiData = data.data;
          const transformedData: MusicData = {
            charts: apiData.charts.map((item: any) => ({
              id: item.id,
              name: item.title,
              subtitle: item.subtitle,
              image: item.image,
              color: '#1DB954',
              url: item.url,
            })),
            albums: apiData.albums.map((item: any) => ({
              id: item.id,
              name: item.title,
              subtitle: item.artists
                ?.map((artist: any) => artist.name)
                .join(', '),
              image: item.image,
              url: item.url,
            })),
            newReleases: apiData.new_albums.map((item: any) => ({
              id: item.id,
              name: item.title,
              subtitle: item.artists
                ?.map((artist: any) => artist.name)
                .join(', '),
              image: item.image,
              url: item.url,
            })),
          };
          setMusicData(transformedData);
        } else {
          setMusicData({charts: [], albums: [], newReleases: []});
        }
        setIsLoading(false);
      }
    } catch (error) {
      if (isMounted.current) {
        console.error('Failed to fetch home music data:', error);
        setMusicData(null);
        setIsLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Home Data Error',
          text2: 'Failed to load home music data.',
        });
      }
    }
  }, []);

  /**
   * Fetches search results based on the search query.
   */
  const fetchSearchResults = useCallback(async (query: string) => {
    if (!query) {
      setSearchResults(null);
      return;
    }

    if (!isMounted.current) return;
    setIsSearching(true);
    Keyboard.dismiss(); // Hide the keyboard

    try {
      // Use the specific search songs endpoint
      const response = await fetch(
        `${API_BASE_URL}/search/songs?query=${encodeURIComponent(query)}`,
      );
      const data = await response.json();

      if (isMounted.current) {
        // The API response structure is different, so we check for 'data.results'
        if (data.status === 'SUCCESS' && data.data?.results) {
          const transformedResults = data.data.results.map((item: any) => ({
            id: item.id,
            name: item.title,
            subtitle: item.artists
              ?.map((artist: any) => artist.name)
              .join(', '),
            image: item.image,
            url: item.url,
          }));
          setSearchResults(transformedResults);
        } else {
          setSearchResults([]);
          Toast.show({
            type: 'info',
            text1: 'No Results',
            text2: `No results found for "${query}".`,
          });
        }
        setIsSearching(false);
      }
    } catch (error) {
      if (isMounted.current) {
        console.error('Failed to fetch search results:', error);
        setSearchResults(null);
        setIsSearching(false);
        Toast.show({
          type: 'error',
          text1: 'Search Error',
          text2: 'Failed to perform search. Please try again.',
        });
      }
    }
  }, []);

  useEffect(() => {
    fetchMusicDataFromSaavn();
  }, [fetchMusicDataFromSaavn]);

  const renderContent = () => {
    if (isSearching) {
      return (
        <ActivityIndicator
          style={styles.loadingIndicator}
          size="large"
          color="#FFFFFF"
        />
      );
    }

    if (searchResults) {
      return (
        <View style={styles.searchContentContainer}>
          <Text style={styles.searchTitle}>Search Results</Text>
          {searchResults.length > 0 ? (
            <SearchResultsList data={searchResults} />
          ) : (
            <Text style={styles.noResultsText}>No results found.</Text>
          )}
        </View>
      );
    }

    if (isLoading) {
      return (
        <ActivityIndicator
          style={styles.loadingIndicator}
          size="large"
          color="#FFFFFF"
        />
      );
    }

    if (!musicData) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Could not load data.</Text>
          <TouchableOpacity
            onPress={fetchMusicDataFromSaavn}
            style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollView}>
        {musicData.charts.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="Charts" />
            <FlatList
              data={musicData.charts}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.id || Math.random().toString()}
              renderItem={({item}) => (
                <LinearGradient
                  colors={[item.color || '#1DB954', '#121212']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  style={styles.chartItem}>
                  <Image
                    source={{uri: item.image?.[0]?.link}}
                    style={styles.chartImage}
                  />
                  <View style={styles.chartTextContainer}>
                    <Text style={styles.chartTitle}>{item.name}</Text>
                    <Text style={styles.chartSubtitle}>{item.subtitle}</Text>
                  </View>
                </LinearGradient>
              )}
            />
          </View>
        )}

        {musicData.albums.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="New Albums" />
            <MusicHorizontalList data={musicData.albums} />
          </View>
        )}

        {musicData.newReleases.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="New Releases" />
            <MusicHorizontalList data={musicData.newReleases} />
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {searchResults ? (
          <TouchableOpacity onPress={() => setSearchResults(null)}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              console.log('Open menu');
            }}>
            <Feather name="menu" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.searchBar}
          placeholder="Search for songs or artists..."
          placeholderTextColor="#B3B3B3"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => fetchSearchResults(searchQuery)}
          returnKeyType="search"
        />
        <TouchableOpacity
          onPress={() => {
            // Navigate to the VegaSettings screen
            navigation.navigate('VegaSettings');
          }}>
          <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {renderContent()}

      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  searchBar: {
    flex: 1,
    height: 40,
    backgroundColor: '#282828',
    borderRadius: 20,
    paddingHorizontal: 15,
    color: '#FFFFFF',
    marginHorizontal: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quickAccessContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  quickAccessButton: {
    backgroundColor: '#282828',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  quickAccessText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  chartItem: {
    width: width * 0.7,
    height: 150,
    borderRadius: 10,
    marginRight: 10,
    padding: 15,
    justifyContent: 'flex-end',
  },
  chartImage: {
    width: 60,
    height: 60,
    borderRadius: 5,
    position: 'absolute',
    top: 15,
    left: 15,
  },
  chartTextContainer: {
    flexDirection: 'column',
  },
  chartTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chartSubtitle: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  itemContainer: {
    width: 120,
    marginRight: 15,
    alignItems: 'center',
  },
  itemImage: {
    width: 120,
    height: 120,
    borderRadius: 10,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  itemSubtitle: {
    color: '#B3B3B3',
    fontSize: 12,
    textAlign: 'center',
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  searchTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  searchItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 10,
  },
  searchItemImage: {
    width: 60,
    height: 60,
    borderRadius: 5,
    marginRight: 15,
  },
  searchItemTextContainer: {
    flex: 1,
  },
  searchItemTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchItemSubtitle: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  noResultsText: {
    color: '#B3B3B3',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#B3B3B3',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VegaMusicHome;
