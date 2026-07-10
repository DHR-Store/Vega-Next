import {View, Text, FlatList, TextInput, TouchableOpacity} from 'react-native';
import React, {useState, useEffect, useCallback} from 'react';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SearchStackParamList} from '../App';
import {MaterialIcons, Ionicons, Feather} from '@expo/vector-icons';
import useThemeStore from '../lib/zustand/themeStore';
import {MMKV} from '../lib/Mmkv';
import {SafeAreaView} from 'react-native-safe-area-context';
import debounce from 'lodash/debounce';
import {searchOMDB} from '../lib/services/omdb';
import {OMDBResult} from '../types/omdb';
import HeroSuggestionSlider from '../components/HerosuggestionSlider';

const MAX_VISIBLE_RESULTS = 15;
const MAX_HISTORY_ITEMS = 30;

// Hardcoded list of genres with icons
const GENRES = [
  {id: '1', name: 'Action', icon: 'flash-outline'},
  {id: '2', name: 'Comedy', icon: 'happy-outline'},
  {id: '3', name: 'Sci-Fi', icon: 'planet-outline'},
  {id: '4', name: 'Fantasy', icon: 'sparkles-outline'},
  {id: '5', name: 'Horror', icon: 'skull-outline'},
  {id: '6', name: 'Romance', icon: 'heart-outline'},
  {id: '7', name: 'Drama', icon: 'theater-outline'},
  {id: '8', name: 'Thriller', icon: 'eye-outline'},
  {id: '9', name: 'Animation', icon: 'film-outline'},
  {id: '10', name: 'Adventure', icon: 'compass-outline'},
];

// Define a type for IMDB search results from the suggestion API
interface IMDBResult {
  id: string;
  l: string; // title
  s?: string; // actors
  y?: number; // year
  i?: {
    height: number;
    width: number;
    imageUrl: string;
  };
  q?: string; // query type, e.g., 'feature', 'tv_series'
}

// Hardcoded movie suggestions for specific genres
const GENRE_MOVIES: Record<string, any[]> = {
  'sci-fi': [
    {
      Title: 'Avengers: Endgame',
      Year: '2019',
      imdbID: 'tt4154796',
      Type: 'movie',
    },
    {Title: 'Loki', Year: '2021–', imdbID: 'tt9208882', Type: 'series'},
    {
      Title: 'Terminator 2: Judgment Day',
      Year: '1991',
      imdbID: 'tt0103064',
      Type: 'movie',
    },
    {Title: 'The Matrix', Year: '1999', imdbID: 'tt0133093', Type: 'movie'},
  ],
  action: [
    {Title: 'Die Hard', Year: '1988', imdbID: 'tt0095016', Type: 'movie'},
    {
      Title: 'Mad Max: Fury Road',
      Year: '2015',
      imdbID: 'tt1392190',
      Type: 'movie',
    },
    {
      Title: 'The Dark Knight',
      Year: '2008',
      imdbID: 'tt0468569',
      Type: 'movie',
    },
    {
      Title: 'John Wick: Chapter 4',
      Year: '2023',
      imdbID: 'tt10366206',
      Type: 'movie',
    },
  ],
  comedy: [
    {
      Title: 'Dumb and Dumber',
      Year: '1994',
      imdbID: 'tt0109686',
      Type: 'movie',
    },
    {Title: 'Superbad', Year: '2007', imdbID: 'tt0829482', Type: 'movie'},
    {
      Title: 'The Office',
      Year: '2005–2013',
      imdbID: 'tt0386676',
      Type: 'series',
    },
  ],
  horror: [
    {Title: 'The Conjuring', Year: '2013', imdbID: 'tt1457767', Type: 'movie'},
    {Title: 'Hereditary', Year: '2018', imdbID: 'tt7784604', Type: 'movie'},
  ],
};

// Helper components converted to standard Views for performance
const RenderHeader = ({title}: {title: string; index: number}) => (
  <View className="mt-4 mb-2 px-4">
    <Text className="text-white/90 text-base font-semibold">{title}</Text>
  </View>
);

const RenderGenreItem = ({item, primary, handleSearch}: any) => (
  <View>
    <View className="px-4">
      <TouchableOpacity
        className="py-3 border-b border-white/10"
        onPress={() => handleSearch(item.name)}>
        <View className="flex-row items-center">
          <Ionicons
            name={item.icon}
            size={20}
            color={primary}
            style={{marginRight: 12}}
          />
          <Text className="text-white text-base">{item.name}</Text>
        </View>
      </TouchableOpacity>
    </View>
  </View>
);

