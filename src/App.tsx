// App.tsx
import 'react-native-gesture-handler'; // MUST BE AT THE VERY TOP
import 'react-native-reanimated';
import React, {useEffect, useState, useCallback} from 'react';
// Updated OneSignal import for Expo 54+
import {OneSignal, LogLevel} from 'react-native-onesignal';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Linking,
  LogBox,
  Platform,
  DeviceEventEmitter,
  useWindowDimensions,
  Image as RNImage,
  AppState,
} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

import Home from './screens/home/Home';
import Info from './screens/home/Info';
import Player from './screens/home/Player';
import Settings from './screens/settings/Settings';
import WatchList from './screens/WatchList';
import Search from './screens/Search';
import ScrollList from './screens/ScrollList';
import {
  NavigationContainer,
  NavigatorScreenParams,
} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import Entypo from '@expo/vector-icons/Entypo';
import WebView from './screens/WebView';
import SearchResults from './screens/SearchResults';
import * as SystemUI from 'expo-system-ui';
import About, {checkForUpdate} from './screens/settings/About';
import BootSplash from 'react-native-bootsplash';
import {enableFreeze, enableScreens} from 'react-native-screens';
import Preferences from './screens/settings/Preference';
import useThemeStore from './lib/zustand/themeStore';
import {EpisodeLink} from './lib/providers/types';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import TabBarBackgound from './components/TabBarBackgound';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Downloads from './screens/settings/Downloads';
import SeriesEpisodes from './screens/settings/SeriesEpisodes';
import WatchHistory from './screens/WatchHistory';
import SubtitlePreference from './screens/settings/SubtitleSettings';
import Extensions from './screens/settings/Extensions';
import {settingsStorage} from './lib/storage';
import {updateProvidersService} from './lib/services/UpdateProviders';
import {EventDetail, EventType} from '@notifee/react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {downloadFolder} from './lib/constants';
import {cancelHlsDownload} from './lib/hlsDownloader2';
import {QueryClientProvider} from '@tanstack/react-query';
import {queryClient} from './lib/client';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import notifee from '@notifee/react-native';
import {
  checkAppInstallPermission,
  requestAppInstallPermission,
} from 'react-native-install-unknown-apps';
import LiveTVScreen from './screens/tv/LiveTVScreen';
import TVPlayerScreen from './screens/tv/TVPlayerScreen';
import useAppModeStore from './lib/zustand/appModeStore';
import VegaTVSettingsScreen from './screens/tv/VegaTVSettingsScreen';
import * as Application from 'expo-application';
import Suggestion from './screens/Suggestion';
import FloatingCommunityButton from './components/FloatingCommunityButton';
import {MMKV} from './lib/Mmkv';
import CastMovie from './screens/CastMovie';
import Onboarding from './screens/Onboarding';
import {useNavigationContainerRef} from '@react-navigation/native';
import AI from './components/AI';
import ChatHistory from './screens/ChatHistory';
import AddExtension from './screens/AddExtension';
import ProviderCheck from './screens/settings/ProviderCheck';
import Login from './screens/Login';
import {userSession, User} from './lib/services/login';
import {downloadManager} from './lib/services/DownloadManager';
import CommunityScreen from './screens/Community';
import AppLock from './components/AppLock'; // Adjust path if necessary

enableScreens(true);
enableFreeze(true);

/* ----------------- Navigation Types ----------------- */
export type HomeStackParamList = {
  Home: undefined;
  Info: {link: string; provider?: string; poster?: string};
  ScrollList: {
    filter: string;
    title?: string;
    providerValue?: string;
    isSearch?: boolean;
  };
  GenreList: {
    filter: string;
    title?: string;
    providerValue?: string;
    genre: string;
  };
  Webview: {link: string};
};

export type VegaTVStackParamList = {
  LiveTVScreen: undefined;
  TVPlayerScreen: {streamUrl: string};
  VegaTVSettingsScreen: undefined;
};

export type TVRootStackParamList = {
  VegaTVStack: NavigatorScreenParams<VegaTVStackParamList>;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  MainStack: undefined;
  TabStack: NavigatorScreenParams<TabStackParamList>;
  TVRootStack: NavigatorScreenParams<TVRootStackParamList>;
  Player: {
    linkIndex: number;
    episodeList: EpisodeLink[];
    directUrl?: string;
    type: string;
    primaryTitle?: string;
    secondaryTitle?: string;
    poster: {logo?: string; poster?: string; background?: string};
    file?: string;
    providerValue?: string;
    infoUrl?: string;
  };
  WatchTrailer: {link?: string; videoId?: string};
  CastMovie: {castId: number; castName: string};
  ChatHistory: undefined;
};

