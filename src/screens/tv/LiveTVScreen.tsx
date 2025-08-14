// File: src/screens/tv/LiveTVScreen.tsx

import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {VegaTVStackParamList} from '../../App';
import {useNavigation} from '@react-navigation/native';
import useThemeStore from '../../lib/zustand/themeStore';
import {MaterialCommunityIcons} from '@expo/vector-icons';

// Define the type for a single TV channel
interface TVChannel {
  id: string;
  name: string;
  logo: string;
  streamUrl: string;
  groupTitle?: string;
  country?: string;
}

// Helper function to parse M3U playlist content
const parseM3U = (m3uContent: string): TVChannel[] => {
  const channels: TVChannel[] = [];
  const lines = m3uContent.split('\n');

  let currentChannel: Partial<TVChannel> = {};

  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      const nameMatch = /,(.*)/.exec(line);
      const logoMatch = /tvg-logo="([^"]*)"/.exec(line);
      const idMatch = /tvg-id="([^"]*)"/.exec(line);
      const groupTitleMatch = /group-title="([^"]*)"/.exec(line);
      const countryMatch = /tvg-country="([^"]*)"/.exec(line);

      currentChannel.name = nameMatch ? nameMatch[1].trim() : 'Unknown Channel';
      currentChannel.logo = logoMatch
        ? logoMatch[1]
        : 'https://via.placeholder.com/150';
      currentChannel.id = idMatch ? idMatch[1] : `unknown-${channels.length}`;
      currentChannel.groupTitle = groupTitleMatch
        ? groupTitleMatch[1]
        : 'Uncategorized';
      currentChannel.country = countryMatch ? countryMatch[1] : 'Unknown';
    } else if (line.startsWith('http')) {
      if (currentChannel.id) {
        currentChannel.streamUrl = line.trim();
        channels.push(currentChannel as TVChannel);
        currentChannel = {};
      }
    }
  }
  return channels;
};

