import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SettingsStackParamList} from '../../App';
import {
  MaterialCommunityIcons,
  AntDesign,
  Feather,
  Ionicons,
} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import {
  extensionStorage,
  ProviderExtension,
} from '../../lib/storage/extensionStorage';
import {extensionManager} from '../../lib/services/ExtensionManager';
import RenderProviderFlagIcon from '../../components/RenderProviderFLagIcon';

// Import real execution functions based on your app's architecture
import {getHomePageDataOptimized} from '../../lib/getHomepagedata';
import {providerManager} from '../../lib/services/ProviderManager';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ProviderCheck'>;

type CheckStatus = boolean | null;

type ModuleCheckResult = {
  posts: CheckStatus;
  meta: CheckStatus;
  catalog: CheckStatus;
  stream: CheckStatus;
  episodes: CheckStatus;
};

const ProviderCheck = ({navigation}: Props) => {
  const {primary} = useThemeStore(state => state);
  const [installedProviders, setInstalledProviders] = useState<
    ProviderExtension[]
  >([]);
  const [results, setResults] = useState<Record<string, ModuleCheckResult>>({});

  // State for specific checking providers
  const [checkingProviders, setCheckingProviders] = useState<Set<string>>(
    new Set(),
  );

  // --- Logging System State ---
  const [providerLogs, setProviderLogs] = useState<Record<string, string[]>>(
    {},
  );
  const [activeLogProvider, setActiveLogProvider] =
    useState<ProviderExtension | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const providers = extensionStorage.getInstalledProviders() || [];
    setInstalledProviders(providers);
  }, []);

  // Helper to append logs in real-time
  const appendLog = (providerValue: string, message: string) => {
    const timeString = new Date().toLocaleTimeString([], {hour12: false});
    setProviderLogs(prev => {
      const currentLogs = prev[providerValue] || [];
      return {
        ...prev,
        [providerValue]: [...currentLogs, `[${timeString}] ${message}`],
      };
    });
  };

  const runCheckForProvider = async (provider: ProviderExtension) => {
    if (checkingProviders.has(provider.value)) return;

    setCheckingProviders(prev => new Set(prev).add(provider.value));

    // Clear previous logs for this provider
    setProviderLogs(prev => ({...prev, [provider.value]: []}));
    appendLog(
      provider.value,
      `Starting diagnostics for ${provider.display_name}...`,
    );

    const providerModule = extensionManager.getProviderModules(provider.value);

    const initialResult: ModuleCheckResult = {
      posts: providerModule?.modules.posts ? null : false,
      catalog: providerModule?.modules.catalog ? null : false,
      meta: providerModule?.modules.meta ? null : false,
      episodes: providerModule?.modules.episodes ? null : false,
      stream: providerModule?.modules.stream ? null : false,
    };

    let currentResult = {...initialResult};

    const updateResult = (key: keyof ModuleCheckResult, status: boolean) => {
      currentResult[key] = status;
      setResults(prev => ({
        ...prev,
        [provider.value]: {...currentResult},
      }));
    };

    setResults(prev => ({...prev, [provider.value]: currentResult}));

    if (!providerModule || !providerModule.modules) {
      appendLog(
        provider.value,
        '❌ ERROR: Provider modules not found in local cache.',
      );
      setCheckingProviders(prev => {
        const next = new Set(prev);
        next.delete(provider.value);
        return next;
      });
      return;
    }

    let testLink = '';
    let testType = 'movie'; // Default fallback
    const controller = new AbortController();

    // --- STEP 1: TEST POSTS ---
    if (currentResult.posts === null) {
      appendLog(provider.value, 'Fetching Home Page (Posts) data...');
      try {
        const homePageFunc =
          (getHomePageDataOptimized as any) ||
          require('../../lib/getHomepagedata').getHomePageData;
        const homeData = await homePageFunc(provider, controller.signal);

        if (homeData && homeData.length > 0) {
          let allPosts: any[] = [];
          homeData.forEach((section: any) => {
            if (section.Posts && section.Posts.length > 0) {
              allPosts = [...allPosts, ...section.Posts];
            }
          });

          if (allPosts.length > 0) {
            updateResult('posts', true);
            const randomPost =
              allPosts[Math.floor(Math.random() * allPosts.length)];
            testLink = randomPost.link;
            testType = randomPost.type || 'movie';

            appendLog(
              provider.value,
              `✅ Posts successful. Found ${allPosts.length} total posts. Randomly selected link: ${testLink}`,
            );
          } else {
            updateResult('posts', false);
            appendLog(
              provider.value,
              '❌ Posts failed: Received data structure but no valid posts/links were found.',
            );
          }
        } else {
          updateResult('posts', false);
          appendLog(
            provider.value,
            '❌ Posts failed: Received empty array or null.',
          );
        }
      } catch (e: any) {
        updateResult('posts', false);
        appendLog(
          provider.value,
          `❌ Posts error: ${e?.message || 'Unknown network error'}`,
        );
      }
    }

    // --- STEP 2: TEST META ---
    if (currentResult.meta === null) {
      if (!testLink) {
        appendLog(
          provider.value,
          '⚠️ Skipping Meta test: No valid link retrieved from Posts.',
        );
      } else {
        appendLog(provider.value, `Fetching Meta data for link...`);
        try {
          const metaData = await providerManager.getMetaData({
            link: testLink,
            provider: provider.value,
          });

          if (
            metaData &&
            (metaData.title || metaData.synopsis || metaData.id)
          ) {
            updateResult('meta', true);
            if (metaData.type) {
              testType = metaData.type.toLowerCase();
              appendLog(
                provider.value,
                `ℹ️ Content type updated to: ${testType.toUpperCase()}`,
              );
            }

            appendLog(
              provider.value,
              `✅ Meta successful. Retrieved title: ${
                metaData.title || 'Unknown'
              }`,
            );

            if (metaData.stream && metaData.stream.length > 0) {
              updateResult('stream', true);
              appendLog(
                provider.value,
                `✅ Stream successful (sources found directly inside Meta).`,
              );
            }
            if (metaData.episodes && metaData.episodes.length > 0) {
              updateResult('episodes', true);
              appendLog(
                provider.value,
                `✅ Episodes successful (found directly inside Meta).`,
              );
            }
          } else {
            updateResult('meta', false);
            appendLog(
              provider.value,
              '❌ Meta failed: Response missing core fields (title, id).',
            );
          }
        } catch (e: any) {
          updateResult('meta', false);
          appendLog(
            provider.value,
            `❌ Meta error: ${e?.message || 'Unknown error'}`,
          );
        }
      }
    }

    // --- STEP 3: TEST EPISODES ---
    let streamTestLink = testLink;
    const isMovie = testType === 'movie';

    if (currentResult.episodes === null && providerModule.modules.episodes) {
      if (!testLink) {
        appendLog(
          provider.value,
          '⚠️ Skipping Episodes test: No valid link retrieved from Posts.',
        );
      } else if (isMovie) {
        appendLog(
          provider.value,
          '⏭️ Skipping Episodes test: Content is a Movie, going straight to Streams.',
        );
      } else {
        appendLog(provider.value, `Fetching Episodes (Type: ${testType})...`);
        try {
          const eps = await providerManager.getEpisodes({
            url: testLink,
            providerValue: provider.value,
          });

          if (eps && eps.length > 0) {
            updateResult('episodes', true);
            appendLog(
              provider.value,
              `✅ Episodes successful. Fetched ${eps.length} items/seasons.`,
            );

            const randomItem = eps[Math.floor(Math.random() * eps.length)];
            let selectedEp = randomItem;
            if (randomItem.episodes && randomItem.episodes.length > 0) {
              selectedEp =
                randomItem.episodes[
                  Math.floor(Math.random() * randomItem.episodes.length)
                ];
            }

            streamTestLink = selectedEp.link || selectedEp.url || testLink;
            appendLog(
              provider.value,
              `🔗 Randomly selected Episode link for Stream test: ${streamTestLink}`,
            );
          } else {
            updateResult('episodes', false);
            appendLog(
              provider.value,
              '❌ Episodes failed: Returned empty array or null.',
            );
          }
        } catch (e: any) {
          updateResult('episodes', false);
          appendLog(
            provider.value,
            `❌ Episodes error: ${e?.message || 'Unknown error'}`,
          );
        }
      }
    }

    // --- STEP 4: TEST STREAM ---
    if (currentResult.stream === null && providerModule.modules.stream) {
      if (!streamTestLink) {
        appendLog(
          provider.value,
          '⚠️ Skipping Stream test: No valid link available to check streams.',
        );
      } else {
        appendLog(
          provider.value,
          `Fetching Streams from link: ${streamTestLink}...`,
        );
        try {
          const streams = await providerManager.getStream({
            link: streamTestLink,
            type: testType,
            provider: provider.value,
          });
          if (streams && streams.length > 0) {
            updateResult('stream', true);
            appendLog(
              provider.value,
              `✅ Stream successful. Fetched ${streams.length} sources.`,
            );
          } else {
            updateResult('stream', false);
            appendLog(
              provider.value,
              '❌ Stream failed: Returned empty array or null.',
            );
          }
        } catch (e: any) {
          updateResult('stream', false);
          appendLog(
            provider.value,
            `❌ Stream error: ${e?.message || 'Unknown error'}`,
          );
        }
      }
    }

    appendLog(provider.value, '✅ Diagnostics complete.');

    setCheckingProviders(prev => {
      const next = new Set(prev);
      next.delete(provider.value);
      return next;
    });
  };

  const runAllChecks = async () => {
    for (const provider of installedProviders) {
      await runCheckForProvider(provider);
    }
  };

  const renderStatusBadge = (label: string, status?: CheckStatus) => {
    let bgColor = 'bg-[#1e1e24]';
    let borderColor = 'border-[#2c2c35]';
    let icon = 'minus-circle-outline';
    let iconColor = '#6b7280'; // gray-500
    let textColor = 'text-gray-400';

    if (status === true) {
      bgColor = 'bg-emerald-500/10';
      borderColor = 'border-emerald-500/30';
      icon = 'check-circle';
      iconColor = '#10b981'; // emerald-500
      textColor = 'text-emerald-500';
    } else if (status === false) {
      bgColor = 'bg-rose-500/10';
      borderColor = 'border-rose-500/30';
      icon = 'close-circle';
      iconColor = '#f43f5e'; // rose-500
      textColor = 'text-rose-500';
    }

    return (
      <View
        className={`flex-row items-center px-3 py-1.5 rounded-lg mr-2 mb-2 border ${bgColor} ${borderColor}`}>
        <MaterialCommunityIcons
          name={icon as any}
          size={14}
          color={iconColor}
        />
        <Text
          className={`ml-2 text-xs font-bold tracking-wide uppercase ${textColor}`}>
          {label}
        </Text>
      </View>
    );
  };

  const renderProvider = ({item}: {item: ProviderExtension}) => {
    const providerResult = results[item.value];
    const isCurrentlyChecking = checkingProviders.has(item.value);

    return (
      <View className="bg-[#121214] rounded-3xl mb-5 mx-4 border border-gray-800/80 shadow-lg overflow-hidden">
        {/* Header Section */}
        <View className="p-5 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            {/* Dynamic Provider Logo / Icon */}
            <View className="w-14 h-14 rounded-2xl bg-[#1c1c20] items-center justify-center border border-gray-800/60 overflow-hidden shadow-sm">
              {item.icon ? (
                <Image
                  source={{uri: item.icon}}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <RenderProviderFlagIcon type={item.type} />
              )}
            </View>

            <View className="ml-4 flex-1">
              <Text
                className="text-white font-extrabold text-[18px] tracking-wide"
                numberOfLines={1}>
                {item.display_name}
              </Text>
              <View className="flex-row items-center mt-1">
                <View className="bg-gray-800/80 px-2 py-0.5 rounded-md">
                  <Text className="text-gray-400 text-[10px] font-bold uppercase">
                    v{item.version}
                  </Text>
                </View>
                <Text className="text-gray-500 text-xs ml-2 font-medium">
                  {item.value}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center gap-3">
            {/* Logs Button */}
            <TouchableOpacity
              onPress={() => setActiveLogProvider(item)}
              activeOpacity={0.7}
              className="w-11 h-11 rounded-full bg-[#1c1c20] items-center justify-center border border-gray-700/50 shadow-sm">
              <MaterialCommunityIcons
                name="console-line"
                size={20}
                color="#9ca3af"
              />
            </TouchableOpacity>

            {/* Play Button */}
            <TouchableOpacity
              onPress={() => runCheckForProvider(item)}
              disabled={isCurrentlyChecking}
              activeOpacity={0.7}
              style={{
                backgroundColor: isCurrentlyChecking ? 'transparent' : primary,
              }}
              className={`w-11 h-11 rounded-full items-center justify-center shadow-lg ${
                isCurrentlyChecking ? '' : 'border border-black/20'
              }`}>
              {isCurrentlyChecking ? (
                <ActivityIndicator size="small" color={primary} />
              ) : (
                <Ionicons
                  name="play"
                  size={20}
                  color="white"
                  style={{marginLeft: 2}}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Diagnostics Results Section */}
        <View className="bg-[#0a0a0c] px-5 py-4 border-t border-gray-800/40">
          <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-3">
            Diagnostics Status
          </Text>
          {providerResult ? (
            <View className="flex-row flex-wrap">
              {renderStatusBadge('Posts', providerResult.posts)}
              {renderStatusBadge('Meta', providerResult.meta)}
              {renderStatusBadge('Catalog', providerResult.catalog)}
              {renderStatusBadge('Episodes', providerResult.episodes)}
              {renderStatusBadge('Stream', providerResult.stream)}
            </View>
          ) : (
            <View className="flex-row items-center py-2">
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color="#6b7280"
              />
              <Text className="text-gray-400 text-sm ml-2 font-medium">
                Tap the play button to run live tests.
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#050505]">
      {/* Sleek Modern Header */}
      <View className="px-5 pt-14 pb-4 flex-row items-center justify-between bg-[#050505]">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="w-10 h-10 bg-[#151517] rounded-full items-center justify-center border border-gray-800/60 mr-3">
            <Ionicons name="chevron-back" size={20} color="white" />
          </TouchableOpacity>
          <View>
            <Text className="text-white font-extrabold text-2xl tracking-wide">
              Diagnostics
            </Text>
            <Text className="text-gray-500 text-xs font-medium mt-0.5">
              {installedProviders.length} providers installed
            </Text>
          </View>
        </View>

        {/* Header Run All Button */}
        {installedProviders.length > 0 && (
          <TouchableOpacity
            onPress={runAllChecks}
            disabled={checkingProviders.size > 0}
            activeOpacity={0.7}
            className={`px-4 py-2.5 rounded-full flex-row items-center justify-center border ${
              checkingProviders.size > 0
                ? 'bg-gray-900 border-gray-800'
                : 'bg-white/10 border-white/10'
            }`}>
            {checkingProviders.size > 0 ? (
              <ActivityIndicator size="small" color="gray" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="shield-sync"
                  size={16}
                  color={primary}
                />
                <Text className="text-white font-bold text-xs ml-2 uppercase tracking-wide">
                  Test All
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={installedProviders}
        keyExtractor={item => item.value}
        renderItem={renderProvider}
        contentContainerStyle={{paddingTop: 10, paddingBottom: 40}}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center mt-32 px-10">
            <View className="w-24 h-24 bg-[#151517] rounded-full items-center justify-center border border-gray-800/60 mb-5">
              <MaterialCommunityIcons
                name="puzzle-remove-outline"
                size={40}
                color="#4b5563"
              />
            </View>
            <Text className="text-white text-xl font-bold text-center">
              No Providers
            </Text>
            <Text className="text-gray-500 text-sm mt-2 text-center">
              Install a provider from the Extensions menu to run diagnostics.
            </Text>
          </View>
        }
      />

      {/* --- MODERN TERMINAL-STYLE LOG MODAL --- */}
      <Modal
        visible={!!activeLogProvider}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveLogProvider(null)}>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#0d0d12] w-full h-[85%] rounded-t-[32px] border-t border-gray-800/80 shadow-2xl overflow-hidden">
            {/* Terminal Header */}
            <View className="flex-row items-center justify-between px-6 py-4 bg-[#15151a] border-b border-gray-800/60">
              <View className="flex-row items-center">
                {/* Mac-style window controls */}
                <View className="flex-row gap-1.5 mr-4">
                  <View className="w-3 h-3 rounded-full bg-rose-500" />
                  <View className="w-3 h-3 rounded-full bg-amber-500" />
                  <View className="w-3 h-3 rounded-full bg-emerald-500" />
                </View>
                <Text className="text-gray-300 font-mono text-sm font-semibold">
                  {activeLogProvider?.display_name
                    .toLowerCase()
                    .replace(/\s/g, '_')}
                  _logs.sh
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveLogProvider(null)}
                className="w-8 h-8 bg-white/5 rounded-full items-center justify-center">
                <Ionicons name="close" size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Terminal Body */}
            <ScrollView
              ref={scrollViewRef}
              onContentSizeChange={() =>
                scrollViewRef.current?.scrollToEnd({animated: true})
              }
              className="p-5"
              contentContainerStyle={{paddingBottom: 40}}>
              <Text className="text-emerald-500 font-mono text-xs mb-4">
                $ vega-cli diagnose --provider {activeLogProvider?.value}
              </Text>

              {activeLogProvider &&
              providerLogs[activeLogProvider.value]?.length > 0 ? (
                providerLogs[activeLogProvider.value].map((log, index) => {
                  const isError = log.includes('❌');
                  const isSuccess = log.includes('✅');
                  const isWarning = log.includes('⚠️') || log.includes('⏭️');
                  const isInfo = log.includes('ℹ️') || log.includes('🔗');

                  let textColor = 'text-gray-400';
                  if (isError) textColor = 'text-rose-400 font-semibold';
                  if (isSuccess) textColor = 'text-emerald-400';
                  if (isWarning) textColor = 'text-amber-400';
                  if (isInfo) textColor = 'text-sky-400';

                  return (
                    <Text
                      key={index}
                      className={`text-[13px] leading-6 mb-1.5 font-mono ${textColor}`}>
                      <Text className="text-gray-600 mr-2">{'> '}</Text>
                      {log}
                    </Text>
                  );
                })
              ) : (
                <View className="py-20 items-center justify-center opacity-50">
                  <MaterialCommunityIcons
                    name="console"
                    size={48}
                    color="#4b5563"
                  />
                  <Text className="text-gray-500 font-mono text-sm mt-4">
                    Waiting for execution...
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ProviderCheck;
