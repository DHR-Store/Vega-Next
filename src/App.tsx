// App.tsx (Fixed: Uses 'additive' SafeArea logic for perfect Android Nav positioning)

import 'react-native-reanimated';
import React, {useEffect, useState} from 'react';
import OneSignal from 'react-native-onesignal';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Linking,
  Dimensions,
  LogBox,
  Platform,
} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';

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
import 'react-native-gesture-handler';
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

enableScreens(true);
enableFreeze(true);

const isLargeScreen = Dimensions.get('window').width > 768;

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

export type VegaMusicStackParamList = {
  VegaMusicHome: undefined;
  VegaSettings: undefined;
  VegaMusicSearch: undefined;
};

export type VegaTVStackParamList = {
  LiveTVScreen: undefined;
  TVPlayerScreen: {streamUrl: string};
  VegaTVSettingsScreen: undefined;
};

export type MusicRootStackParamList = {
  VegaMusicStack: NavigatorScreenParams<VegaMusicStackParamList>;
};

export type TVRootStackParamList = {
  VegaTVStack: NavigatorScreenParams<VegaTVStackParamList>;
};

export type RootStackParamList = {
  TabStack: NavigatorScreenParams<TabStackParamList>;
  MusicRootStack: NavigatorScreenParams<MusicRootStackParamList>;
  TVRootStack: NavigatorScreenParams<TVRootStackParamList>;
  Player: {
    linkIndex: number;
    episodeList: EpisodeLink[];
    directUrl?: string;
    type: string;
    primaryTitle?: string;
    secondaryTitle?: string;
    poster: {
      logo?: string;
      poster?: string;
      background?: string;
    };
    file?: string;
    providerValue?: string;
    infoUrl?: string;
  };
  WatchTrailer: {link?: string; videoId?: string};
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
const MusicRootStack = createNativeStackNavigator<MusicRootStackParamList>();
const VegaMusicStack = createNativeStackNavigator<VegaMusicStackParamList>();
const TVRootStack = createNativeStackNavigator<TVRootStackParamList>();
const VegaTVStack = createNativeStackNavigator<VegaTVStackParamList>();

/* ----------------- Custom TabBarButton ----------------- */
function CustomTabBarButton(props) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={props.accessibilityState}
      style={props.style}
      onPress={e => {
        props.onPress && props.onPress(e);
        if (
          !props?.accessibilityState?.selected &&
          settingsStorage.isHapticFeedbackEnabled()
        ) {
          RNReactNativeHapticFeedback.trigger('effectTick', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }
      }}>
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
        freezeOnBlur: true,
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
        freezeOnBlur: true,
      }}>
      <SearchStack.Screen name="Search" component={Search} />
      <SearchStack.Screen name="ScrollList" component={ScrollList} />
      <SearchStack.Screen name="GenreList" component={ScrollList} />
      <SearchStack.Screen name="Info" component={Info} />
      <Stack.Screen name="Suggestion" component={Suggestion} />
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
        freezeOnBlur: true,
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
        freezeOnBlur: true,
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

function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
        freezeOnBlur: true,
      }}>
      <SettingsStack.Screen name="Settings" component={Settings} />
      <SettingsStack.Screen name="About" component={About} />
      <SettingsStack.Screen name="Preferences" component={Preferences} />
      <SettingsStack.Screen name="Downloads" component={Downloads} />
      <SettingsStack.Screen name="Extensions" component={Extensions} />
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

function VegaMusicStackNavigator() {
  return (
    <VegaMusicStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
        freezeOnBlur: true,
        contentStyle: {backgroundColor: 'transparent'},
      }}>
      <VegaMusicStack.Screen name="VegaMusicHome" component={VegaMusicHome} />
      <VegaMusicStack.Screen name="VegaSettings" component={VegaSettings} />
    </VegaMusicStack.Navigator>
  );
}

