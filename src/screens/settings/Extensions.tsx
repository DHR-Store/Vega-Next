import React, {useState, useEffect, useRef, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  TextInput,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SettingsStackParamList} from '../../App';
import {
  MaterialCommunityIcons,
  MaterialIcons,
  Feather,
  AntDesign,
  Ionicons,
} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import useContentStore from '../../lib/zustand/contentStore';
import {
  extensionStorage,
  ProviderExtension,
} from '../../lib/storage/extensionStorage';
import {extensionManager} from '../../lib/services/ExtensionManager';
import {
  updateProvidersService,
  UpdateInfo,
} from '../../lib/services/UpdateProviders';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {settingsStorage} from '../../lib/storage';
import RenderProviderFlagIcon from '../../components/RenderProviderFLagIcon';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Extensions'>;

type TabType = 'installed' | 'available';
// CategoryType is now dynamic string, but we default to 'All'
type CategoryType = string;

// Extend the ProviderExtension type locally
interface ExtendedProvider extends ProviderExtension {
  category?: string;
  genres?: string[];
}

const Extensions = ({navigation}: Props) => {
  const {primary} = useThemeStore(state => state);
  const {
    provider: activeExtensionProvider,
    setProvider: setActiveExtensionProvider,
    installedProviders,
    availableProviders,
    setInstalledProviders,
    setAvailableProviders,
  } = useContentStore(state => state);

  // States
  const [activeTab, setActiveTab] = useState<TabType>(
    installedProviders?.length > 0 ? 'installed' : 'available',
  );
  const [installingProvider, setInstallingProvider] = useState<string | null>(
    null,
  );
  const [updatingProvider, setUpdatingProvider] = useState<string | null>(null);
  const [updateInfos, setUpdateInfos] = useState<UpdateInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isPerformingBulkAction, setIsPerformingBulkAction] = useState(false);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All');
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);

  // Use a ref to track if the component is mounted
  const isMounted = useRef(true);

  // Load providers on component mount
  useEffect(() => {
    isMounted.current = true;
    const initializeExtensions = async () => {
      try {
        await extensionManager.initialize();
        if (isMounted.current) {
          loadProviders();
          await checkForUpdates();
        }
        if (
          isMounted.current &&
          (!availableProviders || availableProviders.length === 0)
        ) {
          await handleRefresh();
        }
      } catch (error) {
        if (isMounted.current) {
          loadProviders();
        }
      }
    };

    initializeExtensions();

    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadProviders = () => {
    const installed = extensionStorage.getInstalledProviders() || [];
    const available = extensionStorage.getAvailableProviders() || [];
    setInstalledProviders(installed);
    setAvailableProviders(available.filter(item => item && !item.disabled));
  };

  const checkForUpdates = async () => {
    try {
      const updates = await updateProvidersService.checkForUpdatesManual();
      if (isMounted.current) {
        setUpdateInfos(updates);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  const handleUpdateProvider = async (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    if (isMounted.current) {
      setUpdatingProvider(provider.value);
    }

    try {
      const success = await updateProvidersService.updateProvider(provider);
      if (success && isMounted.current) {
        loadProviders();
        await checkForUpdates();

        Alert.alert(
          'Success',
          `${provider.display_name} has been updated successfully!`,
        );

        if (activeExtensionProvider?.value === provider.value) {
          setActiveExtensionProvider(provider);
        }
      } else if (isMounted.current) {
        Alert.alert('Error', 'Failed to update provider. Please try again.');
      }
    } catch (error) {
      console.error('Update error:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to update provider. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setUpdatingProvider(null);
      }
    }
  };

  const handleTabChange = (tab: TabType) => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectTick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    setActiveTab(tab);
  };

  const handleCategorySelect = (category: CategoryType) => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectTick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    setSelectedCategory(category);
  };

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
    setIsCountryModalVisible(false);
  };

  const handleInstallProvider = async (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    if (isMounted.current) {
      setInstallingProvider(provider.value);
    }

    try {
      await extensionManager.installProvider(provider);
      if (isMounted.current) {
        loadProviders();
        Alert.alert(
          'Success',
          `${provider.display_name} has been installed successfully!`,
        );
        setInstalledProviders(extensionStorage.getInstalledProviders() || []);
        if (
          !activeExtensionProvider ||
          activeExtensionProvider.value !== provider.value
        ) {
          setActiveExtensionProvider(provider);
        }
      }
    } catch (error) {
      console.error('Installation error:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to install provider. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setInstallingProvider(null);
      }
    }
  };

  const handleUninstallProvider = (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }

    Alert.alert(
      'Uninstall Provider',
      `Are you sure you want to uninstall ${
        provider.display_name || 'this provider'
      }?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Uninstall',
          style: 'destructive',
          onPress: () => {
            extensionStorage.uninstallProvider(provider.value);
            loadProviders();
            setInstalledProviders(
              extensionStorage.getInstalledProviders() || [],
            );

            if (activeExtensionProvider?.value === provider?.value) {
              setActiveExtensionProvider(
                extensionStorage.getInstalledProviders()[0] || {
                  value: '',
                  display_name: '',
                  type: '',
                  version: '',
                },
              );
            }
          },
        },
      ],
    );
  };

  const handleSetActiveProvider = (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    setActiveExtensionProvider(provider);
  };

  const handleRefresh = async () => {
    if (isMounted.current) {
      setRefreshing(true);
    }
    try {
      const providers = await extensionManager.fetchManifest(true);
      if (isMounted.current) {
        extensionStorage.setAvailableProviders(providers);
        setAvailableProviders(providers);
        loadProviders();
        await checkForUpdates();
      }
    } catch (error) {
      console.error('Refresh error:', error);
      if (isMounted.current) {
        Alert.alert(
          'Error',
          'Failed to refresh providers list. Please check your internet connection.',
        );
      }
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  };

  // --- BULK ACTION FUNCTIONS ---
  const handleEnableAllProviders = async () => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    const availableToInstall = (availableProviders || []).filter(
      provider =>
        provider &&
        provider.value &&
        !extensionStorage.isProviderInstalled(provider.value),
    );

    if (availableToInstall.length === 0) {
      Alert.alert('Info', 'All available providers are already installed.');
      return;
    }

    Alert.alert(
      'Enable All',
      `Are you sure you want to install ${availableToInstall.length} providers?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Install All',
          style: 'default',
          onPress: async () => {
            if (isMounted.current) {
              setIsPerformingBulkAction(true);
            }
            try {
              await Promise.all(
                availableToInstall.map(provider =>
                  extensionManager.installProvider(provider),
                ),
              );
              if (isMounted.current) {
                loadProviders();
                Alert.alert(
                  'Success',
                  'All available providers have been installed!',
                );
                setActiveTab('installed');
              }
            } catch (error) {
              console.error('Bulk installation error:', error);
              if (isMounted.current) {
                Alert.alert(
                  'Error',
                  'Failed to install all providers. Please try again.',
                );
              }
            } finally {
              if (isMounted.current) {
                setIsPerformingBulkAction(false);
              }
            }
          },
        },
      ],
    );
  };

  const handleDisableAllProviders = () => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    if ((installedProviders || []).length === 0) {
      Alert.alert('Info', 'No providers are currently installed.');
      return;
    }

    Alert.alert(
      'Disable All',
      `Are you sure you want to uninstall all installed providers?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Uninstall All',
          style: 'destructive',
          onPress: () => {
            const uninstallWithoutAlert = (provider: ProviderExtension) => {
              if (!provider || !provider.value) return;
              extensionStorage.uninstallProvider(provider.value);
            };
            installedProviders?.forEach(uninstallWithoutAlert);
            loadProviders();
            setActiveExtensionProvider(undefined);
            Alert.alert('Success', 'All providers have been uninstalled!');
          },
        },
      ],
    );
  };

  // --- DYNAMIC DATA LOGIC ---

  // 1. Get Unique Countries for the Dropdown (Dynamic)
  const uniqueCountries = useMemo(() => {
    const allProviders = [
      ...(installedProviders || []),
      ...(availableProviders || []),
    ] as ExtendedProvider[];

    const types = new Set<string>();
    allProviders.forEach(p => {
      if (p.type) types.add(p.type.toLowerCase());
    });

    const formattedTypes = Array.from(types).map(
      t => t.charAt(0).toUpperCase() + t.slice(1),
    );

    return ['All', ...formattedTypes.sort()];
  }, [installedProviders, availableProviders]);

  // 2. Get Unique Categories for the Chips (Dynamic)
  const uniqueCategories = useMemo(() => {
    const allProviders = [
      ...(installedProviders || []),
      ...(availableProviders || []),
    ] as ExtendedProvider[];

    const categories = new Set<string>();
    allProviders.forEach(p => {
      // Handle cases where category might be null or mixed case
      if (p.category) {
        // Normalize: "Anime" and "anime" -> "Anime"
        const cat =
          p.category.charAt(0).toUpperCase() +
          p.category.slice(1).toLowerCase();
        categories.add(cat);
      }
    });

    // Convert to array, sort, and prepend 'All'
    return ['All', ...Array.from(categories).sort()];
  }, [installedProviders, availableProviders]);

  const getFilteredData = () => {
    const sourceData =
      activeTab === 'installed'
        ? installedProviders || []
        : availableProviders || [];

    return sourceData.filter((item: ExtendedProvider) => {
      if (!item || !item.value) return false;

      // 1. Filter by Category
      if (selectedCategory !== 'All') {
        const itemCategory = item.category?.toLowerCase();
        const targetCategory = selectedCategory.toLowerCase();
        if (itemCategory !== targetCategory) {
          return false;
        }
      }

      // 2. Filter by Country (Type)
      if (selectedCountry !== 'All') {
        const itemType = item.type?.toLowerCase();
        const targetType = selectedCountry.toLowerCase();
        if (itemType !== targetType) {
          return false;
        }
      }

      // 3. Filter by Search
      if (searchQuery.trim().length > 0) {
        const searchLower = searchQuery.toLowerCase();
        const typeMatch = item.type?.toLowerCase().includes(searchLower);
        const nameMatch = item.display_name
          ?.toLowerCase()
          .includes(searchLower);

        if (!typeMatch && !nameMatch) {
          return false;
        }
      }

      return true;
    });
  };

  const currentData = getFilteredData();

  const renderProviderCard = ({item}: {item: ExtendedProvider}) => {
    if (!item || !item.value) return null;
    const isActive = activeExtensionProvider?.value === item.value;
    const isInstalled = extensionStorage.isProviderInstalled(item.value);
    const isInstalling = installingProvider === item.value;
    const isUpdating = updatingProvider === item.value;
    const updateInfo = updateInfos.find(
      info => info.provider.value === item.value,
    );
    const hasUpdate = updateInfo?.hasUpdate || false;

    return (
      <View
        className="bg-tertiary rounded-2xl p-5 py-3 mb-4 mx-4 shadow-lg border border-quaternary"
        style={{elevation: 4}}>
        <View className="flex-row items-center mb-4 gap-4 justify-between">
          {/* Left: Icon */}
          {item.icon ? (
            <Image
              source={{uri: item.icon}}
              className="w-12 h-12 rounded-xl border-2 border-primary bg-quaternary"
              style={{resizeMode: 'cover'}}
            />
          ) : (
            <View className="px-3 py-2 bg-quaternary rounded-xl border border-gray-700">
              <RenderProviderFlagIcon type={item.type} />
            </View>
          )}
          {/* Middle: Info */}
          <View className="flex-1 mx-3">
            <View className="flex-row items-center flex-wrap">
              <Text className="text-white text-lg font-bold tracking-wide">
                {item.display_name || 'Unknown Provider'}
              </Text>
              {hasUpdate && updateInfo && (
                <View
                  style={{backgroundColor: primary}}
                  className="px-2 py-0.5 rounded-full ml-1">
                  <Text className="text-xs text-white font-semibold bg-gray-800">
                    Update
                  </Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center flex-wrap gap-1 mt-1">
              <Text className="text-gray-400 text-xs">
                v{item.version || '?'} • {item.type?.toUpperCase() || 'GLOBAL'}
              </Text>
              {item.category && (
                <View className="bg-gray-800 px-1.5 py-0.5 rounded ml-1">
                  <Text className="text-gray-300 text-[10px] capitalize">
                    {item.category}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {/* Right: Buttons */}
          <View className="flex-row gap-3 items-center">
            {activeTab === 'installed' ? (
              <>
                <TouchableOpacity
                  onPress={() => handleSetActiveProvider(item)}
                  className={`w-9 h-9 rounded-full items-center justify-center ${
                    isActive ? 'bg-green-600' : 'bg-gray-700'
                  }`}
                  style={{opacity: isActive ? 1 : 0.9}}>
                  <MaterialIcons
                    name={isActive ? 'check-circle' : 'radio-button-unchecked'}
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>
                {hasUpdate && (
                  <TouchableOpacity
                    onPress={() => handleUpdateProvider(updateInfo!.provider)}
                    disabled={isUpdating}
                    className="w-9 h-9 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: primary,
                      opacity: isUpdating ? 0.7 : 1,
                    }}>
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <MaterialCommunityIcons
                        name="update"
                        size={20}
                        color="white"
                      />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleUninstallProvider(item)}
                  className="w-9 h-9 rounded-full items-center justify-center bg-red-600">
                  <MaterialCommunityIcons
                    name="delete"
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => handleInstallProvider(item)}
                disabled={isInstalled || isInstalling}
                className={'w-9 h-9 rounded-full items-center justify-center'}
                style={{
                  opacity: isInstalling ? 0.7 : 1,
                  backgroundColor: isInstalled ? 'gray' : primary,
                }}>
                {isInstalling ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <MaterialCommunityIcons
                    name={isInstalled ? 'check' : 'download'}
                    size={20}
                    color="white"
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-black pt-10 pb-16">
      <StatusBar backgroundColor="black" barStyle="light-content" />
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-gray-800">
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <AntDesign name="arrowleft" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-semibold">Providers</Text>
        <View className="flex-row items-center space-x-2">
          {isPerformingBulkAction ? (
            <ActivityIndicator size="small" color={primary} />
          ) : (
            <>
              {activeTab === 'available' && (
                <TouchableOpacity onPress={handleEnableAllProviders}>
                  <MaterialCommunityIcons
                    name="download-multiple"
                    size={24}
                    color={primary}
                  />
                </TouchableOpacity>
              )}
              {activeTab === 'installed' && (
                <TouchableOpacity onPress={handleDisableAllProviders}>
                  <MaterialCommunityIcons
                    name="delete-sweep"
                    size={24}
                    color="red"
                  />
                </TouchableOpacity>
              )}
            </>
          )}
          <TouchableOpacity onPress={handleRefresh}>
            <Feather name="refresh-cw" size={24} color={primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-quaternary mx-4 mt-4 rounded-xl">
        <TouchableOpacity
          onPress={() => handleTabChange('installed')}
          className="flex-1 py-3 rounded-xl"
          style={{
            backgroundColor:
              activeTab === 'installed' ? primary : 'transparent',
          }}>
          <Text
            className={`text-center font-medium ${
              activeTab === 'installed' ? 'text-white' : 'text-gray-400'
            }`}>
            Installed ({(installedProviders || []).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabChange('available')}
          className="flex-1 py-3 rounded-xl"
          style={{
            backgroundColor:
              activeTab === 'available' ? primary : 'transparent',
          }}>
          <Text
            className={`text-center font-medium ${
              activeTab === 'available' ? 'text-white' : 'text-gray-400'
            }`}>
            Available ({(availableProviders || []).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- FILTERS SECTION --- */}
      <View className="mt-4 mx-4">
        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-900 rounded-xl px-3 py-2 border border-gray-800 mb-3">
          <Ionicons name="search" size={20} color="gray" />
          <TextInput
            placeholder="Search provider name or type..."
            placeholderTextColor="gray"
            className="flex-1 text-white ml-2 text-base"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="gray" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Chips & Country Select */}
        <View className="flex-row items-center gap-2">
          {/* Dynamic Categories ScrollView */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-grow"
            contentContainerStyle={{gap: 8}}>
            {uniqueCategories.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => handleCategorySelect(cat)}
                className={`px-4 py-1.5 rounded-full border ${
                  selectedCategory === cat
                    ? 'bg-primary border-primary'
                    : 'bg-gray-900 border-gray-700'
                }`}>
                <Text
                  className={`${
                    selectedCategory === cat
                      ? 'text-white font-semibold'
                      : 'text-gray-400'
                  }`}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Country Selector Button (Triggers Bottom Sheet) */}
          <TouchableOpacity
            onPress={() => setIsCountryModalVisible(true)}
            className={`px-3 py-1.5 rounded-full border flex-row items-center gap-1 ${
              selectedCountry !== 'All'
                ? 'bg-gray-800 border-primary'
                : 'bg-gray-900 border-gray-700'
            }`}>
            <Text
              className={
                selectedCountry !== 'All' ? 'text-white' : 'text-gray-400'
              }>
              {selectedCountry === 'All' ? 'Country' : selectedCountry}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={selectedCountry !== 'All' ? 'white' : 'gray'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Provider list */}
      <FlatList
        data={currentData}
        keyExtractor={(item, index) => item?.value || `provider-${index}`}
        renderItem={renderProviderCard}
        className="flex-1 mt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[primary]}
            tintColor={primary}
            progressBackgroundColor="black"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <MaterialCommunityIcons
              name="package-variant"
              size={64}
              color="gray"
            />
            <Text className="text-gray-400 text-lg mt-4">
              No matching providers found
            </Text>
            <Text className="text-gray-500 text-sm mt-2 text-center px-8">
              Try adjusting your filters or search terms
            </Text>
          </View>
        }
      />

      {/* --- Country Selection Bottom Sheet Modal --- */}
      <Modal
        visible={isCountryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCountryModalVisible(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsCountryModalVisible(false)}
          className="flex-1 bg-black/60 justify-end">
          <TouchableWithoutFeedback>
            <View className="bg-gray-900 w-full rounded-t-3xl border-t border-gray-700 max-h-[70%]">
              {/* Drag Handle */}
              <View className="w-full items-center pt-3 pb-2">
                <View className="w-12 h-1.5 bg-gray-600 rounded-full" />
              </View>

              {/* Header */}
              <View className="px-5 pb-3 border-b border-gray-800 flex-row justify-between items-center">
                <Text className="text-white font-bold text-xl">
                  Select Country
                </Text>
                <TouchableOpacity
                  onPress={() => setIsCountryModalVisible(false)}
                  className="p-1 bg-gray-800 rounded-full">
                  <Ionicons name="close" size={20} color="gray" />
                </TouchableOpacity>
              </View>

              {/* List */}
              <ScrollView
                contentContainerStyle={{padding: 16, paddingBottom: 40}}>
                {uniqueCountries.map(country => (
                  <TouchableOpacity
                    key={country}
                    onPress={() => handleCountrySelect(country)}
                    className={`p-4 rounded-xl mb-2 flex-row justify-between items-center border ${
                      selectedCountry === country
                        ? 'bg-primary/20 border-primary'
                        : 'bg-gray-800/50 border-gray-800'
                    }`}>
                    <View className="flex-row items-center gap-3">
                      <RenderProviderFlagIcon type={country} />
                      <Text
                        className={`${
                          selectedCountry === country
                            ? 'text-primary font-bold text-lg'
                            : 'text-gray-300 text-lg'
                        }`}>
                        {country}
                      </Text>
                    </View>
                    {selectedCountry === country && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default Extensions;
