import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Custom colors to match the app theme
const primaryColor = '#00c3ff';
const secondaryColor = '#b3b3b3';
const primaryBg = '#121212';
const secondaryBg = '#1e1e1e';
const tertiaryBg = '#282828';

/**
 * A simple component for the Vega Music Search Screen.
 * It features a search bar and handles the search logic to navigate to a new results page.
 */
const VegaMusicSearchScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Placeholder function to handle the search logic.
   * This function simulates an API call (e.g., to the Saavn API) and navigates to a new page
   * with the search results.
   */
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      return;
    }
    setIsLoading(true);

    // Simulate an API call to get search results (e.g., from Saavn API)
    try {
      // In a real application, you would make a fetch call here, for example:
      // const response = await fetch(`https://api.saavn.com/search?q=${searchQuery}`);
      // const data = await response.json();
      // const results = data.results;

      // Dummy search results for demonstration
      const dummyResults = [
        { id: '1', name: 'Love Story', artist: 'Taylor Swift', image: 'https://placehold.co/128x128/1DB954/FFFFFF?text=L.S' },
        { id: '2', name: 'Shape of You', artist: 'Ed Sheeran', image: 'https://placehold.co/128x128/1DB954/FFFFFF?text=S.Y' },
        { id: '3', name: 'Blinding Lights', artist: 'The Weeknd', image: 'https://placehold.co/128x128/1DB954/FFFFFF?text=B.L' },
      ];

      // Navigate to the new results screen with the data
      navigation.navigate('SearchResults', { results: dummyResults, query: searchQuery });
    } catch (error) {
      console.error('Failed to fetch search results:', error);
      // You could also navigate to an error page or show an alert here
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={primaryColor} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Feather name="search" size={20} color={secondaryColor} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search songs, albums, and artists..."
            placeholderTextColor={secondaryColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={20} color={secondaryColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderTitle}>Start searching</Text>
          <Text style={styles.placeholderText}>
            Find your favorite songs, albums, and artists.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: primaryBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: secondaryBg,
  },
  backButton: {
    marginRight: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tertiaryBg,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    height: 40,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: secondaryColor,
    textAlign: 'center',
  },
});

export default VegaMusicSearchScreen;