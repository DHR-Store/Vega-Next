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
  Modal,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import React, {useCallback, useMemo, useEffect, useState, useRef} from 'react';
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
  FontAwesome5, // Added explicitly for Discord
} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import useWatchHistoryStore from '../../lib/zustand/watchHistrory';
import {useNavigation} from '@react-navigation/native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

import RenderProviderFlagIcon from '../../components/RenderProviderFLagIcon';
import useAppModeStore from '../../lib/zustand/appModeStore';
import {MMKV} from '../../lib/Mmkv';
import {DiscordRPC} from '../../lib/services/DiscordRPC';
import {WebView} from 'react-native-webview';
import {userSession, User} from '../../lib/services/login';
import {DeviceEventEmitter} from 'react-native';
import ProfileAvatar from '../../screens/Profileavatar';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Settings'>;

// Helper for cross‑platform toasts
const showToast = (message: string, duration: 'short' | 'long' = 'short') => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(
      message,
      duration === 'short' ? ToastAndroid.SHORT : ToastAndroid.LONG,
    );
  } else {
    alert(message);
  }
};

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

// Simple Wrapper
const Section = ({children}: {children: React.ReactNode}) => (
  <View>{children}</View>
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

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);

  useEffect(() => {
    const loadUser = () => {
      setCurrentUser(userSession.getCurrentUser());
    };

    loadUser();

    const loginSubscription = DeviceEventEmitter.addListener(
      'userLoggedIn',
      loadUser,
    );
    const logoutSubscription = DeviceEventEmitter.addListener(
      'userLoggedOut',
      loadUser,
    );
    const photoSubscription = DeviceEventEmitter.addListener(
      'profilePhotoChanged',
      loadUser,
    );

    const unsubscribeFocus = navigation.addListener('focus', loadUser);

    return () => {
      unsubscribeFocus();
      loginSubscription.remove();
      logoutSubscription.remove();
      photoSubscription.remove();
    };
  }, [navigation]);

  // ==========================================
  // --- DISCORD RPC STATES & LOGIC ---
  // ==========================================
  const [discordToken, setDiscordToken] = useState(
    cacheStorageService.getString('discord_token') || '',
  );
  const [isDiscordConnected, setIsDiscordConnected] = useState(false);
  const [showDiscordLogin, setShowDiscordLogin] = useState(false);

  const [discordUser, setDiscordUser] = useState<{
    username: string;
    avatarUrl: string;
  } | null>(null);

  const webViewRef = useRef<any>(null);

  const injectedScript = `
    (function() {
      var originalXHR = window.XMLHttpRequest.prototype.open;
      var originalSend = window.XMLHttpRequest.prototype.send;
      
      window.XMLHttpRequest.prototype.open = function(method, url) {
          this._url = url;
          return originalXHR.apply(this, arguments);
      };
      
      window.XMLHttpRequest.prototype.send = function() {
          this.addEventListener('load', function() {
              if (this._url && (this._url.includes('/auth/login') || this._url.includes('/auth/mfa'))) {
                  try {
                      var response = JSON.parse(this.responseText);
                      if (response.token) {
                          window.ReactNativeWebView.postMessage(response.token);
                      }
                  } catch(e) {}
              }
          });
          return originalSend.apply(this, arguments);
      };

      var originalSetItem = window.localStorage.setItem;
      window.localStorage.setItem = function(key, value) {
          if (key === 'token' && value && value !== 'null') {
              window.ReactNativeWebView.postMessage(value.replace(/"/g, ''));
          }
          originalSetItem.apply(this, arguments);
      };

      setInterval(function() {
          try {
              window.dispatchEvent(new Event('beforeunload'));
              var t = window.localStorage.getItem('token');
              if (t && t !== 'null') {
                  window.ReactNativeWebView.postMessage(t.replace(/"/g, ''));
              }
          } catch(e) {}
      }, 1000);
    })();
    true;
  `;

  const fetchDiscordUser = async (token: string) => {
    try {
      const cleanToken = token.replace(/^Bearer\s+/i, '');
      const res = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {Authorization: `Bearer ${cleanToken}`},
      });
      if (res.ok) {
        const data = await res.json();
        const defaultAvatarNumber = data.id ? (BigInt(data.id) >> 22n) % 6n : 0;
        const avatarUrl = data.avatar
          ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        setDiscordUser({
          username: data.global_name || data.username,
          avatarUrl,
        });
      }
    } catch (e) {
      console.error('Failed to fetch Discord user', e);
    }
  };

  useEffect(() => {
    if (discordToken) {
      fetchDiscordUser(discordToken);
    }
  }, [discordToken]);
  // ==========================================

  // YouTube states
  const [ytProfilePic, setYtProfilePic] = useState<string | null>(
    MMKV.getString('ytProfilePic') || null,
  );
  const [isYTLoginVisible, setIsYTLoginVisible] = useState(false);
  const [isWebViewReady, setIsWebViewReady] = useState(false);

  const closeYouTubeLogin = () => {
    setIsWebViewReady(false);
    setTimeout(() => {
      setIsYTLoginVisible(false);
    }, 100);
  };

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

  const [aiEnabled, setAiEnabled] = useState(
    MMKV.getBool('isAIEnabled') || false,
  );

  const toggleAiAssistant = useCallback(() => {
    const newState = !aiEnabled;
    setAiEnabled(newState);
    MMKV.setBool('isAIEnabled', newState);
    DeviceEventEmitter.emit('toggleAIAssistant', newState);
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
  }, [aiEnabled]);

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
    showToast('Cache Cleared');
  }, []);

  const clearHistoryHandler = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    clearHistory();
    showToast('History Cleared');
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
    showToast(newState ? 'Secure Proxy Enabled' : 'Secure Proxy Disabled');
  }, [networkProxyMode]);

  const handleGoogleSignIn = async () => {
    setLoginLoading(true);
    try {
      const user = await userSession.signIn();
      setCurrentUser(user);
      showToast(`Welcome ${user.name}!`);
    } catch (err: any) {
      showToast(err?.message ?? 'Sign in failed', 'long');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoginLoading(true);
    try {
      await userSession.signOut();
      setCurrentUser(null);
      showToast('Signed out');
    } catch (err) {
      showToast('Sign out failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const parseSyncLink = (link: string) => {
    const getParam = (key: string) => {
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
      showToast('Please paste a sync link to join.');
      return;
    }

    const parsedData = parseSyncLink(linkToJoin);
    if (parsedData) {
      const mockPlayerParams = {
        id: parsedData.videoId,
        primaryTitle: parsedData.primaryTitle,
        title: parsedData.primaryTitle,
        link: parsedData.videoId,
        poster: {logo: 'mock_poster_url'},
        linkIndex: 0,
        episodeList: [
          {link: parsedData.videoId, title: parsedData.primaryTitle},
        ],
        providerValue: parsedData.providerValue || provider.value,
        infoUrl: parsedData.infoUrl,
        provider: {
          value: parsedData.providerValue || provider.value,
          type: provider.type,
          display_name: provider.display_name,
          icon: provider.icon,
        } as ProviderExtension,
        type: 'Movie',
        initialSeekTime: parsedData.time,
        syncLink: true,
        roomId: parsedData.roomId,
        leader: parsedData.leader,
        time: parsedData.time,
      };

      try {
        rootNavigation.navigate('Player' as never, mockPlayerParams as never);
        setSyncLink('');
        showToast(`Joining session at ${parsedData.time}s`, 'long');
      } catch (error) {
        console.error('Navigation Crash Error:', error);
        showToast('Failed to join session.', 'long');
      }
    } else {
      showToast('Invalid sync link format.', 'long');
    }
  }, [syncLink, rootNavigation, provider]);

  const handlePasteLink = useCallback(async () => {
    try {
      const text = await Clipboard.getString();
      if (text && text.includes('video_id=') && text.includes('time=')) {
        setSyncLink(text);
        showToast(`Pasted link: ${text.substring(0, 30)}...`);
      } else {
        showToast('No valid sync link found.');
      }
    } catch (error) {
      showToast('Failed to read from clipboard.');
    }
  }, []);

  return (
    <ScrollView
      className="w-full h-full bg-black"
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
      contentContainerStyle={{
        paddingTop: 15,
        paddingBottom: 24,
        flexGrow: 1,
      }}>
      <View className="p-5">
        <View>
          <Text className="text-2xl font-bold text-white mb-6">Settings</Text>
        </View>

        {/* Top right account avatar */}
        <View className="absolute top-4 right-4 z-50">
          {currentUser ? (
            <View className="items-end">
              <TouchableOpacity
                onPress={() => setShowLogoutMenu(!showLogoutMenu)}
                activeOpacity={0.7}>
                <View pointerEvents="none">
                  <ProfileAvatar size={40} editable={false} />
                </View>
              </TouchableOpacity>
              {showLogoutMenu && (
                <TouchableOpacity
                  onPress={() => {
                    setShowLogoutMenu(false);
                    handleSignOut();
                  }}
                  disabled={loginLoading}
                  className="mt-2 bg-[#1A1A1A] border border-[#333] px-4 py-2 rounded-lg shadow-lg flex-row items-center justify-center">
                  {loginLoading ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text className="text-red-500 font-bold text-sm">
                      Sign Out
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              className="w-10 h-10 rounded-full bg-white justify-center items-center shadow-md">
              <Image
                source={{
                  uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.png',
                }}
                style={{width: 20, height: 20}}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* App Mode */}
        <Section>
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
        </Section>

        <Section>
          <Text className="text-gray-400 text-sm mb-3 ml-5">Notifications</Text>
          <NotificationPrompt />
        </Section>

        {/* Network & Connection */}
        <Section>
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
        </Section>

        {/* Content Provider (only in video mode) */}
        {appMode === 'video' && (
          <Section>
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
                <InternalOptionRow
                  icon={<MaterialCommunityIcons name="shield-check-outline" />}
                  text="Provider Checker"
                  onPress={() => navigation.navigate('ProviderCheck')}
                  primaryColor={primary}
                  isLast={true}
                />
              </View>
            </View>
          </Section>
        )}

        {/* Watch Together */}
        <Section>
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
        </Section>

        {/* Discord RPC Integration UI */}
        <Section>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">Integrations</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden p-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  {/* FIXED: Switched MaterialCommunityIcons to FontAwesome5 for discord */}
                  <FontAwesome5 name="discord" size={22} color="#5865F2" />
                  <Text className="text-white ml-3 text-base font-medium">
                    Discord Rich Presence
                  </Text>
                </View>

                {/* Display Profile Picture if logged in */}
                {discordUser && (
                  <Image
                    source={{uri: discordUser.avatarUrl}}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: '#5865F2',
                    }}
                  />
                )}
              </View>

              <Text className="text-gray-400 text-xs mb-4">
                {discordUser
                  ? `Logged in as ${discordUser.username}. Your watching status will update automatically.`
                  : 'Login with your Discord account to show the movies you are watching on your profile.'}
              </Text>

              <TouchableOpacity
                style={{
                  backgroundColor: discordToken ? '#ef4444' : '#5865F2',
                  padding: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
                onPress={() => {
                  if (discordToken) {
                    DiscordRPC.disconnect();
                    setIsDiscordConnected(false);
                    setDiscordToken('');
                    setDiscordUser(null);
                    cacheStorageService.setString('discord_token', '');
                    ToastAndroid.show(
                      'Logged out of Discord',
                      ToastAndroid.SHORT,
                    );
                  } else {
                    setShowDiscordLogin(true);
                  }
                }}>
                <Text className="text-white font-bold">
                  {discordToken ? 'Disconnect' : 'Login to Discord'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* DISCORD LOGIN MODAL */}
        <Modal
          visible={showDiscordLogin}
          animationType="slide"
          onRequestClose={() => setShowDiscordLogin(false)}>
          <View style={{flex: 1, backgroundColor: '#36393f'}}>
            <View className="p-4 bg-[#2f3136] flex-row justify-between items-center">
              <Text className="text-white font-bold text-lg">
                Login to Discord
              </Text>
              <TouchableOpacity onPress={() => setShowDiscordLogin(false)}>
                <AntDesign name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <WebView
              ref={webViewRef}
              source={{uri: 'https://discord.com/login'}}
              injectedJavaScript={injectedScript}
              incognito={true}
              cacheEnabled={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onNavigationStateChange={navState => {
                if (
                  navState.url.includes('/app') ||
                  navState.url.includes('/channels')
                ) {
                  webViewRef.current?.injectJavaScript(injectedScript);
                }
              }}
              onMessage={event => {
                const extractedToken = event.nativeEvent.data;
                // Double check it's a valid token format
                if (
                  extractedToken &&
                  extractedToken.length > 30 &&
                  extractedToken !== 'null'
                ) {
                  // 1. Immediately close the UI modal
                  setShowDiscordLogin(false);

                  // 2. Save token states
                  setDiscordToken(extractedToken);
                  cacheStorageService.setString(
                    'discord_token',
                    extractedToken,
                  );

                  // 3. Fetch user data (updates profile pic)
                  fetchDiscordUser(extractedToken);

                  // 4. Connect to RPC
                  if (DiscordRPC && typeof DiscordRPC.connect === 'function') {
                    DiscordRPC.connect(extractedToken);
                    setIsDiscordConnected(true);
                  }

                  // 5. Success Message
                  ToastAndroid.show(
                    'Successfully connected to Discord!',
                    ToastAndroid.LONG,
                  );
                }
              }}
            />
          </View>
        </Modal>

        {/* YouTube Integration */}
        <Section>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">YouTube</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden p-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  {ytProfilePic ? (
                    <Image
                      source={{uri: ytProfilePic}}
                      style={{width: 32, height: 32, borderRadius: 16}}
                    />
                  ) : (
                    <AntDesign name="youtube" size={22} color="#FF0000" />
                  )}
                  <Text className="text-white ml-3 text-base font-medium">
                    {ytProfilePic
                      ? 'YouTube Account Connected'
                      : 'YouTube Account & Mod'}
                  </Text>
                </View>

                {ytProfilePic && (
                  <TouchableOpacity
                    onPress={() => {
                      setYtProfilePic(null);
                      MMKV.delete('ytProfilePic');
                      showToast('Logged out of YouTube Mod');
                    }}>
                    <Text className="text-red-500 text-xs font-bold">
                      Logout
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text className="text-gray-400 text-xs mb-4">
                Access YouTube with background play, ad‑blocking, and media
                extraction powered by YTPRO. Sign in to your account directly.
              </Text>

              <View style={{flexDirection: 'row', gap: 10}}>
                {!ytProfilePic ? (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#333333',
                      padding: 12,
                      borderRadius: 8,
                      alignItems: 'center',
                      flex: 1,
                    }}
                    onPress={() => {
                      if (settingsStorage.isHapticFeedbackEnabled()) {
                        ReactNativeHapticFeedback.trigger('impactLight');
                      }
                      setIsYTLoginVisible(true);
                    }}>
                    <Text className="text-white font-bold">
                      Login to YouTube
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#FF0000',
                      padding: 12,
                      borderRadius: 8,
                      alignItems: 'center',
                      flex: 1,
                    }}
                    onPress={() => {
                      if (settingsStorage.isHapticFeedbackEnabled()) {
                        ReactNativeHapticFeedback.trigger('impactLight');
                      }
                      navigation.navigate('YTHome');
                    }}>
                    <Text className="text-white font-bold">Open YouTube</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Section>

        {/* YouTube Login Modal */}
        <Modal
          visible={isYTLoginVisible}
          animationType="slide"
          transparent={false}
          presentationStyle="fullScreen"
          onShow={() => setIsWebViewReady(true)}
          onRequestClose={closeYouTubeLogin}>
          <View style={{flex: 1, backgroundColor: 'black'}}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 15,
                backgroundColor: '#1A1A1A',
                borderBottomWidth: 1,
                borderBottomColor: '#333',
              }}>
              <TouchableOpacity
                onPress={closeYouTubeLogin}
                style={{paddingRight: 15}}>
                <AntDesign name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text style={{color: 'white', fontSize: 18, fontWeight: 'bold'}}>
                Login to YouTube
              </Text>
            </View>

            {isWebViewReady ? (
              <WebView
                style={{flex: 1, backgroundColor: 'black', opacity: 0.99}}
                source={{
                  uri: 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https://m.youtube.com/',
                }}
                userAgent="Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                thirdPartyCookiesEnabled={true}
                sharedCookiesEnabled={true}
                domStorageEnabled={true}
                javaScriptEnabled={true}
                setSupportMultipleWindows={false}
                startInLoadingState={true}
                onMessage={event => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'YT_LOGIN_SUCCESS') {
                      setYtProfilePic(data.pp);
                      MMKV.setString('ytProfilePic', data.pp);
                      closeYouTubeLogin();
                      showToast('Successfully logged in!');
                    }
                  } catch (e) {
                    console.log('Error parsing WebView message', e);
                  }
                }}
                injectedJavaScript={`
                  setInterval(function() {
                    if (window !== window.top) return;
                    if (window.location.hostname === 'm.youtube.com' || window.location.hostname === 'www.youtube.com') {
                      var signInBtn = document.querySelector('a[href*="ServiceLogin"]') || document.querySelector('.ytm-btn-sync');
                      if (signInBtn) return;
                      var img = document.querySelector('ytm-profile-icon img') || 
                                document.querySelector('#avatar-btn img');
                      if (img && img.src && (img.src.includes('ggpht.com') || img.src.includes('googleusercontent.com'))) {
                        if (!img.src.includes('default_avatar')) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({ 
                            type: 'YT_LOGIN_SUCCESS', 
                            pp: img.src 
                          }));
                        }
                      }
                    }
                  }, 2000);
                  true;
                `}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  backgroundColor: 'black',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <ActivityIndicator size="large" color="#FF0000" />
              </View>
            )}
          </View>
        </Modal>

        {/* Options */}
        <Section>
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
        </Section>

        {/* Vega‑Next AI */}
        <Section>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">Vega-Next AI</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center flex-1 pr-2">
                  <MaterialCommunityIcons
                    name="robot-outline"
                    size={22}
                    color={primary}
                  />
                  <View className="flex-col ml-3 flex-1">
                    <Text className="text-white text-base">
                      Enable Vega-Next AI
                    </Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      Smart assistant for movies and entertainment
                    </Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('ChatHistory')}
                      activeOpacity={0.8}
                      style={{
                        backgroundColor: '#FFFFFF',
                        paddingVertical: 12,
                        paddingHorizontal: 18,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginVertical: 10,
                        shadowColor: '#000',
                        shadowOffset: {width: 0, height: 2},
                        shadowOpacity: 0.2,
                        shadowRadius: 3,
                        elevation: 4,
                      }}>
                      <Text
                        style={{
                          color: '#000',
                          fontSize: 14,
                          fontWeight: '600',
                          letterSpacing: 0.5,
                        }}>
                        View AI Chat History
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Switch
                  trackColor={{false: '#767577', true: primary}}
                  thumbColor={aiEnabled ? '#f4f3f4' : '#f4f3f4'}
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={toggleAiAssistant}
                  value={aiEnabled}
                />
              </View>
            </View>
          </View>
        </Section>

        {/* Data Management */}
        <Section>
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
        </Section>

        {/* About */}
        <Section>
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
              {/* FIXED: 'infocirlceo' to 'infocircleo' */}
              <ExternalLinkRow
                icon={<AntDesign name="infocircleo" />}
                text="Error and Suggestions"
                url="https://radio-nu-five.vercel.app/"
                iconColor={primary}
              />
              {/* FIXED: using MaterialIcons valid name support-agent */}
              <ExternalLinkRow
                icon={
                  <MaterialIcons
                    name="support-agent"
                    size={20}
                    color={primary}
                  />
                }
                text="Vega-Next-AI (Help)"
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
        </Section>
      </View>
    </ScrollView>
  );
};

export default Settings;
