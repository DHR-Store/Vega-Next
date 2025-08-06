import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';

// Define a placeholder type for the music item
interface MusicItem {
  id: string;
  title: string;
  artist: string;
  image: string;
}

const DUMMY_SEARCH_RESULTS: MusicItem[] = [
  {
    id: '1',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    image: 'https://placehold.co/100x100/1DB954/FFFFFF?text=Album',
  },
  {
    id: '2',
    title: 'Heat Waves',
    artist: 'Glass Animals',
    image: 'https://placehold.co/100x100/1DB954/FFFFFF?text=Album',
  },
  {
    id: '3',
    title: 'Levitating',
    artist: 'Dua Lipa',
    image: 'https://placehold.co/100x100/1DB954/FFFFFF?text=Album',
  },
  {
    id: '4',
    title: 'bad guy',
    artist: 'Billie Eilish',
    image: 'https://placehold.co/100x100/1DB954/FFFFFF?text=Album',
  },
  {
    id: '5',
    title: 'Good as Hell',
    artist: 'Lizzo',
    image: 'https://placehold.co/100x100/1DB954/FFFFFF?text=Album',
  },
];

const VegaMusicSearch = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MusicItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // A simulated search function. In a real app, this would call an API.
  const handleSearch = useCallback(async (query: string) => {
    if (!query) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    // Simulate a network request
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSearchResults(
      DUMMY_SEARCH_RESULTS.filter(
        item =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.artist.toLowerCase().includes(query.toLowerCase()),
      ),
    );
    setIsLoading(false);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const renderItem = ({item}: {item: MusicItem}) => (
    <TouchableOpacity style={styles.resultItem}>
      <Image source={{uri: item.image}} style={styles.resultImage} />
      <View style={styles.resultTextContainer}>
        <Text style={styles.resultTitle}>{item.title}</Text>
        <Text style={styles.resultArtist}>{item.artist}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header and Search Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Feather
            name="search"
            size={20}
            color="#B3B3B3"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Find songs, artists, or albums"
            placeholderTextColor="#B3B3B3"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => handleSearch(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#B3B3B3" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results Section */}
      <View style={styles.searchResultsContainer}>
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color="#1DB954"
            style={styles.loadingIndicator}
          />
        ) : searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <Text style={styles.noResultsText}>
            Start typing to find your favorite music!
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  backButton: {
    marginRight: 10,
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
  clearButton: {
    marginLeft: 8,
  },
  searchResultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  resultImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultArtist: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  noResultsText: {
    color: '#B3B3B3',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  loadingIndicator: {
    marginTop: 50,
  },
});

export default VegaMusicSearch;
