// screens/Onboarding.tsx

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MaterialIcons, Ionicons, Entypo} from '@expo/vector-icons';
import {RootStackParamList} from '../App';
import {MMKV} from '../lib/Mmkv';
import useThemeStore from '../lib/zustand/themeStore';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import * as Application from 'expo-application';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Onboarding'
>;

const {width} = Dimensions.get('window');

const Onboarding = () => {
  const navigation = useNavigation<NavigationProp>();
  const {primary} = useThemeStore(state => state);

  // Fetch the app version just like in About.tsx
  const appVersion = Application.nativeApplicationVersion || 'N/A';

  const handleGetStarted = () => {
    // Mark onboarding as seen
    MMKV.setBool('hasSeenOnboarding', true);

    // Replace the current screen with MainStack so the user can't go back to onboarding
    navigation.replace('MainStack', {screen: 'HomeStack'} as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView
        contentContainerStyle={{flexGrow: 1, paddingBottom: 20}}
        showsVerticalScrollIndicator={false}
        className="px-6">
        {/* Animated Logo, Title & Version Badge */}
        <Animated.View
          entering={FadeInUp.duration(800).delay(200)}
          className="items-center mt-12 mb-8">
          <Image
            source={require('../../assets/adaptive_icon.png')}
            style={{width: 100, height: 100}}
            resizeMode="contain"
          />
          <Text className="text-white text-3xl font-extrabold mt-5 text-center tracking-tight">
            Welcome to Vega-Next
          </Text>

          {/* Modern Version Badge */}
          <View className="mt-3 px-4 py-1.5 bg-[#1A1A1A] rounded-full border border-white/10">
            <Text className="text-gray-300 text-xs font-semibold tracking-widest uppercase">
              Version {appVersion}
            </Text>
          </View>

          <Text className="text-gray-400 text-base text-center mt-5 leading-6 px-2">
            Your all-in-one destination for movies, TV shows, and LiveTv. Dive
            into a seamless streaming experience.
          </Text>
        </Animated.View>

        {/* Feature List */}
        <Animated.View
          entering={FadeInDown.duration(800).delay(400)}
          className="w-full space-y-6">
          {/* Install Providers - HIGHLIGHTED CARD */}
          <View className="flex-row items-center mb-6 bg-[#111111] p-4 rounded-2xl border border-white/5">
            <View className="bg-black p-3 rounded-full mr-4">
              <MaterialIcons name="extension" size={24} color={primary} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold mb-1">
                Install Providers First
              </Text>
              <Text className="text-gray-400 text-sm leading-5">
                Go to Settings &gt; Extensions and install providers to unlock
                movies, anime, and TV shows from multiple sources.
              </Text>
            </View>
          </View>

          {/* Discover */}
          <View className="flex-row items-center mb-6">
            <View className="bg-[#1A1A1A] p-3 rounded-xl mr-4">
              <Ionicons name="search" size={22} color={primary} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold mb-0.5">
                Discover Content
              </Text>
              <Text className="text-gray-400 text-sm leading-5">
                Search and explore content across multiple providers instantly.
              </Text>
            </View>
          </View>

          {/* Internal Player */}
          <View className="flex-row items-center mb-6">
            <View className="bg-[#1A1A1A] p-3 rounded-xl mr-4">
              <MaterialIcons
                name="play-circle-fill"
                size={22}
                color={primary}
              />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold mb-0.5">
                Built-in Player
              </Text>
              <Text className="text-gray-400 text-sm leading-5">
                Watch instantly using the powerful internal video player with
                subtitles and playback controls.
              </Text>
            </View>
          </View>

          {/* External Player */}
          <View className="flex-row items-center mb-6">
            <View className="bg-[#1A1A1A] p-3 rounded-xl mr-4">
              <MaterialIcons name="open-in-new" size={22} color={primary} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold mb-0.5">
                External Player Support
              </Text>
              <Text className="text-gray-400 text-sm leading-5">
                Play videos using external apps like VLC or MX Player for
                advanced playback options.
              </Text>
            </View>
          </View>

          {/* Download */}
          <View className="flex-row items-center mb-6">
            <View className="bg-[#1A1A1A] p-3 rounded-xl mr-4">
              <MaterialIcons name="download" size={22} color={primary} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold mb-0.5">
                Internal & External Downloads
              </Text>
              <Text className="text-gray-400 text-sm leading-5">
                Download episodes using the built-in downloader or send them to
                your favorite external downloader apps.
              </Text>
            </View>
          </View>

          {/* Offline */}
          <View className="flex-row items-center mb-6">
            <View className="bg-[#1A1A1A] p-3 rounded-xl mr-4">
              <MaterialIcons name="offline-pin" size={22} color={primary} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold mb-0.5">
                Watch Offline
              </Text>
              <Text className="text-gray-400 text-sm leading-5">
                Enjoy your downloaded content anytime without internet.
              </Text>
            </View>
          </View>

          {/* Watchlist */}
          <View className="flex-row items-center mb-6">
            <View className="bg-[#1A1A1A] p-3 rounded-xl mr-4">
              <Ionicons name="bookmark" size={22} color={primary} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold mb-0.5">
                Smart Watchlist
              </Text>
              <Text className="text-gray-400 text-sm leading-5">
                Save movies and shows to your watchlist and track what you want
                to watch later.
              </Text>
            </View>
          </View>

          {/* Share */}
          <View className="flex-row items-center mb-6">
            <View className="bg-[#1A1A1A] p-3 rounded-xl mr-4">
              <Ionicons name="share-social" size={22} color={primary} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold mb-0.5">
                Share With Friends
              </Text>
              <Text className="text-gray-400 text-sm leading-5">
                Easily share movies and episodes with friends using quick share
                links.
              </Text>
            </View>
          </View>

          {/* Community */}
          <View className="flex-row items-center mb-6">
            <View className="bg-[#1A1A1A] p-3 rounded-xl mr-4">
              <Ionicons name="chatbubble-ellipses" size={22} color={primary} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold mb-0.5">
                Community Chat
              </Text>
              <Text className="text-gray-400 text-sm leading-5">
                Discuss episodes, share recommendations, and chat with other
                users.
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Get Started Button (Fixed at the bottom) */}
      <Animated.View
        entering={FadeInDown.duration(800).delay(600)}
        className="px-6 pb-6 pt-4 bg-black border-t border-white/5">
        <TouchableOpacity
          onPress={handleGetStarted}
          activeOpacity={0.8}
          style={{backgroundColor: primary}}
          className="w-full py-4 rounded-2xl items-center shadow-lg flex-row justify-center space-x-2">
          <Text className="text-white text-lg font-bold mr-2">
            Got it, let's go!
          </Text>
          <MaterialIcons name="arrow-forward" size={22} color="white" />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

export default Onboarding;