export type SearchStackParamList = {
  Search: undefined;
  ScrollList: {
    filter: string;
    title?: string;
    providerValue?: string;
    isSearch?: boolean;
  };
  GenreList: {
    filter: string;
    title?: string;
    providerValue?: string;
    genre: string;
  };
  Info: {link: string; provider?: string; poster?: string};
  SearchResults: {filter: string; availableProviders?: string[]};
  Webview: {link: string};
  Suggestion: undefined;
};

export type WatchListStackParamList = {
  WatchList: undefined;
  Info: {link: string; provider?: string; poster?: string};
};

export type WatchHistoryStackParamList = {
  WatchHistory: undefined;
  Info: {link: string; provider?: string; poster?: string};
  SeriesEpisodes: {
    series: string;
    episodes: Array<{uri: string; size: number}>;
    thumbnails: Record<string, string>;
  };
};

export type SettingsStackParamList = {
  Settings: undefined;
  DisableProviders: undefined;
  About: undefined;
  Preferences: undefined;
  Downloads: undefined;
  WatchHistoryStack: undefined;
  SubTitlesPreferences: undefined;
  Extensions: undefined;
  AddExtension: undefined;
  ProviderCheck: undefined;
};

export type TabStackParamList = {
  HomeStack: undefined;
  SearchStack: undefined;
  WatchListStack: undefined;
  SettingsStack: NavigatorScreenParams<SettingsStackParamList>;
};

/* ----------------- Create navigators ----------------- */
const Tab = createBottomTabNavigator<TabStackParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const WatchListStack = createNativeStackNavigator<WatchListStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const WatchHistoryStack =
  createNativeStackNavigator<WatchHistoryStackParamList>();
const CommunityStack = createNativeStackNavigator();
const TVRootStack = createNativeStackNavigator<TVRootStackParamList>();
const VegaTVStack = createNativeStackNavigator<VegaTVStackParamList>();

/* ----------------- Custom TabBarButton ----------------- */
function CustomTabBarButton(props: any) {
  const handlePress = useCallback(
    (e: any) => {
      props.onPress?.(e);
      if (
        !props?.accessibilityState?.selected &&
        settingsStorage.isHapticFeedbackEnabled()
      ) {
        RNReactNativeHapticFeedback.trigger('effectTick', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
    },
    [props.onPress, props.accessibilityState?.selected],
  );

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={props.accessibilityState}
      style={props.style}
      activeOpacity={0.7}
      onPress={handlePress}>
      {props.children}
    </TouchableOpacity>
  );
}

/* ----------------- Stack screens ----------------- */
function HomeStackScreen() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
      }}>
      <HomeStack.Screen name="Home" component={Home} />
      <HomeStack.Screen name="Info" component={Info} />
      <HomeStack.Screen name="ScrollList" component={ScrollList} />
      <HomeStack.Screen name="GenreList" component={ScrollList} />
      <HomeStack.Screen name="Webview" component={WebView} />
    </HomeStack.Navigator>
  );
}

function SearchStackScreen() {
  return (
    <SearchStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
      }}>
      <SearchStack.Screen name="Search" component={Search} />
      <SearchStack.Screen name="ScrollList" component={ScrollList} />
      <SearchStack.Screen name="GenreList" component={ScrollList} />
      <SearchStack.Screen name="Info" component={Info} />
      <SearchStack.Screen name="Suggestion" component={Suggestion} />
      <SearchStack.Screen name="SearchResults" component={SearchResults} />
      <SearchStack.Screen name="Webview" component={WebView} />
    </SearchStack.Navigator>
  );
}

function WatchListStackScreen() {
  return (
    <WatchListStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
      }}>
      <WatchListStack.Screen name="WatchList" component={WatchList} />
      <WatchListStack.Screen name="Info" component={Info} />
    </WatchListStack.Navigator>
  );
}

function WatchHistoryStackScreen() {
  return (
    <WatchHistoryStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
      }}>
      <WatchHistoryStack.Screen name="WatchHistory" component={WatchHistory} />
      <WatchHistoryStack.Screen name="Info" component={Info} />
      <WatchHistoryStack.Screen
        name="SeriesEpisodes"
        component={SeriesEpisodes}
      />
    </WatchHistoryStack.Navigator>
  );
}

