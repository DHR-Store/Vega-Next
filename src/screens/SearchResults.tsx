import {
  SafeAreaView,
  ActivityIndicator,
  Text,
  View,
  FlatList,
  ListRenderItem,
  InteractionManager,
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
  uniqueId: string; // CHANGED: Generated at runtime to prevent key collisions
  name: string;
  category: string;
}

// --- COMPONENT: Type Filter Bar ---
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
          {types.map(type => (
            <TouchableOpacity
              key={type}
              onPress={() => onSelect(type)}
              className={`px-4 py-1.5 rounded-full border ${
                selectedType === type
                  ? 'bg-primary border-primary'
                  : 'bg-gray-900 border-gray-700'
              }`}
              style={
                selectedType === type
                  ? {backgroundColor: primary, borderColor: primary}
                  : {}
              }>
              <Text
                className={`${
                  selectedType === type
                    ? 'text-white font-semibold'
                    : 'text-gray-400'
                }`}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  },
);

// --- COMPONENT: Memoized Result Item ---
const SearchResultItem = React.memo(
  ({item, filter}: {item: SearchPageData; filter: string}) => {
    return (
      <View className="mb-4">
        <Slider
          isLoading={false}
          title={item.name}
          posts={item.Posts}
          filter={filter}
          providerValue={item.value} // Keep original value for navigation/logic
          isSearch={true}
        />
      </View>
    );
  },
  // Strict equality check to prevent re-renders
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

  // --- LOGIC 1: Safe Filter Extraction ---
  // We use the raw installedProviders list to build categories
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

  // --- LOGIC 2: The Robust Search Engine ---
  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    // A. SETUP: Reset everything
    setSearchData([]);
    queue.current = [];
    hasLoadedFirstItem.current = false;

    // We do NOT filter uniqueProviders here anymore.
    // We want to fetch everything the user has installed, even duplicates.
    setLoadingCount(installedProviders.length);

    // B. BATCH FLUSHER (The "Anti-Freeze" Mechanism)
    // Updates UI every 500ms to allow clicks to register
    const batchInterval = setInterval(() => {
      if (queue.current.length > 0) {
        // Atomic update: take everything currently in queue and clear it
        const batch = [...queue.current];
        queue.current = [];
        setSearchData(prev => [...prev, ...batch]);
      }
    }, 500);

    // C. FETCHER FUNCTION
    // We pass 'index' to generate a truly unique ID for the UI
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

        setLoadingCount(prev => Math.max(0, prev - 1));

        if (data && data.length > 0) {
          // CATEGORY FORMATTING
          const providerCat = provider.category || 'Others';
          const formattedCat =
            providerCat.charAt(0).toUpperCase() +
            providerCat.slice(1).toLowerCase();

          // DATA OBJECT
          const newData: SearchPageData = {
            title: provider.display_name,
            Posts: data,
            filter: currentFilter,
            providerValue: provider.value,
            // CRITICAL FIX: Append index to value to guarantee uniqueness
            // This fixes "Missing Results" AND "Duplicate Key" crashes simultaneously
            uniqueId: `${provider.value}-${index}`,
            value: provider.value,
            name: provider.display_name,
            category: formattedCat,
          };

          // D. FASTEST FIRST LOGIC
          if (!hasLoadedFirstItem.current) {
            hasLoadedFirstItem.current = true;
            // Render immediately (bypass queue)
            setSearchData(prev => [...prev, newData]);
          } else {
            // Add to queue for batched rendering
            queue.current.push(newData);
          }
        }
      } catch (error) {
        if (!signal.aborted && isMounted.current) {
          setLoadingCount(prev => Math.max(0, prev - 1));
        }
      }
    };

    // E. EXECUTION (Wait for Navigation)
    const task = InteractionManager.runAfterInteractions(() => {
      // We map over ALL installedProviders, passing the index
      installedProviders.forEach((provider, index) => {
        fetchOneProvider(provider, index);
      });
    });

    return () => {
      abortController.abort();
      clearInterval(batchInterval);
      task.cancel();
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
        // KEY EXTRACTOR: Uses the runtime generated ID
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
        // --- PERFORMANCE CONFIG ---
        initialNumToRender={1}
        maxToRenderPerBatch={1} // Keeps UI thread free for clicking
        updateCellsBatchingPeriod={100}
        windowSize={4}
        removeClippedSubviews={true}
        keyboardShouldPersistTaps="always"
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
