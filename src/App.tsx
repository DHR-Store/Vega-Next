// App.tsx
import 'react-native-gesture-handler'; // MUST BE AT THE VERY TOP
import 'react-native-reanimated';
import React, {useEffect, useState, useCallback, useMemo, useRef} from 'react';
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
  AppState,
  InteractionManager,
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
import AppLock from './components/AppLock';
import {CloudflareSolver} from './components/CloudflareSolver';
import CachedImage from './components/CachedImage';
import {runThrottledNetworkTask, isNetworkFast} from './lib/utils/networkGate';

// Enable hardware screens and layout freeze mechanisms before mounting
enableScreens(true);
enableFreeze(true);

LogBox.ignoreLogs([
  'You have passed a style to FlashList',
  'new NativeEventEmitter()',
]);

try {
  OneSignal.Debug.setLogLevel(__DEV__ ? LogLevel.Verbose : LogLevel.None);
  OneSignal.initialize('fc34c762-8fbb-45c8-aeb6-b04afbe7c930');
} catch (err) {
  console.error('OneSignal global initialization error:', err);
}

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
const TVRootStack = createNativeStackNavigator<TVRootStackParamList>();
const VegaTVStack = createNativeStackNavigator<VegaTVStackParamList>();

// --- Haptic feedback default disabled ---
const isHapticFeedbackEnabled = () => {
  // Now returns true only if explicitly set to true in MMKV
  return MMKV.getBool('hapticFeedback') === true;
};

// --- Ultra-stable CustomTabBarButton (no re-creations) ---
const CustomTabBarButton = React.memo((props: any) => {
  const onPressRef = useRef(props.onPress);
  onPressRef.current = props.onPress;

  const handlePress = useCallback(
    (e: any) => {
      if (isHapticFeedbackEnabled()) {
        RNReactNativeHapticFeedback.trigger('effectTick');
      }
      onPressRef.current?.(e);
    },
    [], // stable callback
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
});

// --- Memoized Tab Icons (pure, no re-renders) ---
const HomeIcon = React.memo(({focused, color, size}: any) => (
  <Animated.View style={{transform: [{scale: focused ? 1.05 : 1}]}}>
    <Ionicons
      name={focused ? 'home' : 'home-outline'}
      color={color}
      size={size}
    />
  </Animated.View>
));

const SearchIcon = React.memo(({focused, color, size}: any) => (
  <Animated.View style={{transform: [{scale: focused ? 1.05 : 1}]}}>
    <Ionicons
      name={focused ? 'search' : 'search-outline'}
      color={color}
      size={size}
    />
  </Animated.View>
));

const WatchListIcon = React.memo(({focused, color, size}: any) => (
  <Animated.View style={{transform: [{scale: focused ? 1.05 : 1}]}}>
    <Entypo name="folder-video" color={color} size={size} />
  </Animated.View>
));

const SettingsIcon = React.memo(
  ({
    focused,
    color,
    size,
    currentUser,
    primary,
  }: {
    focused: boolean;
    color: string;
    size: number;
    currentUser: User | null;
    primary: string;
  }) => {
    const customSize = size + 5;
    const photoUri = currentUser?.photo || userSession.getBestPhotoUri();

    if (photoUri) {
      return (
        <Animated.View style={{transform: [{scale: focused ? 1.05 : 1}]}}>
          <CachedImage
            uri={photoUri}
            cacheKey={`avatar_${photoUri}`}
            style={{
              width: customSize,
              height: customSize,
              borderRadius: size / 2,
              borderWidth: focused ? 2 : 0,
              borderColor: focused ? primary : 'transparent',
            }}
            fallback={
              <Ionicons
                name={focused ? 'settings' : 'settings-outline'}
                color={color}
                size={size}
              />
            }
          />
        </Animated.View>
      );
    }
    return (
      <Animated.View style={{transform: [{scale: focused ? 1.05 : 1}]}}>
        <Ionicons
          name={focused ? 'settings' : 'settings-outline'}
          color={color}
          size={size}
        />
      </Animated.View>
    );
  },
);

// --- Stack screen options (same for all) ---
const STACK_SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'ios_from_right',
  animationDuration: 200,
  contentStyle: {backgroundColor: 'black'},
  freezeOnBlur: true,
};

