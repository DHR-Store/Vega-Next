import {Image, Pressable, Text, TouchableOpacity, View} from 'react-native';
import React, {memo, useCallback} from 'react';
import type {Post} from '../lib/providers/types';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {HomeStackParamList} from '../App';
import useContentStore from '../lib/zustand/contentStore';
import {FlashList} from '@shopify/flash-list';
import SkeletonLoader from './Skeleton';
import useThemeStore from '../lib/zustand/themeStore';

// 1. Memoize list items
const SliderItem = memo(
  ({
    item,
    onPress,
    onLongPress,
  }: {
    item: Post;
    onPress: (item: Post) => void;
    onLongPress: (item: Post) => void;
  }) => {
    return (
      <View className="flex flex-col mx-2">
        <TouchableOpacity
          onLongPress={e => {
            e.stopPropagation();
            onLongPress(item);
          }}
          onPress={e => {
            e.stopPropagation();
            onPress(item);
          }}>
          <Image
            className="rounded-md bg-zinc-800"
            source={{
              uri:
                item?.image ||
                'https://placehold.jp/24/363636/ffffff/100x150.png?text=vega',
            }}
            style={{width: 100, height: 150}}
          />
        </TouchableOpacity>
        <Text className="text-white text-center truncate w-24 text-xs mt-1">
          {item.title.length > 24
            ? `${item.title.slice(0, 24)}...`
            : item.title}
        </Text>
      </View>
    );
  },
);

export default function Slider({
  isLoading,
  title,
  posts,
  filter,
  providerValue,
  isSearch = false,
}: {
  isLoading: boolean;
  title: string;
  posts: Post[];
  filter: string;
  providerValue?: string;
  isSearch?: boolean;
}): JSX.Element {
  const {provider} = useContentStore(state => state);
  const {primary} = useThemeStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [isSelected, setSelected] = React.useState('');

  const handlePressMore = useCallback(() => {
    navigation.navigate('ScrollList', {
      title: title,
      filter: filter,
      providerValue: providerValue,
      isSearch: isSearch,
    });
  }, [navigation, title, filter, providerValue, isSearch]);

  const handleItemPress = useCallback(
    (item: Post) => {
      setSelected('');
      navigation.navigate('Info', {
        link: item.link,
        provider: item.provider || providerValue || provider?.value,
        poster: item?.image,
      });
    },
    [navigation, providerValue, provider?.value],
  );

  const handleItemLongPress = useCallback((item: Post) => {
    // Add logic here if you un-comment the long press actions later
  }, []);

  const renderItem = useCallback(
    ({item}: {item: Post}) => (
      <SliderItem
        item={item}
        onPress={handleItemPress}
        onLongPress={handleItemLongPress}
      />
    ),
    [handleItemPress, handleItemLongPress],
  );

  return (
    <Pressable onPress={() => setSelected('')} className="gap-3 mt-3 px-2">
      <View className="flex flex-row items-center justify-between">
        <Text className="text-2xl font-semibold" style={{color: primary}}>
          {title}
        </Text>
        {filter !== 'recent' && (
          <TouchableOpacity onPress={handlePressMore}>
            <Text className="text-white text-sm">more</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View className="flex flex-row gap-2 overflow-hidden">
          {Array.from({length: 10}).map((_, index) => (
            <View
              className="mx-3 gap-0 flex mb-3 justify-center items-center"
              key={index}>
              <SkeletonLoader height={150} width={100} />
              <SkeletonLoader height={12} width={97} />
            </View>
          ))}
        </View>
      ) : (
        <FlashList
          // 2. FIXED: Width of item (100) + horizontal margins (~16) = 116.
          // This drastically improves horizontal layout computation and stops jitter.
          estimatedItemSize={116}
          showsHorizontalScrollIndicator={false}
          data={posts}
          extraData={isSelected}
          horizontal
          contentContainerStyle={{paddingHorizontal: 3, paddingTop: 7}}
          renderItem={renderItem}
          ListFooterComponent={
            !isLoading && posts.length === 0 ? (
              <View className="flex flex-row w-96 justify-center h-10 items-center">
                <Text className="text-gray-400 text-center">
                  No content found
                </Text>
              </View>
            ) : null
          }
          keyExtractor={item => item.link}
        />
      )}
    </Pressable>
  );
}
