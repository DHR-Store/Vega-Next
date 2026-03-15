import React, {useState, useEffect} from 'react';
import {View, Text, Image, FlatList, TouchableOpacity} from 'react-native';
import {Skeleton} from 'moti/skeleton';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';

const TMDB_API_KEY = '9d2bff12ed955c7f1f74b83187f188ae';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185';

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface CastInfoProps {
  title: string;
  type?: string;
  year?: string;
  imdbId?: string;
  fallbackCast?: string[];
}

export default function CastInfo({
  title,
  type = 'movie',
  year,
  imdbId,
  fallbackCast,
}: CastInfoProps) {
  const [cast, setCast] = useState<CastMember[]>([]);
  const [loading, setLoading] = useState(true);

  // ADDED NAVIGATION HOOK
  const navigation = useNavigation<any>();

  useEffect(() => {
    let isMounted = true;

    const fetchCastInfo = async () => {
      if (!TMDB_API_KEY || !title) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const searchType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
        let tmdbId: number | null = null;

        if (imdbId) {
          try {
            const findRes = await fetch(
              `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`,
            );
            const findData = await findRes.json();
            const results =
              searchType === 'movie'
                ? findData.movie_results
                : findData.tv_results;
            if (results && results.length > 0) tmdbId = results[0].id;
          } catch (e) {
            console.warn('IMDB lookup failed in CastInfo');
          }
        }

        if (!tmdbId) {
          const query = encodeURIComponent(title);
          const yearParam = year
            ? searchType === 'movie'
              ? `&year=${year}`
              : `&first_air_date_year=${year}`
            : '';
          const searchRes = await fetch(
            `${TMDB_BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${query}${yearParam}`,
          );
          const searchData = await searchRes.json();
          if (searchData.results && searchData.results.length > 0)
            tmdbId = searchData.results[0].id;
        }

        if (!tmdbId && year) {
          const query = encodeURIComponent(title);
          const looseRes = await fetch(
            `${TMDB_BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${query}`,
          );
          const looseData = await looseRes.json();
          if (looseData.results && looseData.results.length > 0)
            tmdbId = looseData.results[0].id;
        }

        if (tmdbId) {
          const creditsRes = await fetch(
            `${TMDB_BASE_URL}/${searchType}/${tmdbId}/credits?api_key=${TMDB_API_KEY}`,
          );
          const creditsData = await creditsRes.json();

          if (isMounted && creditsData.cast) {
            setCast(creditsData.cast.slice(0, 15));
          }
        }
      } catch (error) {
        console.error('Error fetching cast:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCastInfo();

    return () => {
      isMounted = false;
    };
  }, [title, type, year, imdbId]);

  if (loading) {
    return (
      <View className="mb-4 mt-2">
        <Text className="text-white text-lg font-semibold mb-3">Cast</Text>
        <View className="flex-row gap-4">
          {[...Array(4)].map((_, i) => (
            <View key={i} className="items-center">
              <Skeleton
                colorMode="dark"
                width={75}
                height={75}
                radius="round"
              />
              <View className="mt-2">
                <Skeleton colorMode="dark" width={60} height={10} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (cast.length > 0) {
    return (
      <View className="mb-4 mt-2">
        <Text className="text-white text-lg font-semibold mb-3">Cast</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={cast}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{paddingRight: 20}}
          renderItem={({item}) => (
            <TouchableOpacity
              className="mr-4 w-[80px] items-center"
              // NAVIGATE TO CAST MOVIE SCREEN INSTEAD OF EXTERNAL LINK
              onPress={() =>
                navigation.navigate('CastMovie', {
                  castId: item.id,
                  castName: item.name,
                })
              }
              activeOpacity={0.7}>
              <View className="w-[75px] h-[75px] rounded-full bg-zinc-800 overflow-hidden mb-2 justify-center items-center border-[1.5px] border-zinc-700">
                {item.profile_path ? (
                  <Image
                    source={{uri: `${TMDB_IMAGE_BASE}${item.profile_path}`}}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="account"
                    size={35}
                    color="gray"
                  />
                )}
              </View>
              <Text
                className="text-white text-xs font-bold text-center"
                numberOfLines={1}>
                {item.name}
              </Text>
              <Text
                className="text-gray-400 text-[10px] text-center mt-0.5"
                numberOfLines={1}>
                {item.character}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  if (fallbackCast && fallbackCast.length > 0) {
    return (
      <View className="mb-4 mt-2 w-full flex-row items-start gap-2">
        <Text className="text-white text-lg font-semibold pt-[0.9px]">
          Cast
        </Text>
        <View className="flex-row gap-1 flex-wrap">
          {fallbackCast.map((actor: string, index: number) => (
            <Text
              key={actor}
              className={`text-xs bg-tertiary p-1 px-2 rounded-md ${
                index % 3 === 0
                  ? 'text-red-500'
                  : index % 3 === 1
                  ? 'text-blue-500'
                  : 'text-green-500'
              }`}>
              {actor}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  return null;
}