// --- Stack Navigator Components (no changes needed) ---
function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
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
    <SearchStack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
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
    <WatchListStack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
      <WatchListStack.Screen name="WatchList" component={WatchList} />
      <WatchListStack.Screen name="Info" component={Info} />
    </WatchListStack.Navigator>
  );
}

function WatchHistoryStackScreen() {
  return (
    <WatchHistoryStack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
      <WatchHistoryStack.Screen name="WatchHistory" component={WatchHistory} />
      <WatchHistoryStack.Screen name="Info" component={Info} />
      <WatchHistoryStack.Screen
        name="SeriesEpisodes"
        component={SeriesEpisodes}
      />
    </WatchHistoryStack.Navigator>
  );
}

function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
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
    <VegaTVStack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
      <VegaTVStack.Screen name="LiveTVScreen" component={LiveTVScreen} />
      <VegaTVStack.Screen name="TVPlayerScreen" component={TVPlayerScreen} />
      <VegaTVStack.Screen
        name="VegaTVSettingsScreen"
        component={VegaTVSettingsScreen}
      />
    </VegaTVStack.Navigator>
  );
}

// --- Tab Stack ---
function TabStackScreen() {
  const primary = useThemeStore(state => state.primary);
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

  const renderTabBarBackground = useCallback(() => <TabBarBackgound />, []);
  const renderTabBarButton = useCallback(
    (props: any) => <CustomTabBarButton {...props} />,
    [],
  );

  const tabScreenOptions = useMemo(
    () => ({
      animation: 'shift' as const,
      lazy: true,
      freezeOnBlur: true,
      tabBarLabelPosition: 'below-icon' as const,
      tabBarVariant: isLargeScreen ? ('material' as const) : ('uikit' as const),
      popToTopOnBlur: false,
      tabBarPosition: isLargeScreen ? ('left' as const) : ('bottom' as const),
      headerShown: false,
      tabBarActiveTintColor: primary,
      tabBarInactiveTintColor: '#dadde3',
      tabBarShowLabel: showTabBarLabels,
      sceneContainerStyle: {backgroundColor: 'black'},
      tabBarStyle: !isLargeScreen
        ? {
            position: 'absolute' as const,
            bottom: 0,
            left: 0,
            right: 0,
            height: showTabBarLabels ? 70 : 45,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            paddingTop: 5,
            paddingBottom: showTabBarLabels ? 5 : 0,
          }
        : {},
      tabBarBackground: renderTabBarBackground,
      tabBarHideOnKeyboard: true,
      tabBarButton: renderTabBarButton,
    }),
    [
      isLargeScreen,
      primary,
      showTabBarLabels,
      renderTabBarBackground,
      renderTabBarButton,
    ],
  );

  const renderHomeIcon = useCallback(
    (props: any) => <HomeIcon {...props} />,
    [],
  );
  const renderSearchIcon = useCallback(
    (props: any) => <SearchIcon {...props} />,
    [],
  );
  const renderWatchListIcon = useCallback(
    (props: any) => <WatchListIcon {...props} />,
    [],
  );
  const renderSettingsIcon = useCallback(
    (props: any) => (
      <SettingsIcon {...props} currentUser={currentUser} primary={primary} />
    ),
    [currentUser, primary],
  );

  return (
    <Tab.Navigator
      detachInactiveScreens={true}
      screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="HomeStack"
        component={HomeStackScreen}
        options={{title: 'Home', tabBarIcon: renderHomeIcon}}
      />
      <Tab.Screen
        name="SearchStack"
        component={SearchStackScreen}
        options={{title: 'Search', tabBarIcon: renderSearchIcon}}
      />
      <Tab.Screen
        name="WatchListStack"
        component={WatchListStackScreen}
        options={{title: 'Watch List', tabBarIcon: renderWatchListIcon}}
      />
      <Tab.Screen
        name="SettingsStack"
        component={SettingsStackScreen}
        options={{title: 'Settings', tabBarIcon: renderSettingsIcon}}
      />
    </Tab.Navigator>
  );
}

