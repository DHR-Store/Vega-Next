import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, TouchableOpacity, StyleSheet} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SearchStackParamList} from './App';
import useThemeStore from '../lib/zustand/themeStore';
import {Ionicons} from '@expo/vector-icons';
import Animated, {FadeInDown, Layout} from 'react-native-reanimated';

// Define the genres you want to display
const genres = [
  'Action',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Romance',
  'Sci-Fi',
  'Thriller',
  'Adventure',
  'Animation',
  'Crime',
  'Documentary',
  'Family',
  'History',
  'Music',
  'Mystery',
  'Sport',
  'War',
  'Western',
];

type GenreListScreenProps = {
  navigation: NativeStackNavigationProp<SearchStackParamList, 'GenreList'>;
};

const GenreListScreen: React.FC<GenreListScreenProps> = ({navigation}) => {
  const {primary, text, secondary} = useThemeStore(state => state);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  // This useEffect will now navigate to the ScrollList screen whenever a genre is selected.
  useEffect(() => {
    if (selectedGenre) {
      console.log(`Navigating to list for genre: ${selectedGenre}`);
      // FIX: Uncomment and use the correct navigation call to the 'ScrollList' screen.
      // This will pass the selected genre to the ScrollList component.
      navigation.navigate('ScrollList', {
        genre: selectedGenre,
        title: selectedGenre,
      });
      // Reset the selected genre so the component can be used again.
      setSelectedGenre(null);
    }
  }, [selectedGenre, navigation]);

  return (
    <View style={[styles.container, {backgroundColor: 'black'}]}>
      <Animated.View
        entering={FadeInDown.duration(500)}
        style={[styles.header, {backgroundColor: 'black'}]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={text} />
        </TouchableOpacity>
        <Text style={[styles.title, {color: text}]}>Browse by Genre</Text>
      </Animated.View>
      <FlatList
        data={genres}
        keyExtractor={item => item}
        numColumns={3}
        contentContainerStyle={styles.listContainer}
        renderItem={({item}) => (
          <Animated.View
            layout={Layout}
            entering={FadeInDown.delay(genres.indexOf(item) * 50).duration(300)}
            style={styles.itemWrapper}>
            <TouchableOpacity
              style={[
                styles.genreCard,
                {backgroundColor: secondary, borderColor: primary},
                // FIX: Use the primary color from the theme for the selected card border.
                selectedGenre === item && {
                  ...styles.selectedGenreCard,
                  borderColor: primary,
                },
              ]}
              onPress={() => setSelectedGenre(item)}>
              <Text style={[styles.genreText, {color: text}]}>{item}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingHorizontal: 8,
  },
  itemWrapper: {
    flex: 1,
    padding: 8,
  },
  genreCard: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    borderWidth: 2,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  selectedGenreCard: {
    borderWidth: 3,
  },
  genreText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default GenreListScreen;