function CommunityStackScreen() {
  return (
    <CommunityStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
      }}>
      <CommunityStack.Screen name="CommunityMain" component={CommunityScreen} />
    </CommunityStack.Navigator>
  );
}

function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
      }}>
      <SettingsStack.Screen name="Settings" component={Settings} />
      <SettingsStack.Screen name="About" component={About} />
      <SettingsStack.Screen name="Preferences" component={Preferences} />
      <SettingsStack.Screen name="Downloads" component={Downloads} />
      <SettingsStack.Screen name="Extensions" component={Extensions} />
      <SettingsStack.Screen name="AddExtension" component={AddExtension} />
      <SettingsStack.Screen name="ProviderCheck" component={ProviderCheck} />
      <SettingsStack.Screen
        name="WatchHistoryStack"
        component={WatchHistoryStackScreen}
      />
      <SettingsStack.Screen
        name="SubTitlesPreferences"
        component={SubtitlePreference}
      />
    </SettingsStack.Navigator>
  );
}

function VegaTVStackNavigator() {
  return (
    <VegaTVStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
        contentStyle: {backgroundColor: 'transparent'},
      }}>
      <VegaTVStack.Screen name="LiveTVScreen" component={LiveTVScreen} />
      <VegaTVStack.Screen name="TVPlayerScreen" component={TVPlayerScreen} />
      <VegaTVStack.Screen
        name="VegaTVSettingsScreen"
        component={VegaTVSettingsScreen}
      />
    </VegaTVStack.Navigator>
  );
}

/* ----------------- Tab stack ----------------- */
function TabStackScreen() {
  const {primary} = useThemeStore(state => state);
  const {width} = useWindowDimensions();
  const isLargeScreen = width > 768;
  const [showTabBarLabels, setShowTabBarLabels] = useState(
    () => MMKV.getBool('showTabBarLables') ?? false,
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const updateSession = () => setCurrentUser(userSession.getCurrentUser());

    updateSession();

    const loginSub = DeviceEventEmitter.addListener(
      'userLoggedIn',
      updateSession,
    );
    const logoutSub = DeviceEventEmitter.addListener(
      'userLoggedOut',
      updateSession,
    );
    const photoSub = DeviceEventEmitter.addListener(
      'profilePhotoChanged',
      updateSession,
    );
    const labelSub = DeviceEventEmitter.addListener(
      'changeTabBarLabel',
      newValue => {
        setShowTabBarLabels(newValue === true || newValue === 'true');
      },
    );

    return () => {
      loginSub.remove();
      logoutSub.remove();
      photoSub.remove();
      labelSub.remove();
    };
  }, []);

  return (
    <Tab.Navigator
      detachInactiveScreens={false} // Keep all tabs in memory for smooth switching
      screenOptions={{
        animation: 'shift',
        tabBarLabelPosition: 'below-icon',
        tabBarVariant: isLargeScreen ? 'material' : 'uikit',
        popToTopOnBlur: false,
        tabBarPosition: isLargeScreen ? 'left' : 'bottom',
        headerShown: false,
        tabBarActiveTintColor: primary,
        tabBarInactiveTintColor: '#dadde3',
        tabBarShowLabel: showTabBarLabels,
        tabBarStyle: !isLargeScreen
          ? {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: showTabBarLabels ? 70 : 45,
              backgroundColor: 'transparent',
              borderRadius: 0,
              overflow: 'visible',
              elevation: 0,
              borderTopWidth: 0,
              paddingHorizontal: 0,
              paddingTop: 5,
              paddingBottom: showTabBarLabels ? 5 : 0,
            }
          : {},
        tabBarBackground: () => <TabBarBackgound />,
        tabBarHideOnKeyboard: true,
        tabBarButton: CustomTabBarButton,
      }}>
      <Tab.Screen
        name="HomeStack"
        component={HomeStackScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({focused, color, size}) => (
            <Animated.View style={{transform: [{scale: focused ? 1.1 : 1}]}}>
              {focused ? (
                <Ionicons name="home" color={color} size={size} />
              ) : (
                <Ionicons name="home-outline" color={color} size={size} />
              )}
            </Animated.View>
          ),
        }}
      />
      <Tab.Screen
        name="SearchStack"
        component={SearchStackScreen}
        options={{
          title: 'Search',
          tabBarIcon: ({focused, color, size}) => (
            <Animated.View style={{transform: [{scale: focused ? 1.1 : 1}]}}>
              {focused ? (
                <Ionicons name="search" color={color} size={size} />
              ) : (
                <Ionicons name="search-outline" color={color} size={size} />
              )}
            </Animated.View>
          ),
        }}
      />
      <Tab.Screen
        name="WatchListStack"
        component={WatchListStackScreen}
        options={{
          title: 'Watch List',
          tabBarIcon: ({focused, color, size}) => (
            <Animated.View style={{transform: [{scale: focused ? 1.1 : 1}]}}>
              <Entypo name="folder-video" color={color} size={size} />
            </Animated.View>
          ),
        }}
      />
      <Tab.Screen
        name="SettingsStack"
        component={SettingsStackScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({focused, color, size}) => {
            const customSize = size + 5;
            const photoUri =
              currentUser?.photo || userSession.getBestPhotoUri();

            if (photoUri) {
              return (
                <Animated.View
                  style={{transform: [{scale: focused ? 1.1 : 1}]}}>
                  <RNImage
                    source={{uri: photoUri}}
                    style={{
                      width: customSize,
                      height: customSize,
                      borderRadius: size / 2,
                      borderWidth: focused ? 2 : 0,
                      borderColor: focused ? primary : 'transparent',
                    }}
                  />
                </Animated.View>
              );
            }

            return (
              <Animated.View style={{transform: [{scale: focused ? 1.1 : 1}]}}>
                {focused ? (
                  <Ionicons name="settings" color={color} size={size} />
                ) : (
                  <Ionicons name="settings-outline" color={color} size={size} />
                )}
              </Animated.View>
            );
          },
        }}
      />
    </Tab.Navigator>
  );
}