function VegaTVStackNavigator() {
  return (
    <VegaTVStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
        freezeOnBlur: true,
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
  const showTabBarLables = settingsStorage.showTabBarLabels();

  return (
    <Tab.Navigator
      detachInactiveScreens={true}
      screenOptions={{
        animation: 'shift',
        tabBarLabelPosition: 'below-icon',
        tabBarVariant: isLargeScreen ? 'material' : 'uikit',
        popToTopOnBlur: false,
        tabBarPosition: isLargeScreen ? 'left' : 'bottom',
        headerShown: false,
        freezeOnBlur: true,
        tabBarActiveTintColor: primary,
        tabBarInactiveTintColor: '#dadde3',
        tabBarShowLabel: showTabBarLables,
        tabBarStyle: !isLargeScreen
          ? {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,

              // FIX: Constant Height + No manual inset math
              // The Root SafeAreaView handles the spacing now (additive)
              height: 45, // Slightly taller for icons + text

              backgroundColor: 'transparent',
              borderRadius: 0,
              overflow: 'visible',
              elevation: 0,
              borderTopWidth: 0,
              paddingHorizontal: 0,
              paddingTop: 5,
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
          tabBarIcon: ({focused, color, size}) => (
            <Animated.View style={{transform: [{scale: focused ? 1.1 : 1}]}}>
              {focused ? (
                <Ionicons name="settings" color={color} size={size} />
              ) : (
                <Ionicons name="settings-outline" color={color} size={size} />
              )}
            </Animated.View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
/* ----------------- Music/TV roots ----------------- */
function MusicRootStackScreen() {
  return (
    <MusicRootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
        freezeOnBlur: true,
        contentStyle: {backgroundColor: 'transparent'},
      }}>
      <MusicRootStack.Screen
        name="VegaMusicStack"
        component={VegaMusicStackNavigator}
      />
    </MusicRootStack.Navigator>
  );
}

function TVRootStackScreen() {
  return (
    <TVRootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        animationDuration: 200,
        freezeOnBlur: true,
        contentStyle: {backgroundColor: 'transparent'},
      }}>
      <TVRootStack.Screen name="VegaTVStack" component={VegaTVStackNavigator} />
    </TVRootStack.Navigator>
  );
}

// Notification permission modal component
const NotificationPromptModal = ({isVisible, onClose, onAllow}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
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
  );
};

/* ----------------- Main App Component (with OneSignal) ----------------- */
const App = () => {
  LogBox.ignoreLogs([
    'You have passed a style to FlashList',
    'new NativeEventEmitter()',
  ]);

  // theme & app mode hooks (top-level, stable order)
  const {primary} = useThemeStore(state => state);
  const {appMode} = useAppModeStore(state => state);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // system UI
  SystemUI.setBackgroundColorAsync('black');

  // Notification Permission Logic
  useEffect(() => {
    const checkNotificationPermission = async () => {
      const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
      if (status === RESULTS.DENIED || status === RESULTS.NOT_DETERMINED) {
        setShowNotificationModal(true);
      }
    };
    checkNotificationPermission();
  }, []);

  const handleAllowNotifications = async () => {
    const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    if (result === RESULTS.GRANTED) {
      setShowNotificationModal(false);
    }
  };

  /* ----------------- OneSignal init (top-level, runs once) ----------------- */
  useEffect(() => {
    try {
      // Replace with your actual OneSignal App ID
      const ONESIGNAL_APP_ID = 'fc34c762-8fbb-45c8-aeb6-b04afbe7c930';

      if (!OneSignal) {
        console.warn(
          'OneSignal is undefined. Make sure react-native-onesignal is installed and linked.',
        );
        return;
      }

      // Initialize OneSignal
      OneSignal.setAppId(ONESIGNAL_APP_ID);

      // Optional: prompt for iOS (no-op on Android)
      OneSignal.promptForPushNotificationsWithUserResponse(response => {
        console.log('OneSignal prompt response:', response);
      });

      // When a notification is received in foreground
      OneSignal.setNotificationWillShowInForegroundHandler(event => {
        const notif = event.getNotification();

        // Android ke liye small icon override
        if (Platform.OS === 'android') {
          notif.android = {
            ...notif.android,
            smallIcon: 'ic_stat_onesignal_default', // drawable folder me exact name, extension mat likho
          };
        }

        console.log('OneSignal foreground notification:', notif);
        event.complete(notif);
      });

      // When a notification is opened by the user
      OneSignal.setNotificationOpenedHandler(opened => {
        console.log('OneSignal notification opened:', opened);
        // Navigate ya handle data kar sakte ho
      });

      console.log('OneSignal initialized with app id:', ONESIGNAL_APP_ID);
    } catch (err) {
      console.error('OneSignal init error:', err);
    }
  }, []); // runs once only

  /* ----------------- Notifee action handler ----------------- */
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
        const foundFile = files.find(fileItem => {
          const nameWithoutExtension = fileItem.name
            .split('.')
            .slice(0, -1)
            .join('.');
          return nameWithoutExtension === detail.notification?.data?.fileName;
        });
        if (foundFile) {
          await RNFS.unlink(foundFile.path);
        }
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
        if (!hasPermission) {
          await requestAppInstallPermission();
        }
        const fileUri = `file://${RNFS.DownloadDirectoryPath}/${detail.notification?.data?.name}`;
        Linking.openURL(fileUri).catch(err => {
          console.error('Failed to open APK file:', err);
        });
      }
    }
  }

  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({type, detail}) => {
      actionHandler({type, detail});
    });
    return () => {
      unsubscribe();
    };
  }, []);

  /* ----------------- Providers update service ----------------- */
  useEffect(() => {
    updateProvidersService.startAutomaticUpdateCheck();
    return () => {
      updateProvidersService.stopAutomaticUpdateCheck();
    };
  }, []);

  /* ----------------- Auto update check ----------------- */
  useEffect(() => {
    if (settingsStorage.isAutoCheckUpdateEnabled()) {
      checkForUpdate(() => {}, settingsStorage.isAutoDownloadEnabled(), false);
    }
  }, []);

  /* ----------------- UUID & user ping ----------------- */
  const generateUUID = () => {
    const S4 = () =>
      (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    return (
      S4() +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      S4() +
      S4()
    );
  };

  const sendUserPing = async () => {
    const API_URL = 'http://10.0.2.2:3000/api/user-ping';
    try {
      let userId = null;
      if (Platform.OS === 'android') {
        userId = Application.androidId;
      } else if (Platform.OS === 'ios') {
        userId = await Application.getIosIdForVendorAsync();
      }

      if (!userId) userId = generateUUID();

      const pingData = {userId, platform: Platform.OS};

      await fetch(API_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(pingData),
      });

      console.log('User activity logged successfully.');
    } catch (error) {
      console.error('Failed to log user activity:', error);
    }
  };

  useEffect(() => {
    sendUserPing();
  }, []);

  /* ----------------- Choose Main Component hook-safely ----------------- */
  // Note: appMode comes from a hook above; we must not call hooks conditionally.
  let MainComponent = TabStackScreen;
  if (appMode === 'video') {
    MainComponent = TabStackScreen;
  } else if (appMode === 'music') {
    MainComponent = MusicRootStackScreen;
  } else {
    MainComponent = TVRootStackScreen;
  }

  /* ----------------- Render ----------------- */
  return (
    <GlobalErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {/* FIX: Using 'additive' automatically pads the bottom to avoid the nav bar,
              allowing the absolute TabBar to sit perfectly above it. */}
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
              onReady={async () => await BootSplash.hide({fade: true})}
              theme={{
                fonts: {
                  regular: {
                    fontFamily: 'Inter_400Regular',
                    fontWeight: '400',
                  },
                  medium: {
                    fontFamily: 'Inter_500Medium',
                    fontWeight: '500',
                  },
                  bold: {
                    fontFamily: 'Inter_700Bold',
                    fontWeight: '700',
                  },
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
              <Stack.Navigator
                screenOptions={{
                  headerShown: false,
                  animation: 'ios_from_right',
                  animationDuration: 200,
                  freezeOnBlur: true,
                  contentStyle: {backgroundColor: 'transparent'},
                }}>
                <Stack.Screen name="MainStack" component={MainComponent} />
                <Stack.Screen
                  name="Player"
                  component={Player}
                  options={{orientation: 'landscape'}}
                />
                <Stack.Screen name="WatchTrailer" component={WebView} />
              </Stack.Navigator>
            </NavigationContainer>
            <NotificationPromptModal
              isVisible={showNotificationModal}
              onClose={() => setShowNotificationModal(false)}
              onAllow={handleAllowNotifications}
            />
          </SafeAreaView>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
