import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  ToastAndroid,
  StatusBar,
  TextInput,
  Platform,
} from 'react-native';
import React, {useState, useEffect} from 'react';
import {settingsStorage} from '../../lib/storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useThemeStore from '../../lib/zustand/themeStore';
import {Dropdown} from 'react-native-element-dropdown';
import {themes} from '../../lib/constants';
// import LinearGradient from 'react-native-linear-gradient'; // Removed as it's no longer used in this component

// --- Utility functions for HSL <-> Hex conversions ---
// These are kept as they might be used by the theme store or other parts
// that convert between HSL and Hex for internal logic.
const hslToRgb = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;

  let c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2,
    r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return [r, g, b];
};

const rgbToHex = (r: number, g: number, b: number) => {
  return (
    '#' +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  );
};

const hslToHexCombined = (h: number, s: number, l: number) => {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
};

const hexToRgb = (hex: string) => {
  if (!hex || !/^#([0-9A-Fa-f]{3}){1,2}$/.test(hex)) {
    return [0, 0, 0];
  }
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
};

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
};

const hexToHslCombined = (hex: string) => {
  if (!hex || !/^#([0-9A-Fa-f]{3}){1,2}$/.test(hex)) {
    return [0, 100, 50];
  }
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b);
};

// --- Theme Preview Component ---
const ThemePreview = ({primary}) => {
  return (
    <View className="p-4 rounded-xl mt-4 bg-[#1A1A1A]">
      <Text className="text-white text-base font-bold mb-3">Theme Preview</Text>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-gray-400 text-sm">Example Button</Text>
        <TouchableOpacity
          style={{backgroundColor: primary}}
          className="px-4 py-2 rounded-lg">
          <Text className="text-white text-sm font-bold">Action</Text>
        </TouchableOpacity>
      </View>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-gray-400 text-sm">Example Text</Text>
        <Text style={{color: primary}} className="text-sm">
          Primary Color
        </Text>
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-gray-400 text-sm">Color Swatch</Text>
        <View
          style={{
            backgroundColor: primary,
            width: 20,
            height: 20,
            borderRadius: 10,
          }}
        />
      </View>
    </View>
  );
};

// --- Refactored ThemeCustomizer Component (Sliders Removed) ---
interface ThemeCustomizerProps {
  primary: string;
  setPrimary: (color: string) => void;
  // isHapticFeedbackEnabled: () => boolean; // Removed as it's no longer used
}

const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  primary,
  setPrimary,
}) => {
  // State for Hex input
  const [customHex, setCustomHex] = useState(primary);

  // Effect to update customHex when the external primary color changes
  // This happens when a new theme is selected from the dropdown
  useEffect(() => {
    if (primary && primary.toUpperCase() !== customHex.toUpperCase()) {
      setCustomHex(primary);
    }
  }, [primary]);

  // Function to handle hex input change
  const handleHexChange = (text: string) => {
    setCustomHex(text.toUpperCase());
    const hexRegex = /^#([0-9A-Fa-f]{3}){1,2}$/;
    if (hexRegex.test(text)) {
      setPrimary(text.toUpperCase());
      settingsStorage.setCustomColor(text.toUpperCase()); // Apply changes live
    }
  };

  return (
    <View className="p-4 border-b border-[#262626]">
      <Text className="text-white text-base mb-3">Customize Color</Text>

      {/* Hex Input Field */}
      <View className="mb-4">
        <Text className="text-gray-400 text-sm mb-2">Hex Value</Text>
        <TextInput
          className="text-white text-base px-4 py-3 rounded-lg"
          style={{
            backgroundColor: '#262626',
            borderColor: /^#([0-9A-Fa-f]{3}){1,2}$/.test(customHex)
              ? primary
              : 'gray',
            borderWidth: 1,
          }}
          placeholder="e.g., #FF6347"
          placeholderTextColor="gray"
          value={customHex}
          onChangeText={handleHexChange}
        />
      </View>

      {/* Chosen Color Display */}
      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-white text-base">Current Color</Text>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: primary,
            borderWidth: 1,
            borderColor: '#3A3A3A',
          }}
        />
      </View>
    </View>
  );
};