const LiveTVScreen: React.FC = () => {
  const {primary} = useThemeStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<VegaTVStackParamList>>();
  const [channels, setChannels] = useState<TVChannel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [countrySearchText, setCountrySearchText] = useState<string>('');
  const [genreSearchText, setGenreSearchText] = useState<string>('');
  const [tempFilters, setTempFilters] = useState<{
    country: string;
    genre: string;
  }>({country: '', genre: ''});

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          'https://iptv-org.github.io/iptv/index.m3u',
        );
        const m3uContent = await response.text();
        const parsedChannels = parseM3U(m3uContent);
        setChannels(parsedChannels);
      } catch (error) {
        console.error('Failed to fetch or parse channels:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  const allGenres = useMemo(() => {
    const genres = channels.map(channel => channel.groupTitle).filter(Boolean);
    return [...Array.from(new Set(genres as string[]))].sort();
  }, [channels]);

  const allCountries = useMemo(() => {
    const countries = channels.map(channel => channel.country).filter(Boolean);
    return [...Array.from(new Set(countries as string[]))].sort();
  }, [channels]);

  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      const matchesSearchText = channel.name
        .toLowerCase()
        .includes(searchText.toLowerCase());
      const matchesGenre =
        !selectedGenre || channel.groupTitle === selectedGenre;
      const matchesCountry =
        !selectedCountry || channel.country === selectedCountry;

      return matchesSearchText && matchesGenre && matchesCountry;
    });
  }, [channels, searchText, selectedGenre, selectedCountry]);

  const filteredCountries = useMemo(() => {
    return allCountries.filter(country =>
      country.toLowerCase().includes(countrySearchText.toLowerCase()),
    );
  }, [allCountries, countrySearchText]);

  const filteredGenres = useMemo(() => {
    return allGenres.filter(genre =>
      genre.toLowerCase().includes(genreSearchText.toLowerCase()),
    );
  }, [allGenres, genreSearchText]);

  const handleApplyFilters = useCallback(() => {
    setSelectedCountry(tempFilters.country);
    setSelectedGenre(tempFilters.genre);
    setShowFilterModal(false);
  }, [tempFilters]);

  const handleClearModalFilters = useCallback(() => {
    setTempFilters({country: '', genre: ''});
    setCountrySearchText('');
    setGenreSearchText('');
  }, []);

  const handleSettings = useCallback(() => {
    navigation.navigate('VegaTVSettingsScreen');
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showFilterModal ? (
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Channels</Text>
            <TouchableOpacity onPress={handleClearModalFilters}>
              <Text style={styles.clearAllButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Choose Country:</Text>
            <TextInput
              style={styles.filterSearchBar}
              placeholder="Search countries..."
              placeholderTextColor="#A9A9A9"
              value={countrySearchText}
              onChangeText={setCountrySearchText}
            />
            <FlatList
              data={filteredCountries}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[
                    styles.filterListItem,
                    tempFilters.country === item && {backgroundColor: primary},
                  ]}
                  onPress={() =>
                    setTempFilters(prev => ({...prev, country: item}))
                  }>
                  <Text style={styles.filterListItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item}
              style={styles.filterList}
            />
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Choose Genre:</Text>
            <TextInput
              style={styles.filterSearchBar}
              placeholder="Search genres..."
              placeholderTextColor="#A9A9A9"
              value={genreSearchText}
              onChangeText={setGenreSearchText}
            />
            <FlatList
              data={filteredGenres}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[
                    styles.filterListItem,
                    tempFilters.genre === item && {backgroundColor: primary},
                  ]}
                  onPress={() =>
                    setTempFilters(prev => ({...prev, genre: item}))
                  }>
                  <Text style={styles.filterListItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item}
              style={styles.filterList}
            />
          </View>

          <TouchableOpacity
            style={[styles.doneButton, {backgroundColor: primary}]}
            onPress={handleApplyFilters}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.headerContainer}>
            <Text style={styles.header}>Live TV Channels</Text>
            <TouchableOpacity
              onPress={handleSettings}
              style={styles.settingsIcon}>
              <MaterialCommunityIcons name="cog" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchFilterContainer}>
            <TextInput
              style={styles.searchBar}
              placeholder="Search channels..."
              placeholderTextColor="#A9A9A9"
              value={searchText}
              onChangeText={setSearchText}
            />
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => {
                setCountrySearchText('');
                setGenreSearchText('');
                setTempFilters({
                  country: selectedCountry,
                  genre: selectedGenre,
                });
                setShowFilterModal(true);
              }}>
              <MaterialCommunityIcons
                name="dots-vertical"
                size={24}
                color="white"
              />
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredChannels}
            renderItem={({item}) => {
              return (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('TVPlayerScreen', {
                      streamUrl: item.streamUrl,
                    })
                  }
                  style={[
                    styles.channelItem,
                    {
                      borderColor:
                        navigation.isFocused() &&
                        navigation.getState().routes[
                          navigation.getState().routes.length - 1
                        ].name === 'TVPlayerScreen'
                          ? 'transparent'
                          : 'transparent',
                    },
                  ]}>
                  <Image source={{uri: item.logo}} style={styles.channelLogo} />
                  <Text style={styles.channelName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
            keyExtractor={item => item.id}
            numColumns={3}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    padding: 10,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
    paddingHorizontal: 10,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    flex: 1,
  },
  settingsIcon: {
    position: 'absolute',
    right: 10,
    top: 5,
  },
  searchFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  searchBar: {
    flex: 1,
    height: 40,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    color: 'white',
    paddingHorizontal: 15,
    marginRight: 10,
  },
  filterButton: {
    padding: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  channelItem: {
    flex: 1,
    margin: 5,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
  },
  channelLogo: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginBottom: 5,
  },
  channelName: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Modal-specific styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'black',
    padding: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
    paddingHorizontal: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  clearAllButtonText: {
    color: 'white',
    fontSize: 16,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 10,
    marginLeft: 10,
  },
  filterSearchBar: {
    height: 40,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    color: 'white',
    paddingHorizontal: 15,
    marginHorizontal: 10,
  },
  filterList: {
    maxHeight: Dimensions.get('window').height / 3.5,
    marginTop: 10,
  },
  filterListItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginHorizontal: 10,
    marginBottom: 5,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
  },
  filterListItemText: {
    color: 'white',
    fontSize: 16,
  },
  doneButton: {
    alignSelf: 'center',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 50,
    width: '95%',
    position: 'absolute',
    bottom: 20,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default LiveTVScreen;
