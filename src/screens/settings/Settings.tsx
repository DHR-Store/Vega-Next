import {
  View,
  Text,
  Linking,
  TouchableOpacity,
  TouchableNativeFeedback,
  ScrollView,
  Dimensions,
  Switch,
  TextInput,
  Clipboard,
  ToastAndroid,
} from 'react-native';
import React, {useCallback, useMemo, useEffect, useState} from 'react';
import {
  settingsStorage,
  cacheStorageService,
  ProviderExtension,
} from '../../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../../lib/zustand/contentStore';
import {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {
  SettingsStackParamList,
  TabStackParamList,
  RootStackParamList,
} from '../../App';
import {
  MaterialCommunityIcons,
  AntDesign,
  Feather,
  MaterialIcons,
  Ionicons,
} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import useWatchHistoryStore from '../../lib/zustand/watchHistrory';
import Animated, {FadeInDown, FadeInUp, Layout} from 'react-native-reanimated';
import {useNavigation} from '@react-navigation/native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

import RenderProviderFlagIcon from '../../components/RenderProviderFLagIcon';
import useAppModeStore from '../../lib/zustand/appModeStore';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Settings'>;

// Notification permission component
const NotificationPrompt = () => {
  const [permissionStatus, setPermissionStatus] = useState<RESULTS | null>(
    null,
  );
  const {primary} = useThemeStore(state => state);

  useEffect(() => {
    const getPermissionStatus = async () => {
      const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
      setPermissionStatus(status);
    };
    getPermissionStatus();
  }, []);

  const requestPermission = async () => {
    const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    setPermissionStatus(result);
    if (result !== RESULTS.GRANTED) {
      Linking.openSettings();
    }
  };

  if (permissionStatus === RESULTS.GRANTED || permissionStatus === null) {
    return null;
  }

  return (
    <View
      className="bg-[#1A1A1A] rounded-xl overflow-hidden mb-3"
      style={{
        marginHorizontal: 20,
      }}>
      <TouchableNativeFeedback
        onPress={requestPermission}
        background={TouchableNativeFeedback.Ripple('#333333', false)}>
        <View className="flex-row items-center justify-between p-4">
          <View className="flex-row items-center">
            <MaterialIcons
              name="notifications-none"
              size={22}
              color={primary}
            />
            <View className="flex-col ml-3">
              <Text className="text-white text-base">Enable Notifications</Text>
              <Text className="text-gray-400 text-xs">
                Receive updates on new content and announcements.
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color="gray" />
        </View>
      </TouchableNativeFeedback>
    </View>
  );
};

// --- WATCH TOGETHER PERSISTENCE ---
const KEY_WATCH_TOGETHER = 'watchTogetherMode';

const getWatchTogetherMode = () => {
  const modeStr = cacheStorageService.getString(KEY_WATCH_TOGETHER);
  return modeStr === 'true' ? true : false;
};

const setWatchTogetherModeStorage = (mode: boolean) => {
  cacheStorageService.setString(KEY_WATCH_TOGETHER, String(mode));
};
// -----------------------------------------------------------

// --- NETWORK PROXY PERSISTENCE ---
const KEY_NETWORK_PROXY = 'networkProxyMode';

const getNetworkProxyMode = () => {
  const modeStr = cacheStorageService.getString(KEY_NETWORK_PROXY);
  return modeStr === 'true' ? true : false;
};

const setNetworkProxyModeStorage = (mode: boolean) => {
  cacheStorageService.setString(KEY_NETWORK_PROXY, String(mode));
};
// -----------------------------------------------------------

// Helper for Internal Navigation
type IconElement = React.ReactElement<{
  size?: number;
  color?: string;
  name: string;
}>;

const InternalOptionRow = React.memo(
  ({
    icon,
    text,
    onPress,
    primaryColor,
    isLast = false,
  }: {
    icon: IconElement;
    text: string;
    onPress: () => void;
    primaryColor: string;
    isLast?: boolean;
  }) => (
    <TouchableNativeFeedback
      onPress={onPress}
      background={TouchableNativeFeedback.Ripple('#333333', false)}>
      <View
        className={`flex-row items-center justify-between p-4 ${
          !isLast ? 'border-b border-[#262626]' : ''
        }`}>
        <View className="flex-row items-center">
          {React.cloneElement(icon, {size: 22, color: primaryColor})}
          <Text className="text-white ml-3 text-base">{text}</Text>
        </View>
        <Feather name="chevron-right" size={20} color="gray" />
      </View>
    </TouchableNativeFeedback>
  ),
);

// Helper for External Links
const ExternalLinkRow = React.memo(
  ({
    icon,
    text,
    url,
    iconColor,
    isLast = false,
  }: {
    icon: IconElement;
    text: string;
    url: string;
    iconColor: string;
    isLast?: boolean;
  }) => (
    <TouchableNativeFeedback
      onPress={() => Linking.openURL(url)}
      background={TouchableNativeFeedback.Ripple('#333333', false)}>
      <View
        className={`flex-row items-center justify-between p-4 ${
          !isLast ? 'border-b border-[#262626]' : ''
        }`}>
        <View className="flex-row items-center">
          {React.cloneElement(icon, {size: 22, color: iconColor})}
          <Text className="text-white ml-3 text-base">{text}</Text>
        </View>
        <Feather name="external-link" size={20} color="gray" />
      </View>
    </TouchableNativeFeedback>
  ),
);

const Settings = ({navigation}: Props) => {
  const tabNavigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {primary} = useThemeStore(state => state);
  const {provider, setProvider, installedProviders} = useContentStore(
    state => state,
  );
  const {clearHistory} = useWatchHistoryStore(state => state);
  const {appMode, setAppMode} = useAppModeStore(state => state);

  // States
  const [watchTogetherMode, setWatchTogetherMode] = useState(
    getWatchTogetherMode(),
  );
  const [networkProxyMode, setNetworkProxyMode] = useState(
    getNetworkProxyMode(),
  );
  const [syncLink, setSyncLink] = useState('');

  const handleProviderSelect = useCallback(
    (item: ProviderExtension) => {
      setProvider(item);
      setAppMode('video');
      if (settingsStorage.isHapticFeedbackEnabled()) {
        ReactNativeHapticFeedback.trigger('virtualKey', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      tabNavigation.navigate('HomeStack');
    },
    [setProvider, tabNavigation, setAppMode],
  );

  const renderProviderItem = useCallback(
    (item: ProviderExtension, isSelected: boolean) => (
      <TouchableOpacity
        key={item.value}
        onPress={() => handleProviderSelect(item)}
        className={`mr-3 rounded-lg ${
          isSelected ? 'bg-[#333333]' : 'bg-[#262626]'
        }`}
        style={{
          width: Dimensions.get('window').width * 0.3,
          height: 65,
          borderWidth: 1.5,
          borderColor: isSelected ? primary : '#333333',
        }}>
        <View className="flex-col items-center justify-center h-full p-2">
          <RenderProviderFlagIcon type={item.type} />
          <Text
            numberOfLines={1}
            className="text-white text-xs font-medium text-center mt-2">
            {item.display_name}
          </Text>
          {isSelected && (
            <Text style={{position: 'absolute', top: 6, right: 6}}>
              <MaterialIcons name="check-circle" size={16} color={primary} />
            </Text>
          )}
        </View>
      </TouchableOpacity>
    ),
    [handleProviderSelect, primary],
  );

  const providersList = useMemo(
    () =>
      installedProviders.map(item =>
        renderProviderItem(item, provider.value === item.value),
      ),
    [installedProviders, provider.value, renderProviderItem],
  );

  const clearCacheHandler = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    cacheStorageService.clearAll();
    ToastAndroid.show('Cache Cleared', ToastAndroid.SHORT);
  }, []);

  const clearHistoryHandler = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    clearHistory();
    ToastAndroid.show('History Cleared', ToastAndroid.SHORT);
  }, [clearHistory]);

  const toggleWatchTogether = useCallback(() => {
    const newState = !watchTogetherMode;
    setWatchTogetherMode(newState);
    setWatchTogetherModeStorage(newState);

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
  }, [watchTogetherMode]);

  // --- PROXY TOGGLE ---
  const toggleNetworkProxy = useCallback(() => {
    const newState = !networkProxyMode;
    setNetworkProxyMode(newState);
    setNetworkProxyModeStorage(newState);

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    ToastAndroid.show(
      newState ? 'Secure Proxy Enabled' : 'Secure Proxy Disabled',
      ToastAndroid.SHORT,
    );
  }, [networkProxyMode]);
  // --------------------

  // --- UPDATED PARSING LOGIC TO PREVENT CRASH ---
  const parseSyncLink = (link: string) => {
    // Helper to extract value by key from a complex URL string
    const getParam = (key: string) => {
      // Matches key=value up to the next & or end of string
      const regex = new RegExp(`${key}=([^&\\n]+)`, 'i');
      const match = link.match(regex);
      return match ? match[1] : null;
    };

    const videoId = getParam('video_id');
    const time = getParam('time');
    const roomId = getParam('roomId');
    const leader = getParam('leader');
    const infoUrl = getParam('infoUrl');
    const providerValue = getParam('providerValue');
    const primaryTitle = getParam('primaryTitle');

    if (videoId && time !== null) {
      return {
        videoId,
        time: parseInt(time, 10),
        roomId,
        leader,
        infoUrl,
        providerValue,
        primaryTitle: primaryTitle
          ? decodeURIComponent(primaryTitle)
          : 'Shared Content',
      };
    }
    return null;
  };

  const handleJoinSession = useCallback(() => {
    const linkToJoin = syncLink.trim();
    if (!linkToJoin) {
      ToastAndroid.show(
        'Please paste a sync link to join.',
        ToastAndroid.SHORT,
      );
      return;
    }

    const parsedData = parseSyncLink(linkToJoin);

    if (parsedData) {
      // Robust Mock Params for Player
      const mockPlayerParams = {
        id: parsedData.videoId,
        // CRITICAL: Pass title from link or fallback
        primaryTitle: parsedData.primaryTitle,
        title: parsedData.primaryTitle,
        link: parsedData.videoId,
        poster: {logo: 'mock_poster_url'},
        linkIndex: 0,
        episodeList: [
          {link: parsedData.videoId, title: parsedData.primaryTitle},
        ],

        // CRITICAL: Pass the provider value from the link so Player uses the correct extractor
        providerValue: parsedData.providerValue || provider.value,
        infoUrl: parsedData.infoUrl,

        // Pass the fallback provider object to satisfy TS, but providerValue above takes precedence in Player
        provider: {
          value: parsedData.providerValue || provider.value,
          type: provider.type,
          display_name: provider.display_name,
          icon: provider.icon,
        } as ProviderExtension,

        type: 'Movie',

        // Watch Together Specifics
        initialSeekTime: parsedData.time,
        syncLink: true, // Boolean true to trigger join logic
        roomId: parsedData.roomId, // CRITICAL: Must pass this!
        leader: parsedData.leader,
        time: parsedData.time,
      };

      try {
        rootNavigation.navigate('Player' as never, mockPlayerParams as never);

        setSyncLink('');
        ToastAndroid.show(
          `Joining session at ${parsedData.time}s`,
          ToastAndroid.LONG,
        );
      } catch (error) {
        console.error('Navigation Crash Error:', error);
        ToastAndroid.show('Failed to join session.', ToastAndroid.LONG);
      }
    } else {
      ToastAndroid.show('Invalid sync link format.', ToastAndroid.LONG);
    }
  }, [syncLink, rootNavigation, provider]);

  const handlePasteLink = useCallback(async () => {
    try {
      const text = await Clipboard.getString();
      if (text && text.includes('video_id=') && text.includes('time=')) {
        setSyncLink(text);
        ToastAndroid.show(
          `Pasted link: ${text.substring(0, 30)}...`,
          ToastAndroid.SHORT,
        );
      } else {
        ToastAndroid.show('No valid sync link found.', ToastAndroid.SHORT);
      }
    } catch (error) {
      ToastAndroid.show('Failed to read from clipboard.', ToastAndroid.SHORT);
    }
  }, []);

  const AnimatedSection = ({
    delay,
    children,
  }: {
    delay: number;
    children: React.ReactNode;
  }) => (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      layout={Layout.springify()}>
      {children}
    </Animated.View>
  );

  return (
    <Animated.ScrollView
      className="w-full h-full bg-black"
      showsVerticalScrollIndicator={false}
      bounces={true}
      overScrollMode="always"
      entering={FadeInUp.springify()}
      layout={Layout.springify()}
      contentContainerStyle={{
        paddingTop: 15,
        paddingBottom: 24,
        flexGrow: 1,
      }}>
      <View className="p-5">
        <Animated.View entering={FadeInUp.springify()}>
          <Text className="text-2xl font-bold text-white mb-6">Settings</Text>
        </Animated.View>

        <AnimatedSection delay={50}>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">App Mode</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="television-play"
                    size={22}
                    color={primary}
                  />
                  <Text className="text-white ml-3 text-base">
                    Vega-TV Mode
                  </Text>
                </View>
                <Switch
                  trackColor={{false: '#767577', true: primary}}
                  thumbColor={appMode === 'vegaTv' ? '#f4f3f4' : '#f4f3f4'}
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={() => {
                    setAppMode('vegaTv');
                    if (settingsStorage.isHapticFeedbackEnabled()) {
                      ReactNativeHapticFeedback.trigger('impactLight', {
                        enableVibrateFallback: true,
                        ignoreAndroidSystemSettings: false,
                      });
                    }
                    tabNavigation.navigate('VegaTVStack');
                  }}
                  value={appMode === 'vegaTv'}
                />
              </View>
            </View>
          </View>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <Text className="text-gray-400 text-sm mb-3 ml-5">Notifications</Text>
          <NotificationPrompt />
        </AnimatedSection>

        {/* --- NEW NETWORK / PROXY SECTION --- */}
        <AnimatedSection delay={120}>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">
              Network & Connection
            </Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center flex-1 pr-2">
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={22}
                    color={primary}
                  />
                  <View className="flex-col ml-3 flex-1">
                    <Text className="text-white text-base">
                      Secure Proxy (VPN Mode)
                    </Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      Bypass ISP blocks (Jio, etc) via DoH.
                    </Text>
                  </View>
                </View>
                <Switch
                  trackColor={{false: '#767577', true: primary}}
                  thumbColor={networkProxyMode ? '#f4f3f4' : '#f4f3f4'}
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={toggleNetworkProxy}
                  value={networkProxyMode}
                />
              </View>
            </View>
          </View>
        </AnimatedSection>
        {/* ----------------------------------- */}

        {appMode === 'video' && (
          <AnimatedSection delay={150}>
            <View className="mb-6 flex-col gap-3">
              <Text className="text-gray-400 text-sm mb-1">
                Content Provider
              </Text>
              <View className="bg-[#1A1A1A] rounded-xl py-4">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 10,
                  }}>
                  {providersList}
                  {installedProviders.length === 0 && (
                    <Text className="text-gray-500 text-sm">
                      No providers installed
                    </Text>
                  )}
                </ScrollView>
              </View>
              <View className="bg-[#1A1A1A] rounded-xl overflow-hidden mb-3">
                <InternalOptionRow
                  icon={<MaterialCommunityIcons name="puzzle" />}
                  text="Provider Manager"
                  onPress={() => navigation.navigate('Extensions')}
                  primaryColor={primary}
                  isLast={true}
                />
              </View>
            </View>
          </AnimatedSection>
        )}

        {/* Watch Together Section */}
        <AnimatedSection delay={200}>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">Watch Together</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                <View className="flex-row items-center">
                  <MaterialIcons name="group" size={22} color={primary} />
                  <Text className="text-white ml-3 text-base">
                    Enable Watch Together Mode
                  </Text>
                </View>
                <Switch
                  trackColor={{false: '#767577', true: primary}}
                  thumbColor={watchTogetherMode ? '#f4f3f4' : '#f4f3f4'}
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={toggleWatchTogether}
                  value={watchTogetherMode}
                />
              </View>

              {watchTogetherMode && (
                <View className="flex-col p-4">
                  <Text className="text-gray-400 text-sm mb-2">
                    Paste Sync Link to Join
                  </Text>
                  <View className="flex-row items-center">
                    <TextInput
                      className="flex-1 bg-white/10 text-white rounded-l-md p-2 h-10"
                      placeholder="e.g., vegaNext://watch/video_id=..."
                      placeholderTextColor="#9CA3AF"
                      value={syncLink}
                      onChangeText={setSyncLink}
                    />
                    <TouchableOpacity
                      className="bg-gray-500 p-2 h-10 justify-center items-center"
                      onPress={handlePasteLink}>
                      <MaterialIcons
                        name="content-paste"
                        size={20}
                        color="white"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="bg-blue-600 rounded-r-md p-2 h-10 justify-center items-center"
                      onPress={handleJoinSession}>
                      <Text className="text-white font-semibold">Join</Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-gray-500 text-xs mt-2">
                    Enabling this mode allows you to create and join
                    synchronized playback sessions.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </AnimatedSection>

        <AnimatedSection delay={250}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">Options</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              <InternalOptionRow
                icon={<MaterialCommunityIcons name="folder-download" />}
                text="Downloads"
                onPress={() => navigation.navigate('Downloads')}
                primaryColor={primary}
              />
              <InternalOptionRow
                icon={<MaterialCommunityIcons name="subtitles" />}
                text="Subtitle Style"
                onPress={() => navigation.navigate('SubTitlesPreferences')}
                primaryColor={primary}
              />
              <InternalOptionRow
                icon={<MaterialCommunityIcons name="history" />}
                text="Watch History"
                onPress={() => navigation.navigate('WatchHistoryStack')}
                primaryColor={primary}
              />
              <InternalOptionRow
                icon={<MaterialIcons name="room-preferences" />}
                text="Preferences"
                onPress={() => navigation.navigate('Preferences')}
                primaryColor={primary}
                isLast={true}
              />
            </View>
          </View>
        </AnimatedSection>

        <AnimatedSection delay={350}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">Data Management</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                <Text className="text-white text-base">Clear Cache</Text>
                <TouchableOpacity
                  className="bg-[#262626] px-4 py-2 rounded-lg"
                  onPress={clearCacheHandler}>
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={20}
                    color={primary}
                  />
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center justify-between p-4">
                <Text className="text-white text-base">
                  Clear Watch History
                </Text>
                <TouchableOpacity
                  className="bg-[#262626] px-4 py-2 rounded-lg"
                  onPress={clearHistoryHandler}>
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={20}
                    color={primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </AnimatedSection>

        <AnimatedSection delay={450}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">About</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              <InternalOptionRow
                icon={<Feather name="info" />}
                text="About"
                onPress={() => navigation.navigate('About')}
                primaryColor={primary}
              />
              <ExternalLinkRow
                icon={<AntDesign name="github" />}
                text="Give a star"
                url="https://github.com/DHR-Store/Vega-Next"
                iconColor={primary}
              />
              <ExternalLinkRow
                icon={<AntDesign name="info" />}
                text="Error and Suggestions"
                url="https://radio-nu-five.vercel.app/"
                iconColor={primary}
              />
              <ExternalLinkRow
                icon={
                  <AntDesign name="customerservice" size={20} color={primary} />
                }
                text="Vega-Next-AI(Help)"
                url="https://vega-next-ai.vercel.app/"
                iconColor={primary}
              />
              <ExternalLinkRow
                icon={<Feather name="music" />}
                text="Kreate"
                url="https://kreate-that.vercel.app/"
                iconColor="white"
              />
              <ExternalLinkRow
                icon={<AntDesign name="heart" />}
                text="Go to DHR-Store"
                url="https://dhr-store.vercel.app/"
                iconColor="#ff69b4"
                isLast={true}
              />
            </View>
          </View>
        </AnimatedSection>
      </View>
    </Animated.ScrollView>
  );
};

export default Settings;
