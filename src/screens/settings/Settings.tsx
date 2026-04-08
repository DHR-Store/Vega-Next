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
  SafeAreaView,
  ActivityIndicator,
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
import Login from '../../screens/Login';
import {DeviceEventEmitter} from 'react-native';
import ProfileAvatar from '../../screens/Profileavatar';

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

// Simple Wrapper to replace AnimatedSection
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

    // Listen for login events from the Login screen
    const loginSubscription = DeviceEventEmitter.addListener(
      'userLoggedIn',
      loadUser,
    );
    const logoutSubscription = DeviceEventEmitter.addListener(
      'userLoggedOut',
      loadUser,
    );
    // Add photo change listener
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

  // Store the user's profile info
  const [discordUser, setDiscordUser] = useState<{
    username: string;
    avatarUrl: string;
  } | null>(null);

  const webViewRef = useRef<any>(null);

  // THE FIX: This script intercepts the raw network request during login
  // and intercepts localStorage being set, guaranteeing we catch the token.
  const injectedScript = `
    (function() {
      // 1. Intercept Network Requests (Catches the login API response)
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

      // 2. Intercept LocalStorage (Catches the exact moment Discord saves the token)
      var originalSetItem = window.localStorage.setItem;
      window.localStorage.setItem = function(key, value) {
          if (key === 'token' && value && value !== 'null') {
              window.ReactNativeWebView.postMessage(value.replace(/"/g, ''));
          }
          originalSetItem.apply(this, arguments);
      };

      // 3. Fallback: The classic beforeunload trigger
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

  // Function to fetch user info from Discord using the token
  const fetchDiscordUser = async (token: string) => {
    try {
      const res = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {Authorization: token},
      });
      if (res.ok) {
        const data = await res.json();

        // FIXED: Removed all the \ characters from the template strings
        const avatarUrl = data.avatar
          ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(data.discriminator || '0') % 5
            }.png`;

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

  // Add this near your other state variables
  const [ytProfilePic, setYtProfilePic] = useState<string | null>(
    MMKV.getString('ytProfilePic') || null,
  );
  const [isYTLoginVisible, setIsYTLoginVisible] = useState(false);
  const [isWebViewReady, setIsWebViewReady] = useState(false);

  const closeYouTubeLogin = () => {
    setIsWebViewReady(false); // 1. Unmount the WebView safely first
    setTimeout(() => {
      setIsYTLoginVisible(false); // 2. Close the modal after a tiny delay
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

  // Use getBool from your local wrapper
  const [aiEnabled, setAiEnabled] = useState(
    MMKV.getBool('isAIEnabled') || false,
  );

  const toggleAiAssistant = useCallback(() => {
    const newState = !aiEnabled;
    setAiEnabled(newState);

    // FIX: Use setBool() instead of set()
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

  const handleGoogleSignIn = async () => {
    setLoginLoading(true);
    try {
      const user = await userSession.signIn();
      setCurrentUser(user);
      ToastAndroid.show(`Welcome ${user.name}!`, ToastAndroid.SHORT);
    } catch (err: any) {
      const message = err?.message ?? 'Sign in failed';
      ToastAndroid.show(message, ToastAndroid.LONG);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoginLoading(true);
    try {
      await userSession.signOut();
      setCurrentUser(null);
      ToastAndroid.show('Signed out', ToastAndroid.SHORT);
    } catch (err) {
      ToastAndroid.show('Sign out failed', ToastAndroid.SHORT);
    } finally {
      setLoginLoading(false);
    }
  };

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

  return (
    <ScrollView
      className="w-full h-full bg-black"
      showsVerticalScrollIndicator={false}
      overScrollMode="never" // Better visual experience on Android
      removeClippedSubviews={true} // Performance optimization
      contentContainerStyle={{
        paddingTop: 15,
        paddingBottom: 24,
        flexGrow: 1,
      }}>
      <View className="p-5">
        <View>
          <Text className="text-2xl font-bold text-white mb-6">Settings</Text>
        </View>

        {/* ========== TOP RIGHT ACCOUNT AVATAR ========== */}

        <View className="absolute top-4 right-4 z-50">
          {currentUser ? (
            // LOGGED IN: Container for Avatar and Logout Menu
            <View className="items-end">
              {/* 1. Clickable Avatar to toggle the menu */}
              <TouchableOpacity
                onPress={() => setShowLogoutMenu(!showLogoutMenu)}
                activeOpacity={0.7}>
                <View pointerEvents="none">
                  <ProfileAvatar
                    size={40}
                    // Disabled so it triggers the menu instead of the photo picker
                    editable={false}
                  />
                </View>
              </TouchableOpacity>

              {/* 2. Logout Option Dropdown (Shows when avatar is clicked) */}
              {showLogoutMenu && (
                <TouchableOpacity
                  onPress={() => {
                    setShowLogoutMenu(false); // Hide menu
                    handleSignOut(); // Trigger your sign out function
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
            // LOGGED OUT: Navigate to Login.tsx screen
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

        {/* --- NETWORK / PROXY SECTION --- */}
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
        {/* ----------------------------------- */}

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
                  onPress={() => navigation.navigate('ProviderCheck' as any)}
                  primaryColor={primary}
                  isLast={true} // 👈 This is now the last item
                />
              </View>
            </View>
          </Section>
        )}

        {/* Watch Together Section */}
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

        {/* --- DISCORD RPC INTEGRATION UI --- */}
        <Section>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">Integrations</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden p-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="discord"
                    size={22}
                    color="#5865F2"
                  />
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

        {/* --- DISCORD LOGIN MODAL --- */}
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
        {/* ------------------------------- */}

        {/* --- YOUTUBE INTEGRATION (YTPRO) SECTION --- */}
        <Section>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">YouTube</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden p-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  {/* Show Profile Picture if available, otherwise show YouTube Icon */}
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

                {/* Logout button if profile pic exists */}
                {ytProfilePic && (
                  <TouchableOpacity
                    onPress={() => {
                      setYtProfilePic(null);
                      if (typeof MMKV.delete === 'function') {
                        MMKV.delete('ytProfilePic');
                      }
                      ToastAndroid.show(
                        'Logged out of YouTube Mod',
                        ToastAndroid.SHORT,
                      );
                    }}>
                    <Text className="text-red-500 text-xs font-bold">
                      Logout
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text className="text-gray-400 text-xs mb-4">
                Access YouTube with background play, ad-blocking, and media
                extraction powered by YTPRO. Sign in to your account directly.
              </Text>

              <View style={{flexDirection: 'row', gap: 10}}>
                {/* CONDITIONAL RENDERING */}
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
                      navigation.navigate('YTHome' as never);
                    }}>
                    <Text className="text-white font-bold">Open YouTube</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Section>
        {/* ------------------------------------------- */}

        {/* YOUTUBE LOGIN MODAL */}
        <Modal
          visible={isYTLoginVisible}
          animationType="slide"
          transparent={false}
          presentationStyle="fullScreen"
          onShow={() => setIsWebViewReady(true)}
          onRequestClose={closeYouTubeLogin}>
          <View style={{flex: 1, backgroundColor: 'black'}}>
            {/* Header */}
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

            {/* Login WebView (Only renders when Modal is fully open) */}
            {isWebViewReady ? (
              <WebView
                style={{flex: 1, backgroundColor: 'black', opacity: 0.99}}
                source={{
                  uri: 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https://m.youtube.com/',
                }}
                userAgent="Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                thirdPartyCookiesEnabled={true}
                sharedCookiesEnabled={true} // <-- IMPORTANT: Shares auth cookies with YTHome
                domStorageEnabled={true}
                javaScriptEnabled={true}
                setSupportMultipleWindows={false}
                startInLoadingState={true}
                onMessage={event => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'YT_LOGIN_SUCCESS') {
                      setYtProfilePic(data.pp);

                      if (typeof MMKV.setString === 'function') {
                        MMKV.setString('ytProfilePic', data.pp);
                      } else {
                        MMKV.set('ytProfilePic', data.pp);
                      }

                      closeYouTubeLogin();
                      ToastAndroid.show(
                        'Successfully logged in!',
                        ToastAndroid.SHORT,
                      );
                    }
                  } catch (e) {
                    console.log('Error parsing WebView message', e);
                  }
                }}
                injectedJavaScript={`
    setInterval(function() {
      // 1. Prevent running in background hidden iframes
      if (window !== window.top) return;

      // 2. Only execute on YouTube domains
      if (window.location.hostname === 'm.youtube.com' || window.location.hostname === 'www.youtube.com') {
        
        // 3. Make sure the 'Sign in' button is completely gone. 
        // If it exists, the user is NOT fully logged in yet.
        var signInBtn = document.querySelector('a[href*="ServiceLogin"]') || document.querySelector('.ytm-btn-sync');
        if (signInBtn) return;

        // 4. Find the authenticated profile picture safely
        var img = document.querySelector('ytm-profile-icon img') || 
                  document.querySelector('#avatar-btn img');
        
        // Ensure it's not a generic grey silhouette avatar
        if (img && img.src && (img.src.includes('ggpht.com') || img.src.includes('googleusercontent.com'))) {
          if (!img.src.includes('default_avatar')) {
             window.ReactNativeWebView.postMessage(JSON.stringify({ 
               type: 'YT_LOGIN_SUCCESS', 
               pp: img.src 
             }));
          }
        }
      }
    }, 2000); // Check every 2 seconds to allow the page to settle
    true;
  `}
              />
            ) : (
              /* Temporary Loading State while Modal animates */
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

        {/* Vega-Next AI Section */}
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

                        // Shadow (iOS)
                        shadowColor: '#000',
                        shadowOffset: {width: 0, height: 2},
                        shadowOpacity: 0.2,
                        shadowRadius: 3,

                        // Elevation (Android)
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
        </Section>
      </View>
    </ScrollView>
  );
};

export default Settings;