function TVRootStackScreen() {
  return (
    <TVRootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
        contentStyle: {backgroundColor: 'transparent'},
      }}>
      <TVRootStack.Screen name="VegaTVStack" component={VegaTVStackNavigator} />
    </TVRootStack.Navigator>
  );
}

/* ----------------- Notification modal ----------------- */
const NotificationPromptModal = ({isVisible, onClose, onAllow}: any) => (
  <Modal
    animationType="fade"
    transparent
    visible={isVisible}
    onRequestClose={onClose}>
    <View className="flex-1 justify-center items-center bg-black/50">
      <View className="bg-[#1A1A1A] rounded-2xl w-80 p-6 items-center">
        <MaterialIcons name="notifications-active" size={40} color="#6B7280" />
        <Text className="text-white text-xl font-bold mt-4 text-center">
          Allow Vega-Next to send you notifications?
        </Text>
        <View className="mt-6 w-full">
          <TouchableOpacity
            onPress={onAllow}
            className="bg-[#262626] rounded-xl py-3 px-4 mb-2">
            <Text className="text-white text-lg text-center font-semibold">
              Allow
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            className="bg-transparent rounded-xl py-3 px-4">
            <Text className="text-gray-400 text-lg text-center font-semibold">
              Don't allow
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

/* ----------------- Main App Component ----------------- */
const App = () => {
  LogBox.ignoreLogs([
    'You have passed a style to FlashList',
    'new NativeEventEmitter()',
  ]);

  const {primary} = useThemeStore(state => state);
  const {appMode} = useAppModeStore(state => state);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isLocked, setIsLocked] = useState(
    MMKV.getBool('appLockEnabled') || false,
  );
  const navigationRef = useNavigationContainerRef();
  const [currentRouteName, setCurrentRouteName] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isCommunityOpen, setIsCommunityOpen] = useState(false);

  // Community floating button state

  const [showCommunityButton, setShowCommunityButton] = useState(() => {
    const enabled = MMKV.getBool('community_enabled');
    const loggedIn = userSession.isLoggedIn();
    console.log(
      '[App] Initial community state - enabled:',
      enabled,
      'loggedIn:',
      loggedIn,
    );
    return enabled && loggedIn;
  });

  const isCommunityScreen = currentRouteName === 'Community';
  const shouldShowButton =
    showCommunityButton && userSession.isLoggedIn() && !isCommunityScreen;

  // ✅ ADD COMMUNITY EVENT LISTENERS
  useEffect(() => {
    console.log('[App] Community listeners registered');

    const communitySub = DeviceEventEmitter.addListener(
      'communityToggled',
      (enabled: boolean) => {
        console.log(
          '[App] communityToggled event:',
          enabled,
          'isLoggedIn:',
          userSession.isLoggedIn(),
        );
        setShowCommunityButton(enabled && userSession.isLoggedIn());
      },
    );

    const loginSub = DeviceEventEmitter.addListener('userLoggedIn', () => {
      console.log('[App] userLoggedIn event');
      setShowCommunityButton(MMKV.getBool('community_enabled') && true);
    });

    const logoutSub = DeviceEventEmitter.addListener('userLoggedOut', () => {
      console.log('[App] userLoggedOut event');
      setShowCommunityButton(false);
    });

    return () => {
      communitySub.remove();
      loginSub.remove();
      logoutSub.remove();
    };
  }, []);

  SystemUI.setBackgroundColorAsync('black');

  useEffect(() => {
    setIsLoggedIn(userSession.isLoggedIn());
  }, []);

  useEffect(() => {
    downloadManager.resetStaleDownloads();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        downloadManager.refreshFromStorage();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && MMKV.getBool('appLockEnabled')) {
        setIsLocked(true);
      }
    });
    return () => subscription.remove();
  }, []);

  // 🔴 FIX: Properly request POST_NOTIFICATIONS only on Android 13+
  useEffect(() => {
    const checkNotificationPermission = async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
          if (status === RESULTS.DENIED || status === RESULTS.NOT_DETERMINED) {
            setShowNotificationModal(true);
          }
        } catch (err) {
          console.error('Permission check failed:', err);
        }
      }
    };
    checkNotificationPermission();
  }, []);

  const handleAllowNotifications = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
      if (result === RESULTS.GRANTED) {
        setShowNotificationModal(false);
        // Force OneSignal to recognize the granted permission
        OneSignal.Notifications.requestPermission(true);
      } else {
        setShowNotificationModal(false);
      }
    } else {
      setShowNotificationModal(false);
    }
  };

  useEffect(() => {
    try {
      OneSignal.Debug.setLogLevel(LogLevel.Verbose);
      OneSignal.initialize('fc34c762-8fbb-45c8-aeb6-b04afbe7c930');
      OneSignal.Notifications.requestPermission(false);
      OneSignal.Notifications.addEventListener(
        'foregroundWillDisplay',
        event => {
          if (Platform.OS === 'android') {
            event.preventDefault();
            event.getNotification().display({
              android: {
                smallIcon: 'ic_stat_onesignal_default',
              },
            });
          }
        },
      );
      OneSignal.Notifications.addEventListener('click', event => {
        console.log('OneSignal notification clicked:', event);
      });
    } catch (err) {
      console.error('OneSignal initialization error:', err);
    }
  }, []);

  async function actionHandler({
    type,
    detail,
  }: {
    type: EventType;
    detail: EventDetail;
  }) {
    if (
      type === EventType.ACTION_PRESS &&
      detail.pressAction?.id === detail.notification?.data?.fileName
    ) {
      RNFS.stopDownload(Number(detail.notification?.data?.jobId));
      cancelHlsDownload(detail.notification?.data?.fileName!);
      try {
        const files = await RNFS.readDir(downloadFolder);
        const foundFile = files.find(
          fileItem =>
            fileItem.name.split('.').slice(0, -1).join('.') ===
            detail.notification?.data?.fileName,
        );
        if (foundFile) await RNFS.unlink(foundFile.path);
      } catch (error) {
        console.log(error);
      }
    }
    if (type === EventType.PRESS && detail.pressAction?.id === 'install') {
      const res = await RNFS.exists(
        `${RNFS.DownloadDirectoryPath}/${detail.notification?.data?.name}`,
      );
      if (res) {
        const hasPermission = await checkAppInstallPermission();
        if (!hasPermission) await requestAppInstallPermission();
        const fileUri = `file://${RNFS.DownloadDirectoryPath}/${detail.notification?.data?.name}`;
        Linking.openURL(fileUri).catch(err =>
          console.error('Failed to open APK file:', err),
        );
      }
    }
  }

  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({type, detail}) =>
      actionHandler({type, detail}),
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    updateProvidersService.startAutomaticUpdateCheck();
    return () => updateProvidersService.stopAutomaticUpdateCheck();
  }, []);

  useEffect(() => {
    if (settingsStorage.isAutoCheckUpdateEnabled()) {
      checkForUpdate(() => {}, settingsStorage.isAutoDownloadEnabled(), false);
    }
  }, []);

  const generateUUID = () => {
    const S4 = () =>
      (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    return `${S4()}${S4()}-${S4()}-${S4()}-${S4()}-${S4()}${S4()}${S4()}`;
  };

  const sendUserPing = async () => {
    const API_URL = 'http://10.0.2.2:3000/api/user-ping';
    try {
      let userId = null;
      if (Platform.OS === 'android') userId = Application.androidId;
      else if (Platform.OS === 'ios')
        userId = await Application.getIosIdForVendorAsync();
      if (!userId) userId = generateUUID();
      await fetch(API_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId, platform: Platform.OS}),
      });
    } catch (error) {
      console.error('Failed to log user activity:', error);
    }
  };

  useEffect(() => {
    sendUserPing();
  }, []);

  // Simplified mode selector since Music is removed
  const MainComponent = appMode === 'tv' ? TVRootStackScreen : TabStackScreen;

  const hasSeenOnboarding = MMKV.getBool('hasSeenOnboarding') === true;

  let initialRoute: keyof RootStackParamList = hasSeenOnboarding
    ? 'MainStack'
    : 'Onboarding';

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <GlobalErrorBoundary>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <SafeAreaView
              edges={{
                right: 'off',
                top: 'off',
                left: 'off',
                bottom: 'additive',
              }}
              className="flex-1"
              style={{backgroundColor: 'black'}}>
              <NavigationContainer
                ref={navigationRef}
                onReady={async () => {
                  await BootSplash.hide({fade: true});
                  setCurrentRouteName(
                    navigationRef.getCurrentRoute()?.name || '',
                  );
                }}
                onStateChange={() => {
                  const currentRoute =
                    navigationRef.getCurrentRoute()?.name || '';
                  if (currentRouteName !== currentRoute)
                    setCurrentRouteName(currentRoute);
                }}
                theme={{
                  fonts: {
                    regular: {
                      fontFamily: 'Inter_400Regular',
                      fontWeight: '400',
                    },
                    medium: {fontFamily: 'Inter_500Medium', fontWeight: '500'},
                    bold: {fontFamily: 'Inter_700Bold', fontWeight: '700'},
                    heavy: {
                      fontFamily: 'Inter_800ExtraBold',
                      fontWeight: '800',
                    },
                  },
                  dark: true,
                  colors: {
                    background: 'transparent',
                    card: 'black',
                    primary: primary,
                    text: 'white',
                    border: 'black',
                    notification: primary,
                  },
                }}>
                {/* Wrap navigator and floating button in a fragment */}
                <>
                  <Stack.Navigator
                    initialRouteName={initialRoute}
                    screenOptions={{
                      headerShown: false,
                      animation: 'ios_from_right',
                      animationDuration: 200,
                      contentStyle: {backgroundColor: 'transparent'},
                    }}>
                    <Stack.Screen name="Onboarding" component={Onboarding} />
                    <Stack.Screen name="Login" component={Login} />
                    <Stack.Screen name="MainStack" component={MainComponent} />
                    <Stack.Screen
                      name="Player"
                      component={Player}
                      options={{orientation: 'landscape'}}
                    />
                    <Stack.Screen name="WatchTrailer" component={WebView} />
                    <Stack.Screen name="CastMovie" component={CastMovie} />
                    <Stack.Screen name="ChatHistory" component={ChatHistory} />
                  </Stack.Navigator>

                  {/* Floating button now inside NavigationContainer */}
                  <FloatingCommunityButton
                    visible={shouldShowButton && !isCommunityOpen}
                    onOpen={() => setIsCommunityOpen(true)}
                  />
                  {/* 🟢 3. RENDER the community chat as a floating widget component */}
                  {isCommunityOpen && (
                    <CommunityScreen
                      onClose={() => setIsCommunityOpen(false)}
                    />
                  )}
                </>
              </NavigationContainer>

              <AI
                currentRoute={currentRouteName}
                onNavigateToHistory={() => {
                  if (navigationRef.isReady())
                    navigationRef.navigate('ChatHistory' as never);
                }}
              />

              <NotificationPromptModal
                isVisible={showNotificationModal}
                onClose={() => setShowNotificationModal(false)}
                onAllow={handleAllowNotifications}
              />
              {isLocked && <AppLock onUnlock={() => setIsLocked(false)} />}
            </SafeAreaView>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GlobalErrorBoundary>
    </GestureHandlerRootView>
  );
};

export default App;
