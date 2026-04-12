import {
  View,
  Text,
  ScrollView,
  StatusBar,
  Switch,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import React, {useState, useEffect} from 'react';
import {useNavigation} from '@react-navigation/native';
import {providersStorage} from '../../lib/storage';
import {providersList} from '../../lib/constants';
import useThemeStore from '../../lib/zustand/themeStore';
import {SvgUri} from 'react-native-svg';
import {settingsStorage} from '../../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {Ionicons} from '@expo/vector-icons';

// Define a type for the provider object for better type safety
interface Provider {
  value: string;
  name: string;
  flag: string;
  type?: string;
}

const DisableProviders = () => {
  const navigation = useNavigation();
  const {primary} = useThemeStore(state => state);
  const [disabledProviders, setDisabledProviders] = useState<string[]>([]);

  // Load disabled providers on mount
  useEffect(() => {
    setDisabledProviders(providersStorage.getDisabledProviders());
  }, []);

  const toggleProvider = (providerId: string) => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectTick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    const newDisabled = providersStorage.toggleProvider(providerId);
    setDisabledProviders([...newDisabled]);
  };

  const enableAll = () => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    providersStorage.enableAllProviders();
    setDisabledProviders([]);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <StatusBar barStyle="light-content" backgroundColor="black" />

      {/* Header with back button */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-800">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-semibold ml-2">
          Disable Providers
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 20,
        }}>
        <View className="p-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-2xl font-bold text-white">
              Manage Providers
            </Text>
            <TouchableOpacity
              onPress={enableAll}
              className="bg-[#262626] px-4 py-2 rounded-lg active:opacity-70">
              <Text className="text-white text-xs font-medium">Enable All</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-gray-400 text-sm mb-3">
            Disabled providers won't appear in search results
          </Text>

          <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
            {providersList.map((provider: Provider, index: number) => (
              <View
                key={provider.value}
                className={`flex-row items-center justify-between p-4 ${
                  index !== providersList.length - 1
                    ? 'border-b border-[#262626]'
                    : ''
                }`}>
                <View className="flex-row items-center flex-1">
                  <View className="bg-[#262626] p-2 rounded-lg mr-3">
                    <SvgUri width={24} height={24} uri={provider.flag} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-base">
                      {provider.name}
                    </Text>
                    <Text className="text-gray-400 text-xs">
                      {provider.type || 'Content Provider'}
                    </Text>
                  </View>
                </View>
                <Switch
                  thumbColor={
                    !disabledProviders.includes(provider.value)
                      ? primary
                      : '#8B8B8B'
                  }
                  trackColor={{false: '#4A4A4A', true: primary}}
                  value={!disabledProviders.includes(provider.value)}
                  onValueChange={() => toggleProvider(provider.value)}
                />
              </View>
            ))}
          </View>

          <Text className="text-gray-400 text-xs text-center mt-4">
            Changes will apply to new searches
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DisableProviders;
