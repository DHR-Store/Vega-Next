import {
  View,
  Text,
  ScrollView,
  StatusBar,
  Switch,
  TouchableOpacity,
} from 'react-native';
import React, {useState, useEffect} from 'react';
import {providersStorage} from '../../lib/storage';
import {providersList} from '../../lib/constants';
import useThemeStore from '../../lib/zustand/themeStore';
import {SvgUri} from 'react-native-svg';

// Define a type for the provider object for better type safety
interface Provider {
  value: string;
  name: string;
  flag: string;
  type?: string;
}

const DisableProviders = () => {
  const {primary} = useThemeStore(state => state);
  const [disabledProviders, setDisabledProviders] = useState<string[]>([]);

  // Use useEffect to load the disabled providers list on component mount
  useEffect(() => {
    setDisabledProviders(providersStorage.getDisabledProviders());
  }, []);

  const toggleProvider = (providerId: string) => {
    const newDisabled = providersStorage.toggleProvider(providerId);
    setDisabledProviders([...newDisabled]); // Spread to ensure state update triggers re-render
  };

  const enableAll = () => {
    providersStorage.enableAllProviders();
    setDisabledProviders([]);
  };

  return (
    <ScrollView
      className="w-full h-full bg-black"
      contentContainerStyle={{
        paddingTop: StatusBar.currentHeight || 0,
      }}>
      <View className="p-5">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-white">
            Disable Providers
          </Text>
          <TouchableOpacity
            onPress={enableAll}
            className="bg-[#262626] px-4 py-2 rounded-lg active:opacity-70">
            <Text className="text-white text-xs">Enable All</Text>
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
              <View className="flex-row items-center">
                <View className="bg-[#262626] p-2 rounded-lg mr-3">
                  <SvgUri width={24} height={24} uri={provider.flag} />
                </View>
                <View>
                  <Text className="text-white text-base">{provider.name}</Text>
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
  );
};

export default DisableProviders;
