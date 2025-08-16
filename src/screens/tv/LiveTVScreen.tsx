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
  Alert,
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
      currentChannel.groupTitle =
        groupTitleMatch && groupTitleMatch[1]
          ? groupTitleMatch[1]
          : 'Uncategorized';
      currentChannel.country =
        countryMatch && countryMatch[1] ? countryMatch[1] : 'Unknown';
    } else if (line.startsWith('http')) {
      if (currentChannel.name) {
        currentChannel.streamUrl = line.trim();
        // Use the stream URL as the unique ID to prevent key duplication warnings
        currentChannel.id = currentChannel.streamUrl;
        channels.push(currentChannel as TVChannel);
        currentChannel = {};
      }
    }
  }
  return channels;
};

// New function to parse JSON data from the API endpoint
const parseJsonChannels = (jsonContent: any): TVChannel[] => {
  if (Array.isArray(jsonContent)) {
    return jsonContent.map((item: any) => ({
      id: item.stream_url || item.channel_name,
      name: item.channel_name || 'Unknown Channel',
      logo: item.logo_url || 'https://via.placeholder.com/150',
      streamUrl: item.stream_url,
      groupTitle: item.group || 'Uncategorized',
      country: 'India', // Set country to 'India' as requested
    }));
  }
  return [];
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
  const [heroChannel, setHeroChannel] = useState<TVChannel | null>(null);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        setLoading(true);

        // List of M3U playlist and JSON API sources
        const sources = [
          'https://iptv-org.github.io/iptv/index.country.m3u',
          'https://iptv-org.github.io/iptv/index.m3u',
          'https://iptv-org.github.io/iptv/categories/movies.m3u',
          'https://iptv-org.github.io/iptv/categories/news.m3u',
          'https://iptv-org.github.io/iptv/categories/sports.m3u',
        ];
        const jsonSource = 'https://18plus-brown.vercel.app/api/livetv';

        const m3uPromises = sources.map(url => fetch(url));
        const jsonPromise = fetch(jsonSource);

        const [m3uResponses, jsonResponse] = await Promise.all([
          Promise.allSettled(m3uPromises),
          jsonPromise,
        ]);

        let allChannels: TVChannel[] = [];
        const uniqueChannelUrls = new Set<string>();

        // Process M3U responses
        for (const response of m3uResponses) {
          if (response.status === 'fulfilled' && response.value.ok) {
            const m3uContent = await response.value.text();
            const parsedChannels = parseM3U(m3uContent);
            for (const channel of parsedChannels) {
              if (!uniqueChannelUrls.has(channel.streamUrl)) {
                uniqueChannelUrls.add(channel.streamUrl);
                allChannels.push(channel);
              }
            }
          } else if (response.status === 'rejected') {
            console.error('Failed to fetch M3U source:', response.reason);
          } else {
            console.error('Failed to fetch M3U source:', response.value.status);
          }
        }

        // Process JSON response
        if (jsonResponse.ok) {
          const jsonContent = await jsonResponse.json();
          const parsedChannels = parseJsonChannels(jsonContent);
          for (const channel of parsedChannels) {
            if (!uniqueChannelUrls.has(channel.streamUrl)) {
              uniqueChannelUrls.add(channel.streamUrl);
              allChannels.push(channel);
            }
          }
        } else {
          console.error('Failed to fetch JSON source:', jsonResponse.status);
        }

        setChannels(allChannels);
      } catch (error) {
        console.error('Failed to fetch or parse channels:', error);
        Alert.alert(
          'Error',
          'Failed to load channels. Please try again later.',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  useEffect(() => {
    if (channels.length > 0) {
      const topChannel = channels[Math.floor(Math.random() * channels.length)];
      setHeroChannel(topChannel);
    } else {
      setHeroChannel(null);
    }
  }, [channels]);

  const allGenres = useMemo(() => {
    const genres = channels.map(channel => channel.groupTitle).filter(Boolean);
    return [...Array.from(new Set(genres as string[]))].sort();
  }, [channels]);

  const allCountries = useMemo(() => {
    const countries = channels.map(channel => channel.country).filter(Boolean);
    return [...Array.from(new Set(countries as string[]))].sort();
  }, [channels]);

  const filteredChannels = useMemo(() => {
    const filtered = channels.filter(channel => {
      const matchesSearchText = channel.name
        .toLowerCase()
        .includes(searchText.toLowerCase());
      const matchesGenre =
        !selectedGenre || channel.groupTitle === selectedGenre;
      const matchesCountry =
        !selectedCountry || channel.country === selectedCountry;

      return matchesSearchText && matchesGenre && matchesCountry;
    });

    return filtered.filter(ch => ch.id !== heroChannel?.id);
  }, [channels, searchText, selectedGenre, selectedCountry, heroChannel]);

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

  const handleClearFilters = useCallback(() => {
    setSelectedCountry('');
    setSelectedGenre('');
    setSearchText('');
  }, []);

  const handleSettings = useCallback(() => {
    navigation.navigate('VegaTVSettingsScreen');
  }, [navigation]);

  const handleHeroChannelPress = useCallback(() => {
    if (heroChannel) {
      navigation.navigate('TVPlayerScreen', {
        streamUrl: heroChannel.streamUrl,
      });
    }
  }, [navigation, heroChannel]);

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
            {filteredCountries.length > 0 ? (
              <FlatList
                data={filteredCountries}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={[
                      styles.filterListItem,
                      tempFilters.country === item && {
                        backgroundColor: primary,
                      },
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
            ) : (
              <Text style={styles.noFiltersText}>
                No countries available to filter.
              </Text>
            )}
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
            {filteredGenres.length > 0 ? (
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
            ) : (
              <Text style={styles.noFiltersText}>
                No genres available to filter.
              </Text>
            )}
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

          {heroChannel && (
            <TouchableOpacity
              onPress={handleHeroChannelPress}
              style={styles.heroContainer}>
              <Image
                source={{uri: heroChannel.logo}}
                style={styles.heroLogo}
                resizeMode="cover"
              />
              <Text style={styles.heroChannelName} numberOfLines={1}>
                {heroChannel.name}
              </Text>
              <View style={styles.heroLiveBadge}>
                <Text style={styles.heroLiveBadgeText}>LIVE</Text>
              </View>
            </TouchableOpacity>
          )}

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
                setCountrySearchText(selectedCountry);
                setGenreSearchText(selectedGenre);
                setTempFilters({
                  country: selectedCountry,
                  genre: selectedGenre,
                });
                setShowFilterModal(true);
              }}>
              <MaterialCommunityIcons
                name="filter-variant"
                size={24}
                color="white"
              />
            </TouchableOpacity>
            {selectedCountry || selectedGenre || searchText ? (
              <TouchableOpacity
                onPress={handleClearFilters}
                style={styles.clearFilterButton}>
                <MaterialCommunityIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            ) : null}
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
                  style={styles.channelItem}>
                  <Image source={{uri: item.logo}} style={styles.channelLogo} />
                  <Text style={styles.channelName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.country && item.country !== 'Unknown' && (
                    <Text style={styles.channelCountry}>{item.country}</Text>
                  )}
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
  clearFilterButton: {
    padding: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    marginLeft: 5,
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
    borderColor: 'transparent',
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
  channelCountry: {
    color: '#A9A9A9',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  // Hero Section Styles
  heroContainer: {
    height: 180,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 20,
    marginHorizontal: 10,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  heroLogo: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  heroChannelName: {
    position: 'absolute',
    bottom: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  heroLiveBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'red',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  heroLiveBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
  noFiltersText: {
    color: '#A9A9A9',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
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
