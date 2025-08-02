import 'react-native-reanimated'; // Ensure this import is at the top  
import React, {useEffect} from 'react'; 
import Home from './screens/home/Home'; 
import Info from './screens/home/Info'; 
import Player from './screens/home/Player'; 
import Settings from './screens/settings/Settings'; 
import WatchList from './screens/WatchList'; 
import Search from './screens/Search'; 
import ScrollList from './screens/ScrollList'; 
import {NavigationContainer, NavigatorScreenParams} from '@react-navigation/native'; 
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'; 
import {createNativeStackNavigator} from '@react-navigation/native-stack'; 
import Ionicons from '@expo/vector-icons/Ionicons'; 
import Entypo from '@expo/vector-icons/Entypo'; 
import 'react-native-gesture-handler'; 
import WebView from './screens/WebView'; 
import SearchResults from './screens/SearchResults'; 
import * as SystemUI from 'expo-system-ui'; 
// import DisableProviders from './screens/settings/DisableProviders'; 
import About, {checkForUpdate} from './screens/settings/About'; 
import BootSplash from 'react-native-bootsplash'; 
import {enableFreeze, enableScreens} from 'react-native-screens'; 
import Preferences from './screens/settings/Preference'; 
import useThemeStore from './lib/zustand/themeStore'; 
import {Dimensions, LogBox, ViewStyle} from 'react-native'; 
import {EpisodeLink} from './lib/providers/types'; 
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback'; 
import TabBarBackgound from './components/TabBarBackgound'; 
import {TouchableOpacity} from 'react-native'; 
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context'; 
import {StyleProp} from 'react-native'; 
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
import {Linking} from 'react-native'; 
// Corrected import for the new VegaMusicStack component 
import VegaMusicStack from './navigation/VegaMusicStack'; // Assuming it's in src/navigation/ 

// Import the new app mode store 
import useAppModeStore from './lib/zustand/appModeStore'; 

enableScreens(true); 
enableFreeze(true); 

const isLargeScreen = Dimensions.get('window').width > 768; 

export type HomeStackParamList = { 
  Home: undefined; 
  Info: {link: string; provider?: string; poster?: string}; 
  ScrollList: { 
    filter: string; 
    title?: string; 
    providerValue?: string; 
    isSearch?: boolean; 
  }; 
  GenreList: { // New screen type for genre navigation
    filter: string; 
    title?: string; 
    providerValue?: string; 
    genre: string; // The genre is a required parameter for this screen
  };
  Webview: {link: string}; 
}; 

export type VegaMusicStackParamList = { 
  VegaMusicHome: undefined; 
  VegaMusicPlayer: undefined; 
  VegaMusicSearch: undefined; 
}; 

export type MusicRootStackParamList = { 
  VegaMusicStack: NavigatorScreenParams<VegaMusicStackParamList>; 
}; 

export type RootStackParamList = { 
  TabStack: NavigatorScreenParams<TabStackParamList>; 
  MusicRootStack: NavigatorScreenParams<MusicRootStackParamList>; 
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
  GenreList: { // New screen type for genre navigation
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

const Tab = createBottomTabNavigator<TabStackParamList>(); 
const Stack = createNativeStackNavigator<RootStackParamList>(); 
const HomeStack = createNativeStackNavigator<HomeStackParamList>(); 
const SearchStack = createNativeStackNavigator<SearchStackParamList>(); 
const WatchListStack = createNativeStackNavigator<WatchListStackParamList>(); 
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>(); 
const WatchHistoryStack = createNativeStackNavigator<WatchHistoryStackParamList>(); 
const MusicRootStack = createNativeStackNavigator<MusicRootStackParamList>(); 

/** * Stack navigator for the Home tab. 
 * Contains screens for the main Home view, movie/series info, and lists. 
 */ 
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
      {/* ADDED: New screen for GenreList, using the ScrollList component */}
      <HomeStack.Screen name="GenreList" component={ScrollList} />
      <HomeStack.Screen name="Webview" component={WebView} /> 
    </HomeStack.Navigator> 
  ); 
} 

/** * Stack navigator for the Search tab. 
 * Contains screens for the search bar, search results, and info pages. 
 */ 
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
      {/* ADDED: New screen for GenreList, using the ScrollList component */}
      <SearchStack.Screen name="GenreList" component={ScrollList} />
      <SearchStack.Screen name="Info" component={Info} /> 
      <SearchStack.Screen name="SearchResults" component={SearchResults} /> 
      <SearchStack.Screen name="Webview" component={WebView} /> 
    </SearchStack.Navigator> 
  ); 
} 

/** * Stack navigator for the Watch List tab. 
 * Contains screens for the user's watch list and item info pages. 
 */ 
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