function TVRootStackScreen() {
  return (
    <TVRootStack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
      <TVRootStack.Screen name="VegaTVStack" component={VegaTVStackNavigator} />
    </TVRootStack.Navigator>
  );
}

// --- Notification Modal ---
const NotificationPromptModal = React.memo(
  ({isVisible, onClose, onAllow}: any) => (
    <Modal
      animationType="fade"
      transparent
      visible={isVisible}
      onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-[#1A1A1A] rounded-2xl w-80 p-6 items-center">
          <MaterialIcons
            name="notifications-active"
            size={40}
            color="#6B7280"
          />
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
  ),
);

const GESTURE_ROOT_STYLE = {flex: 1};
const SAFE_AREA_BG_STYLE = {backgroundColor: 'black'};
const SAFE_AREA_EDGES = {
  right: 'off',
  top: 'off',
  left: 'off',
  bottom: 'additive',
} as const;
const NAV_THEME_FONTS = {
  regular: {fontFamily: 'Inter_400Regular', fontWeight: '400' as const},
  medium: {fontFamily: 'Inter_500Medium', fontWeight: '500' as const},
  bold: {fontFamily: 'Inter_700Bold', fontWeight: '700' as const},
  heavy: {fontFamily: 'Inter_800ExtraBold', fontWeight: '800' as const},
};

/* ----------------- Main App Component ----------------- */
const App = () => {
  const primary = useThemeStore(state => state.primary);
  const appMode = useAppModeStore(state => state.appMode);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isLocked, setIsLocked] = useState(
    () => MMKV.getBool('appLockEnabled') || false,
  );
  const navigationRef = useNavigationContainerRef();

  const [isCommunityOpen, setIsCommunityOpen] = useState(false);
  const [showCommunityButton, setShowCommunityButton] = useState(() => {
    return MMKV.getBool('community_enabled') && userSession.isLoggedIn();
  });

  useEffect(() => {
    const communitySub = DeviceEventEmitter.addListener(
      'communityToggled',
      (enabled: boolean) => {
        setShowCommunityButton(enabled && userSession.isLoggedIn());
      },
    );
    const loginSub = DeviceEventEmitter.addListener('userLoggedIn', () => {
      setShowCommunityButton(MMKV.getBool('community_enabled'));
    });
    const logoutSub = DeviceEventEmitter.addListener('userLoggedOut', () => {
      setShowCommunityButton(false);
    });
    return () => {
      communitySub.remove();
      loginSub.remove();
      logoutSub.remove();
    };
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync('black');
  }, []);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      downloadManager.resetStaleDownloads();
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        InteractionManager.runAfterInteractions(() => {
          downloadManager.refreshFromStorage();
          if (MMKV.getBool('appLockEnabled')) setIsLocked(true);
        });
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const checkNotificationPermission = async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
          if (status === RESULTS.DENIED || status === RESULTS.NOT_DETERMINED) {
            setShowNotificationModal(true);
          }
        } catch (err) {}
      }
    };
    InteractionManager.runAfterInteractions(() => {
      checkNotificationPermission();
    });
  }, []);

  const handleAllowNotifications = useCallback(async () => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
      if (result === RESULTS.GRANTED) {
        setShowNotificationModal(false);
        OneSignal.Notifications.requestPermission(true);
      } else {
        setShowNotificationModal(false);
      }
    } else {
      setShowNotificationModal(false);
    }
  }, []);

  useEffect(() => {
    try {
      OneSignal.Notifications.requestPermission(false);
      const handleForeground = (event: any) => {
        if (Platform.OS === 'android') {
          event.preventDefault();
          event
            .getNotification()
            .display({android: {smallIcon: 'ic_stat_onesignal_default'}});
        }
      };
      OneSignal.Notifications.addEventListener(
        'foregroundWillDisplay',
        handleForeground,
      );
      return () =>
        OneSignal.Notifications.removeEventListener(
          'foregroundWillDisplay',
          handleForeground,
        );
    } catch (err) {}
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
          f =>
            f.name.split('.').slice(0, -1).join('.') ===
            detail.notification?.data?.fileName,
        );
        if (foundFile) await RNFS.unlink(foundFile.path);
      } catch (error) {}
    }
    if (type === EventType.PRESS && detail.pressAction?.id === 'install') {
      const res = await RNFS.exists(
        `${RNFS.DownloadDirectoryPath}/${detail.notification?.data?.name}`,
      );
      if (res) {
        const hasPermission = await checkAppInstallPermission();
        if (!hasPermission) await requestAppInstallPermission();
        Linking.openURL(
          `file://${RNFS.DownloadDirectoryPath}/${detail.notification?.data?.name}`,
        ).catch(() => {});
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
    InteractionManager.runAfterInteractions(() => {
      updateProvidersService.startAutomaticUpdateCheck();
    });
    return () => updateProvidersService.stopAutomaticUpdateCheck();
  }, []);

  useEffect(() => {
    if (!settingsStorage.isAutoCheckUpdateEnabled()) return;
    InteractionManager.runAfterInteractions(() => {
      runThrottledNetworkTask(
        'auto_update_check',
        6 * 60 * 60 * 1000,
        async () => {
          if (!(await isNetworkFast())) return;
          checkForUpdate(
            () => {},
            settingsStorage.isAutoDownloadEnabled(),
            false,
          );
        },
      );
    });
  }, []);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      runThrottledNetworkTask('user_ping', 12 * 60 * 60 * 1000, async () => {
        if (!(await isNetworkFast())) return;
        try {
          let userId =
            Platform.OS === 'android'
              ? Application.androidId
              : await Application.getIosIdForVendorAsync();
          await fetch('http://10.0.2.2:3000/api/user-ping', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              userId: userId || 'fallback-id',
              platform: Platform.OS,
            }),
          });
        } catch (error) {}
      });
    });
  }, []);

  const MainComponent = useMemo(
    () => (appMode === 'tv' ? TVRootStackScreen : TabStackScreen),
    [appMode],
  );
  const initialRoute = useMemo<keyof RootStackParamList>(
    () => (MMKV.getBool('hasSeenOnboarding') ? 'MainStack' : 'Onboarding'),
    [],
  );
  const handleReady = useCallback(async () => {
    await BootSplash.hide({fade: true});
  }, []);

  const navTheme = useMemo(
    () => ({
      fonts: NAV_THEME_FONTS,
      dark: true,
      colors: {
        background: 'black',
        card: 'black',
        primary: primary,
        text: 'white',
        border: 'black',
        notification: primary,
      },
    }),
    [primary],
  );

  const handleOpenCommunity = useCallback(() => setIsCommunityOpen(true), []);
  const handleCloseCommunity = useCallback(() => setIsCommunityOpen(false), []);
  const handleNavigateToHistory = useCallback(() => {
    if (navigationRef.isReady()) navigationRef.navigate('ChatHistory' as never);
  }, [navigationRef]);
  const handleCloseNotificationModal = useCallback(
    () => setShowNotificationModal(false),
    [],
  );
  const handleUnlock = useCallback(() => setIsLocked(false), []);

  return (
    <GestureHandlerRootView style={GESTURE_ROOT_STYLE}>
      <GlobalErrorBoundary>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <SafeAreaView
              edges={SAFE_AREA_EDGES}
              className="flex-1"
              style={SAFE_AREA_BG_STYLE}>
              <CloudflareSolver />
              <NavigationContainer
                ref={navigationRef}
                onReady={handleReady}
                theme={navTheme}>
                <>
                  <Stack.Navigator
                    initialRouteName={initialRoute}
                    screenOptions={STACK_SCREEN_OPTIONS}>
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

                  <FloatingCommunityButton
                    visible={showCommunityButton && !isCommunityOpen}
                    onOpen={handleOpenCommunity}
                  />
                  {isCommunityOpen && (
                    <CommunityScreen onClose={handleCloseCommunity} />
                  )}
                </>
              </NavigationContainer>
              <AI onNavigateToHistory={handleNavigateToHistory} />
              <NotificationPromptModal
                isVisible={showNotificationModal}
                onClose={handleCloseNotificationModal}
                onAllow={handleAllowNotifications}
              />
              {isLocked && <AppLock onUnlock={handleUnlock} />}
            </SafeAreaView>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GlobalErrorBoundary>
    </GestureHandlerRootView>
  );
};

export default React.memo(App);
