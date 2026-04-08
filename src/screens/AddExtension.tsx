import React, {useState, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SettingsStackParamList} from '../App';
import {
  AntDesign,
  MaterialCommunityIcons,
  Ionicons,
  Feather,
} from '@expo/vector-icons';
import useThemeStore from '../lib/zustand/themeStore';
import useContentStore from '../lib/zustand/contentStore';
import {extensionStorage} from '../lib/storage/extensionStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  extensionManager,
  DynamicProviderExtension,
} from '../lib/services/ExtensionManager';
import RenderProviderFlagIcon from '../components/RenderProviderFLagIcon';

type Props = NativeStackScreenProps<SettingsStackParamList, 'AddExtension'>;

// Helper function to extract "DHR-Store/18" from the raw github url
const getRepoShorthand = (url?: string) => {
  if (!url) return 'Unknown';
  try {
    const stripped = url.replace('https://raw.githubusercontent.com/', '');
    const parts = stripped.split('/');
    const user = parts[0];
    const repo = parts[1];

    if (repo === 'vega-providers') return user;
    if (repo.endsWith('-vega-providers')) {
      return `${user}/${repo.replace('-vega-providers', '')}`;
    }
    return `${user}/${repo}`;
  } catch {
    return 'Unknown';
  }
};

const AddExtension = ({navigation}: Props) => {
  const {primary} = useThemeStore(state => state);
  const {setInstalledProviders} = useContentStore(state => state);

  const [repoInput, setRepoInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [allCustomProviders, setAllCustomProviders] = useState<
    DynamicProviderExtension[]
  >([]);
  const [savedRepos, setSavedRepos] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  const [installingProvider, setInstallingProvider] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // Load local storage first, then run a silent auto-refresh in the background
    loadSavedCustomProviders().then(repos => {
      if (repos && repos.length > 0) {
        autoRefreshBackground(repos);
      }
    });
  }, []);

  const loadSavedCustomProviders = async (activeRepoToSet?: string) => {
    try {
      const savedData = await AsyncStorage.getItem(
        'custom_extensions_manifests',
      );

      if (savedData) {
        const customProviders = JSON.parse(
          savedData,
        ) as DynamicProviderExtension[];
        setAllCustomProviders(customProviders);

        // Extract unique repository shorthands to create tabs
        const uniqueRepos = Array.from(
          new Set(customProviders.map(p => getRepoShorthand(p.sourceUrl))),
        );
        setSavedRepos(uniqueRepos);

        // Set the active tab
        if (activeRepoToSet) {
          setSelectedRepo(activeRepoToSet);
        } else if (uniqueRepos.length > 0 && !selectedRepo) {
          setSelectedRepo(uniqueRepos[0]);
        }

        return uniqueRepos; // Return repos for auto-refresh
      }
    } catch (error) {
      console.error('Failed to load local custom extensions', error);
    }
    return [];
  };

  const autoRefreshBackground = async (repos: string[]) => {
    // Silently refresh all saved repositories sequentially to avoid race conditions
    for (const repo of repos) {
      await executeFetch(repo, true);
    }
  };

  const handleRefreshActiveRepo = async () => {
    if (!selectedRepo) return;
    setIsRefreshing(true);
    try {
      await executeFetch(selectedRepo, true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const executeFetch = async (
    inputCleaned: string,
    isSilent: boolean = false,
  ) => {
    if (!isSilent) setIsFetching(true);
    if (!isSilent) setSearchQuery('');

    try {
      // 1. Fetch new custom providers
      const newProviders = await extensionManager.fetchCustomManifest(
        inputCleaned,
      );
      const targetRepoShorthand = getRepoShorthand(
        newProviders[0]?.sourceUrl || inputCleaned,
      );

      // 2. Properly await and save directly to AsyncStorage for persistence
      const savedData = await AsyncStorage.getItem(
        'custom_extensions_manifests',
      );
      const existingSaved = savedData ? JSON.parse(savedData) : [];

      // REMOVE all existing providers that belong to this repository so we don't keep deleted ones
      const filteredExisting = existingSaved.filter(
        (existing: any) =>
          getRepoShorthand(existing.sourceUrl) !== targetRepoShorthand,
      );

      const updatedProviders = [...newProviders, ...filteredExisting];
      await AsyncStorage.setItem(
        'custom_extensions_manifests',
        JSON.stringify(updatedProviders),
      );

      // 3. Save to global available providers so Auto-Update works
      const existingAvailable = extensionStorage.getAvailableProviders() || [];
      const filteredAvailable = existingAvailable.filter(
        (existing: any) =>
          getRepoShorthand(existing.sourceUrl) !== targetRepoShorthand,
      );

      extensionStorage.setAvailableProviders([
        ...updatedProviders,
        ...filteredAvailable,
      ]);

      // 4. Reload UI and switch to the newly fetched repo tab
      await loadSavedCustomProviders(targetRepoShorthand);

      if (!isSilent) {
        Alert.alert(
          'Success',
          `Fetched ${newProviders.length} extensions from ${inputCleaned} and saved locally!`,
        );
        setRepoInput(''); // Clear input
      }
    } catch (error) {
      if (!isSilent) {
        Alert.alert(
          'Error',
          'Failed to fetch extensions from this repository. Check the spelling and try again.',
        );
      }
    } finally {
      if (!isSilent) setIsFetching(false);
    }
  };

  const handleFetchManifest = () => {
    const inputCleaned = repoInput.trim();
    if (!inputCleaned) {
      Alert.alert(
        'Error',
        'Please enter a repository name (e.g., DHR-Store or DHR-Store/18)',
      );
      return;
    }

    // Check for 18+ content indicator
    if (inputCleaned.includes('/18')) {
      Alert.alert(
        '18+ Content Warning',
        'This repository contains adult content. Are you 18 years or older?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'I am 18+',
            style: 'destructive',
            onPress: () => executeFetch(inputCleaned, false),
          },
        ],
      );
    } else {
      executeFetch(inputCleaned, false);
    }
  };

  // --- Delete Repository ---
  const handleDeleteRepo = (repoToDelete: string) => {
    Alert.alert(
      'Remove Repository',
      `Are you sure you want to remove '${repoToDelete}'?\n\nUninstalled extensions from this repo will disappear.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Remove from local storage
              const remainingCustom = allCustomProviders.filter(
                p => getRepoShorthand(p.sourceUrl) !== repoToDelete,
              );
              await AsyncStorage.setItem(
                'custom_extensions_manifests',
                JSON.stringify(remainingCustom),
              );

              // 2. Remove from global available list
              const globalAvailable =
                extensionStorage.getAvailableProviders() || [];
              const newGlobalAvailable = globalAvailable.filter((p: any) => {
                if (!p.sourceUrl) return true; // Keep original default providers
                return getRepoShorthand(p.sourceUrl) !== repoToDelete;
              });
              extensionStorage.setAvailableProviders(newGlobalAvailable);

              // 3. Update UI states
              setAllCustomProviders(remainingCustom);
              const remainingRepos = savedRepos.filter(r => r !== repoToDelete);
              setSavedRepos(remainingRepos);

              if (selectedRepo === repoToDelete) {
                setSelectedRepo(
                  remainingRepos.length > 0 ? remainingRepos[0] : null,
                );
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete repository.');
            }
          },
        },
      ],
    );
  };

  const handleInstallProvider = async (provider: DynamicProviderExtension) => {
    setInstallingProvider(provider.value);
    try {
      await extensionManager.installProvider(provider);

      // Update global store so it shows up in the main Extension screen
      const installed = extensionStorage.getInstalledProviders() || [];
      setInstalledProviders(installed);
    } catch (error) {
      Alert.alert('Error', 'Failed to install provider.');
    } finally {
      setInstallingProvider(null);
    }
  };

  // Compute how many providers belong to each repository for the badges
  const repoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allCustomProviders.forEach(p => {
      const repo = getRepoShorthand(p.sourceUrl);
      counts[repo] = (counts[repo] || 0) + 1;
    });
    return counts;
  }, [allCustomProviders]);

  // Filter providers based on the selected repo tab AND the search query
  const displayedProviders = useMemo(() => {
    let list = allCustomProviders;

    if (selectedRepo) {
      list = list.filter(p => getRepoShorthand(p.sourceUrl) === selectedRepo);
    }

    if (searchQuery.trim()) {
      list = list.filter(
        p =>
          p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.value.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    return list;
  }, [allCustomProviders, selectedRepo, searchQuery]);

  const renderProviderCard = ({item}: {item: DynamicProviderExtension}) => {
    const isInstalled = extensionStorage.isProviderInstalled(item.value);
    const isInstalling = installingProvider === item.value;

    return (
      <View className="flex-row items-center bg-[#18181b] p-4 mx-4 mb-3 rounded-2xl border border-white/5">
        <View className="w-14 h-14 rounded-2xl bg-[#27272a] items-center justify-center overflow-hidden border border-white/10">
          {item.icon ? (
            <Image
              source={{uri: item.icon}}
              className="w-full h-full"
              style={{resizeMode: 'cover'}}
            />
          ) : (
            <RenderProviderFlagIcon type={item.type} />
          )}
        </View>

        <View className="flex-1 mx-4 justify-center">
          <Text
            className="text-white text-base font-bold tracking-wide mb-1"
            numberOfLines={1}>
            {item.display_name}
          </Text>
          <View className="flex-row items-center">
            <Text className="text-gray-400 text-xs font-medium">
              v{item.version}
            </Text>
            <View className="w-1 h-1 rounded-full bg-gray-600 mx-2" />
            <Text className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">
              {item.type || 'Global'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => handleInstallProvider(item)}
          disabled={isInstalled || isInstalling}
          className="w-10 h-10 rounded-full items-center justify-center shadow-lg"
          style={{
            backgroundColor: isInstalled ? '#27272a' : primary,
            opacity: isInstalling ? 0.7 : 1,
          }}>
          {isInstalling ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <MaterialCommunityIcons
              name={isInstalled ? 'check' : 'download'}
              size={20}
              color={isInstalled ? '#9ca3af' : 'white'}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#09090b]">
      <StatusBar backgroundColor="#09090b" barStyle="light-content" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-12 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 bg-white/5 rounded-full items-center justify-center border border-white/10 mr-4">
            <AntDesign name="arrowleft" size={20} color="white" />
          </TouchableOpacity>
          <View>
            <Text className="text-white text-xl font-extrabold tracking-wide">
              Custom Repositories
            </Text>
            <Text className="text-gray-500 text-xs font-medium mt-0.5">
              Install 3rd party extensions
            </Text>
          </View>
        </View>
      </View>

      {/* Input Section */}
      <View className="px-4 pt-2 pb-6 border-b border-white/5">
        <View className="flex-row items-center gap-3 mb-4">
          <View className="flex-1 flex-row items-center bg-[#18181b] rounded-2xl px-4 py-3.5 border border-white/10 shadow-sm">
            <Feather name="github" size={20} color="#a1a1aa" />
            <TextInput
              placeholder="e.g., username/repo"
              placeholderTextColor="#71717a"
              className="flex-1 text-white ml-3 text-base font-medium"
              value={repoInput}
              onChangeText={setRepoInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <TouchableOpacity
            onPress={handleFetchManifest}
            disabled={isFetching || !repoInput.trim()}
            className="px-5 py-3.5 rounded-2xl justify-center items-center shadow-lg"
            style={{
              backgroundColor: !repoInput.trim() ? '#27272a' : primary,
              opacity: isFetching ? 0.7 : 1,
            }}>
            {isFetching ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Fetch</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Saved Repositories Tabs with Refresh Button */}
        {savedRepos.length > 0 && (
          <View className="mt-2">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-gray-400 text-xs font-bold tracking-widest uppercase ml-1">
                Your Manifests
              </Text>

              {/* Refresh Button for the active tab */}
              {selectedRepo && (
                <TouchableOpacity
                  onPress={handleRefreshActiveRepo}
                  disabled={isRefreshing}
                  className="flex-row items-center bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color={primary} />
                  ) : (
                    <View className="flex-row items-center">
                      <Ionicons name="sync" size={14} color={primary} />
                      <Text className="text-gray-300 text-xs font-medium ml-1.5">
                        Sync
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row">
              {savedRepos.map(repo => {
                const isActive = selectedRepo === repo;
                const count = repoCounts[repo] || 0;

                return (
                  <TouchableOpacity
                    key={repo}
                    onPress={() => {
                      setSelectedRepo(repo);
                      setSearchQuery(''); // Reset search when switching tabs
                    }}
                    onLongPress={() => handleDeleteRepo(repo)}
                    className={`px-4 py-2.5 rounded-2xl mr-3 flex-row items-center border transition-all ${
                      isActive
                        ? 'border-transparent'
                        : 'border-white/10 bg-[#18181b]'
                    }`}
                    style={{backgroundColor: isActive ? primary : '#18181b'}}>
                    <Text
                      className={`font-bold text-sm tracking-wide ${
                        isActive ? 'text-white' : 'text-gray-400'
                      }`}>
                      {repo}
                    </Text>

                    {/* Count Badge */}
                    <View
                      className={`ml-2 px-1.5 py-0.5 rounded-md ${
                        isActive ? 'bg-black/30' : 'bg-[#27272a]'
                      }`}>
                      <Text
                        className={`text-[10px] font-bold ${
                          isActive ? 'text-white' : 'text-gray-400'
                        }`}>
                        {count}
                      </Text>
                    </View>

                    {isActive && (
                      <TouchableOpacity
                        onPress={() => handleDeleteRepo(repo)}
                        className="ml-2 bg-black/20 rounded-full p-1">
                        <Ionicons name="close" size={12} color="white" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Search Bar */}
        {(displayedProviders.length > 0 || searchQuery.length > 0) && (
          <View className="flex-row items-center bg-[#18181b] rounded-2xl px-4 py-3 mt-5 border border-white/5">
            <Ionicons name="search" size={20} color="#71717a" />
            <TextInput
              placeholder="Search extensions..."
              placeholderTextColor="#71717a"
              className="flex-1 text-white ml-3 text-base font-medium"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                className="p-1">
                <Ionicons name="close-circle" size={20} color="#71717a" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* List Section */}
      <FlatList
        data={displayedProviders}
        keyExtractor={item => item.value}
        renderItem={renderProviderCard}
        contentContainerStyle={{paddingTop: 16, paddingBottom: 40}}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isFetching && !isRefreshing ? (
            <View className="flex-1 justify-center items-center py-20 mt-10">
              <View className="w-20 h-20 bg-white/5 rounded-full items-center justify-center mb-4 border border-white/10">
                <MaterialCommunityIcons
                  name={
                    allCustomProviders.length > 0
                      ? 'magnify-close'
                      : 'cloud-search-outline'
                  }
                  size={36}
                  color="#71717a"
                />
              </View>
              <Text className="text-white text-lg font-bold">
                {allCustomProviders.length > 0
                  ? 'No extensions found'
                  : 'No custom repositories'}
              </Text>
              <Text className="text-gray-500 text-sm mt-2 text-center px-10 leading-5">
                {allCustomProviders.length > 0
                  ? 'Try adjusting your search query.'
                  : 'Enter a GitHub repository shorthand above to fetch and save custom providers.'}
              </Text>
            </View>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
};

export default AddExtension;