/** * Stack navigator for the Watch History screen, nested inside Settings. 
 * This handles the navigation flow for the user's viewing history. 
 */ 
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
      <WatchHistoryStack.Screen name="SeriesEpisodes" component={SeriesEpisodes} /> 
    </WatchHistoryStack.Navigator> 
  ); 
} 

/** * Stack navigator for the Settings tab. 
 * Contains all the settings-related screens. 
 */ 
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
      {/* The DisableProviders screen is currently commented out in the original code. */} 
      {/* <SettingsStack.Screen name="DisableProviders" component={DisableProviders} /> */} 
      <SettingsStack.Screen name="About" component={About} /> 
      <SettingsStack.Screen name="Preferences" component={Preferences} /> 
      <SettingsStack.Screen name="Downloads" component={Downloads} /> 
      <SettingsStack.Screen name="Extensions" component={Extensions} /> 
      <SettingsStack.Screen name="WatchHistoryStack" component={WatchHistoryStackScreen} /> 
      <SettingsStack.Screen name="SubTitlesPreferences" component={SubtitlePreference} /> 
    </SettingsStack.Navigator> 
  ); 
} 

/** * The main Bottom Tab navigator. 
 * This is the primary navigation for the video app mode. 
 */ 
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
              height: 55, 
              borderRadius: 0, 
              overflow: 'hidden', 
              elevation: 0, 
              borderTopWidth: 0, 
              paddingHorizontal: 0, 
              paddingTop: 5, 
            } 
          : {}, 
        tabBarBackground: () => <TabBarBackgound />, 
        tabBarHideOnKeyboard: true, 
        // Custom TabBarButton to handle haptic feedback 
        tabBarButton: props => { 
          return ( 
            <TouchableOpacity 
              accessibilityRole="button" 
              accessibilityState={props.accessibilityState} 
              style={props.style as StyleProp<ViewStyle>} 
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
        }, 
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
              {focused ? ( 
                <Entypo name="folder-video" color={color} size={size} /> 
              ) : ( 
                <Entypo name="folder-video" color={color} size={size} /> 
              )} 
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

/** * The main stack navigator for the music app mode. 
 * It uses the VegaMusicStack component for its navigation. 
 */ 
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
      {/* Correctly using the imported component with the correct name */} 
      <MusicRootStack.Screen name="VegaMusicStack" component={VegaMusicStack} /> 
    </MusicRootStack.Navigator> 
  ); 
} 

const App = () => { 
  LogBox.ignoreLogs([ 
    'You have passed a style to FlashList', 
    'new NativeEventEmitter()', 
  ]); 

  const {primary} = useThemeStore(state => state); 
  const {appMode} = useAppModeStore(state => state); // Get appMode from store 

  SystemUI.setBackgroundColorAsync('black'); 

  /** * Action handler for notifee foreground events, such as download cancellation. 
   */ 
  async function actionHandler({ 
    type, 
    detail, 
  }: { 
    type: EventType; 
    detail: EventDetail; 
  }) { 
    // Handle download cancellation 
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

    // Handle app update installation 
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

  // Effect to listen for foreground notification events 
  useEffect(() => { 
    const unsubscribe = notifee.onForegroundEvent(({type, detail}) => { 
      actionHandler({type, detail}); 
    }); 
    return () => { 
      unsubscribe(); 
    }; 
  }, []); 

  // Effect to handle automatic provider updates 
  useEffect(() => { 
    updateProvidersService.startAutomaticUpdateCheck(); 
    return () => { 
      updateProvidersService.stopAutomaticUpdateCheck(); 
    }; 
  }, []); 

  // Effect to check for app updates on startup 
  useEffect(() => { 
    if (settingsStorage.isAutoCheckUpdateEnabled()) { 
      checkForUpdate(() => {}, settingsStorage.isAutoDownloadEnabled(), false); 
    } 
  }, []); 

  return ( 
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
                {/* Conditionally render the main app based on appMode */} 
                {appMode === 'video' ? ( 
                  <Stack.Screen name="TabStack" component={TabStackScreen} /> 
                ) : ( 
                  <Stack.Screen 
                    name="MusicRootStack" 
                    component={MusicRootStackScreen} 
                  /> 
                )} 
                <Stack.Screen 
                  name="Player" 
                  component={Player} 
                  options={{orientation: 'landscape'}} 
                /> 
                <Stack.Screen name="WatchTrailer" component={WebView} /> 
              </Stack.Navigator> 
            </NavigationContainer> 
          </SafeAreaView> 
        </QueryClientProvider> 
      </SafeAreaProvider> 
    </GlobalErrorBoundary> 
  ); 
}; 

export default App;