const Preferences = () => {
  const {primary, setPrimary, isCustom, setCustom} = useThemeStore(state => ({
    primary: state.primary,
    setPrimary: state.setPrimary,
    isCustom: state.isCustom,
    setCustom: state.setCustom,
  }));

  const [showRecentlyWatched, setShowRecentlyWatched] = useState(
    settingsStorage.getBool('showRecentlyWatched') || false,
  );
  const [disableDrawer, setDisableDrawer] = useState(
    settingsStorage.getBool('disableDrawer') || false,
  );

  const [ExcludedQualities, setExcludedQualities] = useState<string[]>(
    settingsStorage.getExcludedQualities() || [],
  );

  const [showMediaControls, setShowMediaControls] = useState<boolean>(
    settingsStorage.showMediaControls() || false,
  );

  const [showHamburgerMenu, setShowHamburgerMenu] = useState<boolean>(
    settingsStorage.showHamburgerMenu() || false,
  );

  const [hideSeekButtons, setHideSeekButtons] = useState<boolean>(
    settingsStorage.hideSeekButtons() || false,
  );

  const [enable2xGesture, setEnable2xGesture] = useState<boolean>(
    settingsStorage.isEnable2xGestureEnabled() || false,
  );

  const [enableSwipeGesture, setEnableSwipeGesture] = useState<boolean>(
    settingsStorage.isSwipeGestureEnabled() || false,
  );

  const [showTabBarLables, setShowTabBarLables] = useState<boolean>(
    settingsStorage.showTabBarLabels() || false,
  );

  const [OpenExternalPlayer, setOpenExternalPlayer] = useState(
    settingsStorage.getBool('useExternalPlayer', false) || false,
  );

  const [hapticFeedback, setHapticFeedback] = useState(
    settingsStorage.isHapticFeedbackEnabled() || false,
  );

  const [alwaysUseExternalDownload, setAlwaysUseExternalDownload] = useState(
    settingsStorage.getBool('alwaysExternalDownloader') || false,
  );

  return (
    <ScrollView
      className="w-full h-full bg-black"
      contentContainerStyle={{
        paddingTop: StatusBar.currentHeight || 0,
      }}>
      <View className="p-5">
        <Text className="text-2xl font-bold text-white mb-6">Preferences</Text>

        {/* --- Theme Section: Refactored and Improved UI --- */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-3">Appearance</Text>
          <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
            {/* Theme Selector Dropdown */}
            <View className="flex-row items-center px-4 justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Theme</Text>
              <View className="w-36">
                <Dropdown
                  selectedTextStyle={{
                    color: 'white',
                    fontSize: 14,
                    fontWeight: '500',
                  }}
                  containerStyle={{
                    backgroundColor: '#262626',
                    borderRadius: 8,
                    borderWidth: 0,
                    marginTop: 4,
                  }}
                  itemTextStyle={{color: 'white'}}
                  activeColor="#3A3A3A"
                  itemContainerStyle={{
                    backgroundColor: '#262626',
                    borderWidth: 0,
                  }}
                  style={{
                    backgroundColor: '#262626',
                    borderWidth: 0,
                  }}
                  iconStyle={{tintColor: 'white'}}
                  placeholderStyle={{color: 'white'}}
                  labelField="name"
                  valueField="color"
                  data={themes}
                  value={isCustom ? 'custom' : primary}
                  onChange={value => {
                    if (value.name === 'Custom') {
                      setCustom(true);
                      const initialCustom =
                        settingsStorage.getCustomColor() || '#FF6347';
                      setPrimary(initialCustom);
                      return;
                    }
                    setCustom(false);
                    setPrimary(value.color);
                    settingsStorage.setCustomColor(value.color);
                  }}
                />
              </View>
            </View>

            {/* HSL Color Picker UI - visible only when isCustom is true */}
            {isCustom && (
              <>
                <ThemeCustomizer primary={primary} setPrimary={setPrimary} />
                <View className="p-4 border-b border-[#262626]">
                  <ThemePreview primary={primary} />
                </View>
              </>
            )}

            {/* Haptic Feedback */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Haptic Feedback</Text>
              <Switch
                thumbColor={hapticFeedback ? primary : 'gray'}
                value={hapticFeedback}
                onValueChange={() => {
                  settingsStorage.setHapticFeedbackEnabled(!hapticFeedback);
                  setHapticFeedback(!hapticFeedback);
                }}
              />
            </View>

            {/* Show Tab Bar Labels */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Show Tab Bar Labels</Text>
              <Switch
                thumbColor={showTabBarLables ? primary : 'gray'}
                value={showTabBarLables}
                onValueChange={() => {
                  settingsStorage.setShowTabBarLabels(!showTabBarLables);
                  setShowTabBarLables(!showTabBarLables);
                  // Use a platform check and try-catch for maximum safety
                  if (Platform.OS === 'android') {
                    try {
                      ToastAndroid.show(
                        'Restart App to Apply Changes',
                        ToastAndroid.SHORT,
                      );
                    } catch (e) {
                      console.error('Failed to show ToastAndroid:', e);
                    }
                  }
                }}
              />
            </View>

            {/* Show Hamburger Menu */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Show Hamburger Menu</Text>
              <Switch
                thumbColor={showHamburgerMenu ? primary : 'gray'}
                value={showHamburgerMenu}
                onValueChange={() => {
                  settingsStorage.setShowHamburgerMenu(!showHamburgerMenu);
                  setShowHamburgerMenu(!showHamburgerMenu);
                }}
              />
            </View>

            {/* Show Recently Watched */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">
                Show Recently Watched
              </Text>
              <Switch
                thumbColor={showRecentlyWatched ? primary : 'gray'}
                value={showRecentlyWatched}
                onValueChange={() => {
                  settingsStorage.setBool(
                    'showRecentlyWatched',
                    !showRecentlyWatched,
                  );
                  setShowRecentlyWatched(!showRecentlyWatched);
                }}
              />
            </View>

            {/* Disable Drawer */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Disable Drawer</Text>
              <Switch
                thumbColor={disableDrawer ? primary : 'gray'}
                value={disableDrawer}
                onValueChange={() => {
                  settingsStorage.setBool('disableDrawer', !disableDrawer);
                  setDisableDrawer(!disableDrawer);
                }}
              />
            </View>

            {/* Always Use External Downloader */}
            <View className="flex-row items-center justify-between p-4">
              <Text className="text-white text-base">
                Always Use External Downloader
              </Text>
              <Switch
                thumbColor={alwaysUseExternalDownload ? primary : 'gray'}
                value={alwaysUseExternalDownload}
                onValueChange={() => {
                  settingsStorage.setBool(
                    'alwaysExternalDownloader',
                    !alwaysUseExternalDownload,
                  );
                  setAlwaysUseExternalDownload(!alwaysUseExternalDownload);
                }}
              />
            </View>
          </View>
        </View>

        {/* Player Settings */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-3">Player</Text>
          <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
            {/* External Player */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">
                Always Use External Player
              </Text>
              <Switch
                thumbColor={OpenExternalPlayer ? primary : 'gray'}
                value={OpenExternalPlayer}
                onValueChange={val => {
                  settingsStorage.setBool('useExternalPlayer', val);
                  setOpenExternalPlayer(val);
                }}
              />
            </View>

            {/* Media Controls */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Media Controls</Text>
              <Switch
                thumbColor={showMediaControls ? primary : 'gray'}
                value={showMediaControls}
                onValueChange={() => {
                  settingsStorage.setShowMediaControls(!showMediaControls);
                  setShowMediaControls(!showMediaControls);
                }}
              />
            </View>

            {/* Hide Seek Buttons */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Hide Seek Buttons</Text>
              <Switch
                thumbColor={hideSeekButtons ? primary : 'gray'}
                value={hideSeekButtons}
                onValueChange={() => {
                  settingsStorage.setHideSeekButtons(!hideSeekButtons);
                  setHideSeekButtons(!hideSeekButtons);
                }}
              />
            </View>

            {/* Swipe Gestures */}
            <View className="flex-row items-center justify-between p-4">
              <Text className="text-white text-base">
                Enable Swipe Gestures
              </Text>
              <Switch
                thumbColor={enableSwipeGesture ? primary : 'gray'}
                value={enableSwipeGesture}
                onValueChange={() => {
                  settingsStorage.setSwipeGestureEnabled(!enableSwipeGesture);
                  setEnableSwipeGesture(!enableSwipeGesture);
                }}
              />
            </View>
          </View>
        </View>

        {/* Quality Settings */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-3">Quality</Text>
          <View className="bg-[#1A1A1A] rounded-xl p-4">
            <Text className="text-white text-base mb-3">
              Excluded Qualities
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {['360p', '480p', '720p'].map((quality, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    if (settingsStorage.isHapticFeedbackEnabled()) {
                      RNReactNativeHapticFeedback.trigger('effectTick');
                    }
                    const newExcluded = ExcludedQualities.includes(quality)
                      ? ExcludedQualities.filter(q => q !== quality)
                      : [...ExcludedQualities, quality];
                    setExcludedQualities(newExcluded);
                    settingsStorage.setExcludedQualities(newExcluded);
                  }}
                  style={{
                    backgroundColor: ExcludedQualities.includes(quality)
                      ? primary
                      : '#262626',
                  }}
                  className="px-4 py-2 rounded-lg">
                  <Text className="text-white text-sm">{quality}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View className="h-16" />
      </View>
    </ScrollView>
  );
};

export default Preferences;
