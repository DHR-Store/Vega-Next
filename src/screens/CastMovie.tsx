import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {MaterialCommunityIcons, Ionicons} from '@expo/vector-icons';
import LinearGradient from 'react-native-linear-gradient';
import useThemeStore from '../lib/zustand/themeStore';

const TMDB_API_KEY = '9d2bff12ed955c7f1f74b83187f188ae';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

interface CastDetails {
  name: string;
  biography: string;
  profile_path: string;
  birthday: string;
  place_of_birth: string;
  known_for_department: string;
}

interface MovieCredit {
  id: number;
  title?: string;
  name?: string; // TV shows use name instead of title
  poster_path: string;
  character: string;
  media_type: string;
  popularity: number;
}

export default function CastMovie() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const {castId, castName} = route.params;
  const {primary} = useThemeStore(state => state);

  const [details, setDetails] = useState<CastDetails | null>(null);
  const [movies, setMovies] = useState<MovieCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [readMoreBio, setReadMoreBio] = useState(false);

  useEffect(() => {
    const fetchCastData = async () => {
      try {
        // Fetch Actor Info
        const detailsRes = await fetch(
          `${TMDB_BASE_URL}/person/${castId}?api_key=${TMDB_API_KEY}`,
        );
        const detailsData = await detailsRes.json();
        setDetails(detailsData);

        // Fetch Actor Movies/TV Shows
        const creditsRes = await fetch(
          `${TMDB_BASE_URL}/person/${castId}/combined_credits?api_key=${TMDB_API_KEY}`,
        );
        const creditsData = await creditsRes.json();

        // Sort by popularity to show best movies first and filter out items without posters
        const sortedCredits = (creditsData.cast || [])
          .filter((item: MovieCredit) => item.poster_path)
          .sort(
            (a: MovieCredit, b: MovieCredit) => b.popularity - a.popularity,
          );

        setMovies(sortedCredits);
      } catch (error) {
        console.error('Failed to fetch cast details', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCastData();
  }, [castId]);

  const handleMoviePress = (movieTitle: string) => {
    if (!movieTitle) return;

    // @ts-ignore
    navigation.navigate('MainStack', {
      screen: 'SearchStack', // Note: If your Search tab is named differently (e.g., just 'Search'), change this to match.
      params: {
        screen: 'SearchResults',
        params: {filter: movieTitle},
      },
    });
  };

  if (loading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  }

  const renderHeader = () => (
    <View className="px-4 pt-4 pb-2">
      <View className="flex-row mt-6">
        {/* Profile Image */}
        <View className="w-32 h-48 rounded-xl bg-zinc-800 overflow-hidden shadow-lg border border-zinc-700">
          {details?.profile_path ? (
            <Image
              source={{uri: `${TMDB_IMAGE_BASE}${details.profile_path}`}}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="flex-1 justify-center items-center">
              <MaterialCommunityIcons name="account" size={60} color="gray" />
            </View>
          )}
        </View>

        {/* Info Block */}
        <View className="flex-1 ml-4 justify-center">
          <Text className="text-white text-2xl font-bold mb-1">
            {details?.name || castName}
          </Text>
          {details?.known_for_department && (
            <Text className="text-gray-400 text-sm font-semibold mb-2 bg-zinc-800 self-start px-2 py-1 rounded-md">
              {details.known_for_department}
            </Text>
          )}
          {details?.birthday && (
            <Text className="text-gray-300 text-xs mt-1">
              <Text className="font-bold text-white">Born: </Text>{' '}
              {details.birthday}
            </Text>
          )}
          {details?.place_of_birth && (
            <Text className="text-gray-300 text-xs mt-1" numberOfLines={2}>
              <Text className="font-bold text-white">From: </Text>{' '}
              {details.place_of_birth}
            </Text>
          )}
        </View>
      </View>

      {/* Biography */}
      {details?.biography ? (
        <View className="mt-6 mb-2">
          <Text className="text-white text-lg font-semibold mb-2">
            Biography
          </Text>
          <Text className="text-gray-300 text-sm leading-5">
            {readMoreBio || details.biography.length < 250
              ? details.biography
              : `${details.biography.slice(0, 250)}...`}
          </Text>
          {details.biography.length >= 250 && (
            <TouchableOpacity
              onPress={() => setReadMoreBio(!readMoreBio)}
              className="mt-2">
              <Text
                className="text-white font-bold text-xs"
                style={{color: primary}}>
                {readMoreBio ? 'Show Less' : 'Read More'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      <Text className="text-white text-lg font-semibold mt-4 mb-3">
        Known For
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* Custom Header */}
      <LinearGradient
        colors={['rgba(0,0,0,0.9)', 'transparent']}
        className="absolute top-0 w-full h-24 z-10 pt-10 px-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-black/50 justify-center items-center backdrop-blur-md">
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-4 shadow-lg">
          {castName}
        </Text>
      </LinearGradient>

      {/* Movies Grid */}
      <FlatList
        data={movies}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        numColumns={3}
        contentContainerStyle={{paddingTop: 90, paddingBottom: 20}}
        columnWrapperStyle={{
          justifyContent: 'space-between',
          paddingHorizontal: 12,
        }}
        ListHeaderComponent={renderHeader}
        renderItem={({item}) => (
          <TouchableOpacity
            className="w-[31%] mb-4"
            onPress={() => handleMoviePress(item.title || item.name || '')}
            activeOpacity={0.7}>
            <View className="w-full aspect-[2/3] rounded-lg bg-zinc-800 overflow-hidden mb-1 border border-zinc-800">
              <Image
                source={{uri: `${TMDB_IMAGE_BASE}${item.poster_path}`}}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
            <Text
              className="text-white text-[11px] font-bold mt-1"
              numberOfLines={1}>
              {item.title || item.name}
            </Text>
            {item.character ? (
              <Text className="text-gray-500 text-[9px]" numberOfLines={1}>
                as {item.character}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
