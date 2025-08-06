import {
  View,
  Text,
  Linking,
  TouchableOpacity,
  TouchableNativeFeedback,
  ScrollView,
  Dimensions,
  Switch, // Import Switch
} from 'react-native';
import React, { useCallback, useMemo } from 'react';
import {
  settingsStorage,
  cacheStorageService,
  ProviderExtension,
} from '../../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../../lib/zustand/contentStore';
import { socialLinks } from '../../lib/constants';
import {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { SettingsStackParamList, TabStackParamList } from '../../App'; // Keep existing imports
import {
  MaterialCommunityIcons,
  AntDesign,
  Feather,
  MaterialIcons,
} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import useWatchHistoryStore from '../../lib/zustand/watchHistrory';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';

import RenderProviderFlagIcon from '../../components/RenderProviderFLagIcon';
import useAppModeStore from '../../lib/zustand/appModeStore'; // Import the new store

type Props = NativeStackScreenProps<SettingsStackParamList, 'Settings'>;

const Settings = ({ navigation }: Props) => {
  const tabNavigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const { primary } = useThemeStore(state => state);
  const { provider, setProvider, installedProviders } = useContentStore(
    state => state,
  );
  const { clearHistory } = useWatchHistoryStore(state => state);
  const { appMode, setAppMode } = useAppModeStore(state => state); // Get appMode and setAppMode

  const handleProviderSelect = useCallback(
    (item: ProviderExtension) => {
      setProvider(item);
      // When a video provider is selected, ensure appMode is 'video'
      setAppMode('video');
      // Add haptic feedback
      if (settingsStorage.isHapticFeedbackEnabled()) {
        ReactNativeHapticFeedback.trigger('virtualKey', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      // Navigate to home screen of the video app
      tabNavigation.navigate('HomeStack');
    },
    [setProvider, tabNavigation, setAppMode],
  );

  const renderProviderItem = useCallback(
    (item: ProviderExtension, isSelected: boolean) => (
      <TouchableOpacity
        key={item.value}
        onPress={() => handleProviderSelect(item)}
        className={`mr-3 rounded-lg ${isSelected ? 'bg-[#333333]' : 'bg-[#262626]'
          }`}
        style={{
          width: Dimensions.get('window').width * 0.3, // Shows 2.5 items
          height: 65, // Increased height
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
            <Text style={{ position: 'absolute', top: 6, right: 6 }}>
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
  }, []);

  const clearHistoryHandler = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    clearHistory();
  }, [clearHistory]);

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

        {/* App Mode Section */}
        <AnimatedSection delay={50}>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">App Mode</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="application"
                    size={22}
                    color={primary}
                  />
                  <Text className="text-white ml-3 text-base">
                    Vega-Music Mode
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#767577', true: primary }}
                  thumbColor={appMode === 'music' ? '#f4f3f4' : '#f4f3f4'}
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={() => {
                    const newMode = appMode === 'video' ? 'music' : 'video';
                    setAppMode(newMode);
                    if (settingsStorage.isHapticFeedbackEnabled()) {
                      ReactNativeHapticFeedback.trigger('impactLight', {
                        enableVibrateFallback: true,
                        ignoreAndroidSystemSettings: false,
                      });
                    }
                    // If switching to music, the root navigator will change automatically.
                    // If switching back to video, navigate to HomeStack to reset the view.
                    if (newMode === 'video') {
                      tabNavigation.navigate('HomeStack');
                    }
                  }}
                  value={appMode === 'music'}
                />
              </View>
            </View>
          </View>
        </AnimatedSection>


        {/* Content provider section (only visible in video mode) */}
        {appMode === 'video' && (
          <AnimatedSection delay={100}>
            <View className="mb-6 flex-col gap-3">
              <Text className="text-gray-400 text-sm mb-1">Content Provider</Text>
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
              {/* Extensions */}
              <View className="bg-[#1A1A1A] rounded-xl overflow-hidden mb-3">
                <TouchableNativeFeedback
                  onPress={() => navigation.navigate('Extensions')}
                  background={TouchableNativeFeedback.Ripple('#333333', false)}>
                  <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons
                        name="puzzle"
                        size={22}
                        color={primary}
                      />
                      <Text className="text-white ml-3 text-base">
                        Provider Manager
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="gray" />
                  </View>
                </TouchableNativeFeedback>
              </View>
            </View>
          </AnimatedSection>
        )}


        {/* Main options section */}
        <AnimatedSection delay={200}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">Options</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              {/* Downloads */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('Downloads')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons
                      name="folder-download"
                      size={22}
                      color={primary}
                    />
                    <Text className="text-white ml-3 text-base">Downloads</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* Subtitle Style */}
              <TouchableNativeFeedback
                onPress={async () => {
                  navigation.navigate('SubTitlesPreferences');
                }}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons
                      name="subtitles"
                      size={22}
                      color={primary}
                    />
                    <Text className="text-white ml-3 text-base">
                      Subtitle Style
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* Watch History */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('WatchHistoryStack')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons
                      name="history"
                      size={22}
                      color={primary}
                    />
                    <Text className="text-white ml-3 text-base">
                      Watch History
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* Preferences */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('Preferences')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center">
                    <MaterialIcons
                      name="room-preferences"
                      size={22}
                      color={primary}
                    />
                    <Text className="text-white ml-3 text-base">
                      Preferences
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>
            </View>
          </View>
        </AnimatedSection>

        {/* Data Management section */}
        <AnimatedSection delay={300}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">Data Management</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              {/* Clear Cache */}
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

              {/* Clear Watch History */}
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

        {/* About & GitHub section */}
        <AnimatedSection delay={400}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">About</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              {/* About */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('About')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                  <View className="flex-row items-center">
                    <Feather name="info" size={22} color={primary} />
                    <Text className="text-white ml-3 text-base">About</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* GitHub */}
              <TouchableNativeFeedback
                onPress={() => Linking.openURL('https://github.com/DHR-Store/Vega-Next')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                  <View className="flex-row items-center">
                    <AntDesign name="github" size={22} color={primary} />
                    <Text className="text-white ml-3 text-base">
                      Give a star ⭐
                    </Text>
                  </View>
                  <Feather name="external-link" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* sponsore */}
              <TouchableNativeFeedback
                onPress={() => Linking.openURL('https://github.com/DHR-Store/Vega-Next')}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center">
                    <AntDesign name="heart" size={22} color="#ff69b4" />
                    <Text className="text-white ml-3 text-base">
                      Sponsor Project
                    </Text>
                  </View>
                  <Feather name="external-link" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>
            </View>
          </View>
        </AnimatedSection>
      </View>
    </Animated.ScrollView>
  );
};

export default Settings;