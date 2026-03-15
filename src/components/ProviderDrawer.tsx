import {View, Text, Image, TouchableOpacity, ScrollView} from 'react-native';
import React from 'react';
import useContentStore from '../lib/zustand/contentStore';
import useThemeStore from '../lib/zustand/themeStore';
import {DrawerLayout} from 'react-native-gesture-handler';
import {MaterialIcons} from '@expo/vector-icons';
// Make sure this path is correct relative to where ProviderDrawer is located
import RenderProviderFlagIcon from '../components/RenderProviderFLagIcon';

const ProviderDrawer = ({
  drawerRef,
}: {
  drawerRef: React.RefObject<DrawerLayout>;
}) => {
  const {provider, setProvider, installedProviders} = useContentStore(
    state => state,
  );
  const {primary} = useThemeStore(state => state);

  return (
    // Replaced BlurView with a solid/semi-transparent View for maximum Android performance
    <View className="flex-1 bg-[#0f0f0f] w-full h-full">
      {/* Header */}
      <View className="mt-10 px-4 pb-2 border-b border-white/10">
        <Text className="text-white text-lg font-semibold tracking-wide">
          Select Provider
        </Text>
        <Text className="text-gray-400 mt-0.7 text-xs">
          Choose your content source
        </Text>
      </View>

      {/* Standard ScrollView instead of Moti for smooth scrolling */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 px-3 mt-2"
        removeClippedSubviews={true} // Optimization for long lists
        overScrollMode="never" // Prevents overscroll animation glitch on Android
      >
        {installedProviders.map(item => {
          const isActive = provider.value === item.value;

          return (
            <TouchableOpacity
              key={item.value}
              onPress={() => {
                setProvider(item);
                drawerRef.current?.closeDrawer();
              }}
              activeOpacity={0.7}
              className={`flex-row items-center justify-between p-3 my-1.5 rounded-2xl border ${
                isActive
                  ? 'bg-white/10 border-white/10'
                  : 'bg-transparent border-transparent'
              }`}>
              <View className="flex-row items-center flex-1 gap-3">
                {/* --- Dynamic Icon Logic --- */}
                {item.icon ? (
                  <Image
                    source={{uri: item.icon}}
                    className="w-10 h-10 rounded-xl bg-gray-800"
                    style={{
                      resizeMode: 'cover',
                      borderWidth: 1,
                      borderColor: isActive ? primary : '#333',
                    }}
                  />
                ) : (
                  <View
                    className="w-10 h-10 justify-center items-center rounded-xl bg-gray-800 border border-gray-700"
                    style={{borderColor: isActive ? primary : '#333'}}>
                    <RenderProviderFlagIcon type={item.type} />
                  </View>
                )}

                <View className="flex-1 justify-center">
                  <Text
                    numberOfLines={1}
                    className={`text-base font-semibold ${
                      isActive ? 'text-white' : 'text-gray-300'
                    }`}>
                    {item.display_name}
                  </Text>
                  <Text className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {item.type || 'Global'}{' '}
                    {item.version ? `• v${item.version}` : ''}
                  </Text>
                </View>
              </View>

              {/* Selection Indicator */}
              {isActive && (
                <View
                  className="w-6 h-6 rounded-full items-center justify-center ml-2"
                  style={{backgroundColor: primary}}>
                  <MaterialIcons name="check" size={14} color="white" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <View className="h-20" />
      </ScrollView>
    </View>
  );
};

export default ProviderDrawer;
