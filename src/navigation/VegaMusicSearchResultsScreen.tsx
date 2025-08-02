import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

// Custom colors to match the app theme
const primaryColor = '#00c3ff';
const secondaryColor = '#b3b3b3';
const primaryBg = '#121212';
const secondaryBg = '#1e1e1e';
const tertiaryBg = '#282828';

/**
 * A component to display the search results from the Vega Music Search Screen.
 * It receives the results and the search query via navigation parameters.
 */
const VegaMusicSearchResultsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { results, query } = route.params;

  const renderSearchResultItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity style={styles.resultItem}>
      <Image
        source={{ uri: item.image }}
        style={styles.resultImage}
      />
      <View style={styles.resultTextContainer}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resultSubtitle} numberOfLines={1}>{item.artist}</Text>
      </View>
      <Feather name="chevron-right" size={24} color={secondaryColor} />
    </TouchableOpacity>
  ), []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search results for "{query}"</Text>
      </View>
      <View style={styles.content}>
        {results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            renderItem={renderSearchResultItem}
            contentContainerStyle={styles.resultsList}
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderTitle}>No results found</Text>
            <Text style={styles.placeholderText}>
              Try searching for a different song, album, or artist.
            </Text>
          </View>
        )}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  placeholderContainer: {
    flex: 1,
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
  resultsList: {
    paddingBottom: 20,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: secondaryBg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  resultImage: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginRight: 10,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  resultSubtitle: {
    color: secondaryColor,
    fontSize: 14,
  },
});

export default VegaMusicSearchResultsScreen;