const RenderMovieItem = ({item, primary, handleSearch}: any) => (
  <View>
    <View className="px-4">
      <TouchableOpacity
        className="py-3 border-b border-white/10"
        onPress={() => handleSearch(item.Title || item.l)}>
        <View className="flex-row items-center">
          <Ionicons
            name={item.type === 'genre-movie' ? 'star-outline' : 'film-outline'}
            size={20}
            color={primary}
            style={{marginRight: 12}}
          />
          <View>
            <Text className="text-white text-base">{item.Title || item.l}</Text>
            <Text className="text-white/50 text-xs">
              {((item.Type || item.q) === 'series' || item.q === 'tv_series'
                ? 'TV Show'
                : 'Movie') +
                ' • ' +
                (item.Year || item.y)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  </View>
);

const Search = () => {
  const {primary} = useThemeStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const [searchText, setSearchText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(
    MMKV.getArray<string>('searchHistory') || [],
  );

  const [genreSuggestions, setGenreSuggestions] = useState<typeof GENRES>([]);
  const [imdbSuggestions, setImdbSuggestions] = useState<IMDBResult[]>([]);
  const [omdbResults, setOmdbResults] = useState<OMDBResult[]>([]);
  const [genreMovieSuggestions, setGenreMovieSuggestions] = useState<
    OMDBResult[]
  >([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const saveSearchToHistory = (searchTerm: string) => {
    if (searchTerm.trim()) {
      const prevSearches = MMKV.getArray<string>('searchHistory') || [];
      if (!prevSearches.includes(searchTerm.trim())) {
        const newSearches = [searchTerm.trim(), ...prevSearches].slice(
          0,
          MAX_HISTORY_ITEMS,
        );
        MMKV.setArray('searchHistory', newSearches);
        setSearchHistory(newSearches);
      }
    }
  };

  const searchIMDB = async (text: string): Promise<IMDBResult[]> => {
    if (!text) {
      return [];
    }
    const firstLetter = text[0].toLowerCase();
    const url = `https://v2.sg.media-imdb.com/suggestion/${firstLetter}/${encodeURIComponent(
      text,
    )}.json`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.d) {
        return data.d.slice(0, MAX_VISIBLE_RESULTS);
      }
    } catch (error) {
      console.error('Failed to fetch IMDB suggestions:', error);
      setError('Failed to fetch suggestions. Please try again later.');
    }
    return [];
  };

  const debouncedSearch = useCallback(
    debounce(async (text: string) => {
      setIsLoading(true);
      setError('');
      setOmdbResults([]);
      setImdbSuggestions([]);
      setGenreSuggestions([]);
      setGenreMovieSuggestions([]);

      try {
        if (text.length >= 2) {
          const filteredGenres = GENRES.filter(genre =>
            genre.name.toLowerCase().includes(text.toLowerCase()),
          );
          setGenreSuggestions(filteredGenres);

          const moviesForMatchedGenres = filteredGenres.flatMap(
            genre => GENRE_MOVIES[genre.name.toLowerCase()] || [],
          );
          setGenreMovieSuggestions(moviesForMatchedGenres);

          const omdbResults = await searchOMDB(text);

          if (omdbResults && Array.isArray(omdbResults)) {
            const uniqueOmdbResults = omdbResults.reduce((acc, current) => {
              const x = acc.find(
                (item: OMDBResult) => item.imdbID === current.imdbID,
              );
              if (!x) {
                return acc.concat([current]);
              } else {
                return acc;
              }
            }, [] as OMDBResult[]);
            setOmdbResults(uniqueOmdbResults.slice(0, MAX_VISIBLE_RESULTS));
          } else {
            setOmdbResults([]);
          }

          const imdbResults = await searchIMDB(text);
          setImdbSuggestions(imdbResults);
        }
      } catch (e) {
        console.error('Search failed:', e);
        setError('An error occurred during the search. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [],
  );

  useEffect(() => {
    debouncedSearch(searchText);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchText, debouncedSearch]);

  const handleSearch = (text: string) => {
    saveSearchToHistory(text);
    navigation.navigate('SearchResults', {
      filter: text.trim(),
    });
  };

  const removeHistoryItem = (search: string) => {
    const newSearches = searchHistory.filter(item => item !== search);
    MMKV.setArray('searchHistory', newSearches);
    setSearchHistory(newSearches);
  };

  const clearHistory = () => {
    MMKV.setArray('searchHistory', []);
    setSearchHistory([]);
  };

  const isSearching = searchText.length > 0;
  const hasSuggestions =
    genreSuggestions.length > 0 ||
    imdbSuggestions.length > 0 ||
    omdbResults.length > 0 ||
    genreMovieSuggestions.length > 0;
  const showResultsAndSuggestions = isSearching && hasSuggestions;
  const showHistory = !isSearching && searchHistory.length > 0;

  const combinedData = [
    ...(genreSuggestions.length > 0
      ? [{id: 'genre-header', type: 'header', title: 'Genres'}]
      : []),
    ...genreSuggestions.map(item => ({...item, type: 'genre'})),
    ...(genreMovieSuggestions.length > 0
      ? [
          {
            id: 'genre-movie-header',
            type: 'header',
            title: 'Top Rated in Genre',
          },
        ]
      : []),
    ...genreMovieSuggestions.map(item => ({...item, type: 'genre-movie'})),
    ...(imdbSuggestions.length > 0
      ? [{id: 'imdb-header', type: 'header', title: 'Suggestions (IMDb)'}]
      : []),
    ...imdbSuggestions.map(item => ({...item, type: 'imdb'})),
    ...(omdbResults.length > 0
      ? [{id: 'omdb-header', type: 'header', title: 'Search Results (OMDB)'}]
      : []),
    ...omdbResults.map(item => ({...item, type: 'omdb'})),
  ];

  const renderItem = ({item, index}: {item: any; index: number}) => {
    if (item.type === 'header') {
      return <RenderHeader title={item.title} index={index} />;
    }
    if (item.type === 'genre') {
      return (
        <RenderGenreItem
          item={item}
          index={index}
          primary={primary}
          handleSearch={handleSearch}
        />
      );
    }
    if (
      item.type === 'genre-movie' ||
      item.type === 'omdb' ||
      item.type === 'imdb'
    ) {
      return (
        <RenderMovieItem
          item={item}
          index={index}
          primary={primary}
          handleSearch={handleSearch}
        />
      );
    }
    return null;
  };

  let contentToRender;

  if (isLoading) {
    contentToRender = (
      <View className="flex-1 items-center justify-center">
        <Text className="text-white/70 text-base">Searching...</Text>
      </View>
    );
  } else if (error) {
    contentToRender = (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-red-500 text-base text-center">{error}</Text>
      </View>
    );
  } else if (showResultsAndSuggestions) {
    contentToRender = (
      <FlatList
        data={combinedData}
        keyExtractor={(item, index) =>
          `${item.type}-${item.id || item.imdbID || item.l}-${index}`
        }
        renderItem={renderItem}
        contentContainerStyle={{paddingTop: 4}}
        showsVerticalScrollIndicator={false}
        // Optimization props for FlatList on Android
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
      />
    );
  } else if (showHistory) {
    contentToRender = (
      <View className="px-4 flex-1">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-white/90 text-base font-semibold">
            Recent Searches
          </Text>
          <TouchableOpacity
            onPress={clearHistory}
            className="bg-red-500/10 rounded-full px-2 py-0.5">
            <Text className="text-red-500 text-xs">Clear All</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={searchHistory}
          keyExtractor={(item, index) => `history-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 20}}
          renderItem={({item: search}) => (
            <View className="bg-[#141414] rounded-lg p-3 mb-2 flex-row justify-between items-center border border-white/5">
              <TouchableOpacity
                onPress={() => handleSearch(search)}
                className="flex-row flex-1 items-center space-x-2">
                <View className="bg-white/10 rounded-full p-1.5">
                  <Ionicons name="time-outline" size={16} color={primary} />
                </View>
                <Text className="text-white text-sm ml-2">{search}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeHistoryItem(search)}
                className="bg-white/5 rounded-full p-1.5">
                <Feather name="x" size={14} color="#999" />
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    );
  } else {
    // Empty State
    contentToRender = (
      <View className="items-center justify-center flex-1">
        <View className="bg-white/5 rounded-full p-6 mb-4">
          <Ionicons name="search" size={32} color={primary} />
        </View>
        <Text className="text-white/70 text-base text-center">Search...</Text>
        <Text className="text-white/40 text-sm text-center mt-1">
          Your recent searches will appear here
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Top auto-sliding AI hero banner — built from watch history, watchlist
          and search history. Hidden (but kept mounted, so it doesn't refetch)
          while the user is actively searching. */}
      <View style={{display: isSearching ? 'none' : 'flex'}}>
        <HeroSuggestionSlider onSelectTitle={handleSearch} />
      </View>
      {/* Title Section */}
      <View className="px-4 pt-4">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-white text-xl font-bold">Search</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Suggestion')}
            className="bg-white/5 rounded-full p-2 border border-white/10">
            <Ionicons name="sparkles-outline" size={20} color={primary} />
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center space-x-3 mb-2">
          <View className="flex-1">
            <View className="overflow-hidden rounded-xl bg-[#141414] shadow-lg shadow-black/50">
              <View className="px-3 py-3">
                <View className="flex-row items-center">
                  <MaterialIcons
                    name="search"
                    size={24}
                    color={isFocused ? primary : '#666'}
                  />
                  <TextInput
                    className="flex-1 text-white text-base ml-3"
                    placeholder="Search anime, movies, series..."
                    placeholderTextColor="#666"
                    value={searchText}
                    onChangeText={setSearchText}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onSubmitEditing={e => handleSearch(e.nativeEvent.text)}
                    returnKeyType="search"
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchText('')}
                      className="bg-gray-800/50 rounded-full p-2">
                      <Feather name="x" size={18} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
      {/* Search Results and Suggestions */}
      <View className="flex-1">{contentToRender}</View>
    </SafeAreaView>
  );
};

export default Search;
