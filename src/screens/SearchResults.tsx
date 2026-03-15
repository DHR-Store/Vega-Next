import {
  SafeAreaView,
  ActivityIndicator,
  Text,
  View,
  FlatList,
  ListRenderItem,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Slider from '../components/Slider';
import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SearchStackParamList} from '../App';
import useThemeStore from '../lib/zustand/themeStore';
import {providerManager} from '../lib/services/ProviderManager';
import useContentStore from '../lib/zustand/contentStore';

type Props = NativeStackScreenProps<SearchStackParamList, 'SearchResults'>;

interface SearchPageData {
  title: string;
  Posts: any[];
  filter: string;
  providerValue: string;
  uniqueId: string;
  name: string;
  category: string;
}

// --- COMPONENT: Type Filter Bar (Optimized) ---
const TypeFilter = React.memo(
  ({
    types,
    selectedType,
    onSelect,
    primary,
  }: {
    types: string[];
    selectedType: string;
    onSelect: (t: string) => void;
    primary: string;
  }) => {
    return (
      <View className="mb-2 h-10">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal: 16, gap: 8}}
          keyboardShouldPersistTaps="handled">
          {types.map(type => {
            const isSelected = selectedType === type;
            return (
              <TouchableOpacity
                key={type}
                onPress={() => onSelect(type)}
                className={`px-4 py-1.5 rounded-full border ${
                  isSelected
                    ? 'bg-primary border-primary'
                    : 'bg-gray-900 border-gray-700'
                }`}
                style={
                  isSelected
                    ? {backgroundColor: primary, borderColor: primary}
                    : {}
                }>
                <Text
                  className={`${
                    isSelected ? 'text-white font-semibold' : 'text-gray-400'
                  }`}>
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  },
);

// --- COMPONENT: Result Item (Strictly Memoized) ---
const SearchResultItem = React.memo(
  ({item, filter}: {item: SearchPageData; filter: string}) => {
    return (
      <View className="mb-4">
        <Slider
          isLoading={false}
          title={item.name}
          posts={item.Posts}
          filter={filter}
          providerValue={item.providerValue}
          isSearch={true}
        />
      </View>
    );
  },
  (prev, next) =>
    prev.item.uniqueId === next.item.uniqueId && prev.filter === next.filter,
);

// --- COMPONENT: Header ---
const SearchHeader = React.memo(
  ({
    filter,
    loadingCount,
    primary,
  }: {
    filter: string;
    loadingCount: number;
    primary: string;
  }) => (
    <View className="mt-14 px-4 flex flex-row justify-between items-center gap-x-3 mb-4">
      <View className="flex-1">
        <Text className="text-white text-2xl font-semibold" numberOfLines={1}>
          {loadingCount > 0 ? 'Searching' : 'Results for'}{' '}
          <Text style={{color: primary}}>"{filter}"</Text>
        </Text>
        {loadingCount > 0 && (
          <Text className="text-gray-400 text-xs mt-1">
            Waiting for {loadingCount} sources...
          </Text>
        )}
      </View>
      {loadingCount > 0 && <ActivityIndicator size="small" color={primary} />}
    </View>
  ),
);

const SearchResults = ({route}: Props): React.ReactElement => {
  const {primary} = useThemeStore(state => state);
  const {installedProviders} = useContentStore(state => state);
  const currentFilter = route.params.filter;

  // State
  const [searchData, setSearchData] = useState<SearchPageData[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [selectedType, setSelectedType] = useState('All');

  // Refs
  const isMounted = useRef(true);
  const queue = useRef<SearchPageData[]>([]);
  const hasLoadedFirstItem = useRef(false);

  // --- LOGIC 1: Categories ---
  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    installedProviders.forEach((p: any) => {
      const cat = p.category
        ? p.category.charAt(0).toUpperCase() + p.category.slice(1).toLowerCase()
        : 'Others';
      types.add(cat);
    });
    return ['All', ...Array.from(types).sort()];
  }, [installedProviders]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // --- LOGIC 2: Optimized Search Engine ---
  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    // Reset
    setSearchData([]);
    queue.current = [];
    hasLoadedFirstItem.current = false;
    setLoadingCount(installedProviders.length);

    // A. BATCH FLUSHER (UI Updater)
    // Updates UI every 200ms (faster than 500ms) to feel snappier
    const batchInterval = setInterval(() => {
      if (queue.current.length > 0) {
        const batch = [...queue.current];
        queue.current = [];
        setSearchData(prev => [...prev, ...batch]);
      }
    }, 200);

    // B. FETCH FUNCTION
    const fetchOneProvider = async (
      provider: (typeof installedProviders)[0],
      index: number,
    ) => {
      try {
        const data = await providerManager.getSearchPosts({
          searchQuery: currentFilter,
          page: 1,
          providerValue: provider.value,
          signal: signal,
        });

        if (signal.aborted || !isMounted.current) return;

        // Decrement loading count safely
        setLoadingCount(prev => Math.max(0, prev - 1));

        if (data && data.length > 0) {
          const providerCat = provider.category || 'Others';
          const formattedCat =
            providerCat.charAt(0).toUpperCase() +
            providerCat.slice(1).toLowerCase();

          const newData: SearchPageData = {
            title: provider.display_name,
            Posts: data,
            filter: currentFilter,
            providerValue: provider.value,
            uniqueId: `${provider.value}-${index}`,
            value: provider.value,
            name: provider.display_name,
            category: formattedCat,
          };

          // Immediate render for the very first result
          if (!hasLoadedFirstItem.current) {
            hasLoadedFirstItem.current = true;
            setSearchData(prev => [...prev, newData]);
          } else {
            queue.current.push(newData);
          }
        }
      } catch (error) {
        if (!signal.aborted && isMounted.current) {
          setLoadingCount(prev => Math.max(0, prev - 1));
        }
      }
    };

    // C. STAGGERED EXECUTION LOOP
    // We fetch in chunks of 4 to prevent freezing the JS bridge on Android
    const runSearch = async () => {
      const BATCH_SIZE = 4;
      const STAGGER_DELAY = 100; // ms

      for (let i = 0; i < installedProviders.length; i += BATCH_SIZE) {
        if (signal.aborted) break;

        const batch = installedProviders.slice(i, i + BATCH_SIZE);
        // Fire requests in parallel for this batch
        batch.forEach((provider, idx) => {
          fetchOneProvider(provider, i + idx);
        });

        // Small delay before firing the next batch to let UI breathe
        if (i + BATCH_SIZE < installedProviders.length) {
          await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY));
        }
      }
    };

    runSearch();

    return () => {
      abortController.abort();
      clearInterval(batchInterval);
    };
  }, [currentFilter, installedProviders]);

  // --- LOGIC 3: Filtering ---
  const filteredData = useMemo(() => {
    if (selectedType === 'All') return searchData;
    return searchData.filter(item => item.category === selectedType);
  }, [searchData, selectedType]);

  const renderItem: ListRenderItem<SearchPageData> = useCallback(
    ({item}) => <SearchResultItem item={item} filter={currentFilter} />,
    [currentFilter],
  );

  return (
    <SafeAreaView className="bg-black h-full w-full">
      <FlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={item => item.uniqueId}
        ListHeaderComponent={
          <View>
            <SearchHeader
              filter={currentFilter}
              loadingCount={loadingCount}
              primary={primary}
            />
            {uniqueTypes.length > 1 && (
              <TypeFilter
                types={uniqueTypes}
                selectedType={selectedType}
                onSelect={setSelectedType}
                primary={primary}
              />
            )}
          </View>
        }
        // --- PERFORMANCE CONFIG (Optimized for Android) ---
        initialNumToRender={3} // Render enough to fill screen immediately
        maxToRenderPerBatch={2} // Process smaller batches to keep FPS high
        updateCellsBatchingPeriod={50} // Update frequently
        windowSize={5} // Keep memory footprint low (5 screens worth of content)
        removeClippedSubviews={true} // Critical for Android list performance
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 40}}
        ListEmptyComponent={
          loadingCount === 0 && searchData.length === 0 ? (
            <View className="flex-1 justify-center items-center mt-20">
              <Text className="text-gray-500 text-lg">No results found.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

export default SearchResults;
