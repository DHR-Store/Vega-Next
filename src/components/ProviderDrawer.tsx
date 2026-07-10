import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import React, {useCallback, useMemo} from 'react';
import useContentStore from '../lib/zustand/contentStore';
import useThemeStore from '../lib/zustand/themeStore';
import {DrawerLayout} from 'react-native-gesture-handler';
import {MaterialIcons} from '@expo/vector-icons';
import RenderProviderFlagIcon from '../components/RenderProviderFLagIcon';

interface ProviderItemProps {
  item: any;
  isActive: boolean;
  primary: string;
  onPress: (item: any) => void;
}

// 🚀 Optimization: Isolated, memoized item row to eliminate redundant re-renders
const ProviderItem = React.memo(
  ({item, isActive, primary, onPress}: ProviderItemProps) => {
    return (
      <TouchableOpacity
        onPress={() => onPress(item)}
        activeOpacity={0.7}
        className={`flex-row items-center justify-between p-3 my-1.5 rounded-2xl border ${
          isActive
            ? 'bg-white/10 border-white/10'
            : 'bg-transparent border-transparent'
        }`}>
        <View className="flex-row items-center flex-1 gap-3">
          {/* Dynamic Icon Layer */}
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
              {item.type || 'Global'} {item.version ? `• v${item.version}` : ''}
            </Text>
          </View>
        </View>

        {/* Selection Circle */}
        {isActive && (
          <View
            className="w-6 h-6 rounded-full items-center justify-center ml-2"
            style={{backgroundColor: primary}}>
            <MaterialIcons name="check" size={14} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

const ProviderDrawer = ({
  drawerRef,
}: {
  drawerRef: React.RefObject<DrawerLayout>;
}) => {
  // 🚀 Optimization: Atomic hooks to completely isolate unneeded context updates
  const provider = useContentStore(state => state.provider);
  const setProvider = useContentStore(state => state.setProvider);
  const installedProviders = useContentStore(state => state.installedProviders);
  const primary = useThemeStore(state => state.primary);

  // Memoized press callback
  const handleProviderPress = useCallback(
    (item: any) => {
      setProvider(item);
      drawerRef.current?.closeDrawer();
    },
    [setProvider, drawerRef],
  );

  // Recyclable structural frame renderer
  const renderItem = useCallback(
    ({item}: {item: any}) => {
      const isActive = provider?.value === item.value;
      return (
        <ProviderItem
          item={item}
          isActive={isActive}
          primary={primary}
          onPress={handleProviderPress}
        />
      );
    },
    [provider?.value, primary, handleProviderPress],
  );

  const keyExtractor = useCallback((item: any) => item.value, []);

  // Pre-compiled List Header prevents layout calculations while sliding the drawer open
  const ListHeader = useMemo(
    () => (
      <View className="mt-10 pb-2 border-b border-white/10 mb-2">
        <Text className="text-white text-lg font-semibold tracking-wide">
          Select Provider
        </Text>
        <Text className="text-gray-400 mt-0.7 text-xs">
          Choose your content source
        </Text>
      </View>
    ),
    [],
  );

  const ListFooter = useMemo(() => <View style={styles.footerSpacing} />, []);

  return (
    <View className="flex-1 bg-[#0f0f0f] w-full h-full">
      <FlatList
        data={installedProviders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        className="flex-1 px-3"
        removeClippedSubviews={true} // 🚀 Critical for high frame rates on long provider extensions lists
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={10}
        overScrollMode="never" // Prevents the heavy Android native glowing animation stretch lag
      />
    </View>
  );
};

const styles = StyleSheet.create({
  footerSpacing: {
    height: 80,
  },
});

export default React.memo(ProviderDrawer);
