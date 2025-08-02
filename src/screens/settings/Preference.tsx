import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  ToastAndroid,
  StatusBar,
  TextInput,
} from 'react-native';
import React, {useState, useEffect} from 'react';
import {settingsStorage} from '../../lib/storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useThemeStore from '../../lib/zustand/themeStore';
import {Dropdown} from 'react-native-element-dropdown';
import {themes} from '../../lib/constants';

// Utility functions for HSL <-> Hex conversions
// HSL to RGB conversion
const hslToRgb = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;

  let c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs((h / 60) % 2 - 1)),
    m = l - c / 2,
    r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return [r, g, b];
};

// RGB to Hex conversion
const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

// Combined HSL to Hex
const hslToHexCombined = (h: number, s: number, l: number) => {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
};

// Hex to RGB conversion
const hexToRgb = (hex: string) => {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
};

// RGB to HSL conversion
const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [h * 360, s * 100, l * 100]; // Return HSL in degrees and percentages
};

// Combined Hex to HSL
const hexToHslCombined = (hex: string) => {
  if (!hex || !/^#([0-9A-Fa-f]{3}){1,2}$/.test(hex)) {
    // Return a default HSL if hex is invalid or empty
    return [0, 100, 50]; // Default to red (Hue: 0, Saturation: 100, Lightness: 50)
  }
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b);
};

interface ColorMixerProps {
  primary: string;
  setPrimary: (color: string) => void;
  customColor: string;
  setCustomColor: (color: string) => void;
  isHapticFeedbackEnabled: () => boolean;
}

const ColorMixer: React.FC<ColorMixerProps> = ({
  primary,
  setPrimary,
  customColor,
  setCustomColor,
  isHapticFeedbackEnabled,
}) => {
  // HSL Color Picker States
  const [hue, setHue] = useState(0); // 0-360
  const [saturation, setSaturation] = useState(100); // 0-100
  const [lightness, setLightness] = useState(50); // 0-100 (often called Value or Brightness)

  // State to store the width of each slider track for positioning the thumb
  const [hueSliderWidth, setHueSliderWidth] = useState(0);
  const [saturationSliderWidth, setSaturationSliderWidth] = useState(0);
  const [lightnessSliderWidth, setLightnessSliderWidth] = useState(0);

  // Effect to update HSL sliders when primary color changes (e.g., when theme is set to custom or hex input changes)
  useEffect(() => {
    // Only update if the incoming primary hex is different from the hex derived from current HSL
    const currentHexFromHSL = hslToHexCombined(hue, saturation, lightness);
    if (primary && primary.toUpperCase() !== currentHexFromHSL.toUpperCase()) {
      const [h, s, l] = hexToHslCombined(primary);
      // Only set state if the values are actually different to prevent unnecessary re-renders
      if (Math.round(h) !== Math.round(hue)) setHue(Math.round(h));
      if (Math.round(s) !== Math.round(saturation)) setSaturation(Math.round(s));
      if (Math.round(l) !== Math.round(lightness)) setLightness(Math.round(l));
      setCustomColor(primary); // Keep customColor text input in sync
    }
  }, [primary]); // Depend only on primary, as it's the external source of truth for this effect

  // Effect to update primary color when HSL values change
  useEffect(() => {
    const newHex = hslToHexCombined(hue, saturation, lightness);
    // Only set primary and customColor if the new hex is different from the current primary
    if (newHex.toUpperCase() !== primary.toUpperCase()) {
      setPrimary(newHex);
      setCustomColor(newHex); // Update the TextInput value as well
    }
  }, [hue, saturation, lightness]); // Depend on HSL values

  // Function to handle slider touch
  const handleSliderTouch = (event: any, setter: React.Dispatch<React.SetStateAction<number>>, maxVal: number, currentSliderWidth: number) => {
    // Get the X coordinate relative to the slider track
    const x = event.nativeEvent.locationX;
    // Clamp the position within the slider's width
    const newPosition = Math.max(0, Math.min(x, currentSliderWidth));
    // Calculate the new value based on the position and round it
    const newValue = Math.round((newPosition / currentSliderWidth) * maxVal);

    // Only update state if the new value is different from the current value
    setter(prevValue => (newValue !== prevValue ? newValue : prevValue));

    if (isHapticFeedbackEnabled()) {
      RNReactNativeHapticFeedback.trigger('effectTick');
    }
  };

  // Function to handle setting the color
  const handleSetColor = () => {
    if (isHapticFeedbackEnabled()) {
      RNReactNativeHapticFeedback.trigger('impactLight');
    }
    settingsStorage.setCustomColor(primary);
    ToastAndroid.show('Custom color set!', ToastAndroid.SHORT);
  };

  return (
    <View className="p-4 border-b border-[#262626]">
      <Text className="text-white text-base mb-3">Mix Your Color</Text>

      {/* Hue Slider */}
      <View className="mb-4">
        <Text className="text-gray-400 text-sm mb-2">Hue</Text>
        <View
          onLayout={(event) => setHueSliderWidth(event.nativeEvent.layout.width)}
          onTouchStart={(e) => handleSliderTouch(e, setHue, 360, hueSliderWidth)}
          onTouchMove={(e) => handleSliderTouch(e, setHue, 360, hueSliderWidth)}
          className="h-8 rounded-lg overflow-hidden"
          style={{
            // This background is a compromise for the full spectrum gradient
            // without a LinearGradient component.
            backgroundColor: hslToHexCombined(hue, 100, 50), // Shows the current hue's vibrant color
            position: 'relative',
          }}
        >
          <View
            className="w-4 h-full rounded-full absolute"
            style={{
              backgroundColor: 'white', // Thumb color
              left: (hue / 360) * hueSliderWidth - 8, // Adjust for thumb width (8 = half of thumb width)
              transform: [{ translateY: -2 }], // Center vertically
              borderColor: '#3A3A3A',
              borderWidth: 1,
            }}
          />
        </View>
      </View>

      {/* Saturation Slider */}
      <View className="mb-4">
        <Text className="text-gray-400 text-sm mb-2">Saturation</Text>
        <View
          onLayout={(event) => setSaturationSliderWidth(event.nativeEvent.layout.width)}
          onTouchStart={(e) => handleSliderTouch(e, setSaturation, 100, saturationSliderWidth)}
          onTouchMove={(e) => handleSliderTouch(e, setSaturation, 100, saturationSliderWidth)}
          className="h-8 rounded-lg overflow-hidden"
          style={{
            // Background represents the current color based on hue and lightness
            backgroundColor: hslToHexCombined(hue, saturation, lightness),
            position: 'relative',
          }}
        >
          <View
            className="w-4 h-full rounded-full absolute"
            style={{
              backgroundColor: 'white',
              left: (saturation / 100) * saturationSliderWidth - 8,
              transform: [{ translateY: -2 }],
              borderColor: '#3A3A3A',
              borderWidth: 1,
            }}
          />
        </View>
      </View>

      {/* Lightness (Value) Slider */}
      <View className="mb-4">
        <Text className="text-gray-400 text-sm mb-2">Value</Text>
        <View
          onLayout={(event) => setLightnessSliderWidth(event.nativeEvent.layout.width)}
          onTouchStart={(e) => handleSliderTouch(e, setLightness, 100, lightnessSliderWidth)}
          onTouchMove={(e) => handleSliderTouch(e, setLightness, 100, lightnessSliderWidth)}
          className="h-8 rounded-lg overflow-hidden"
          style={{
            // Background represents the current color based on hue and saturation
            backgroundColor: hslToHexCombined(hue, saturation, lightness),
            position: 'relative',
          }}
        >
          <View
            className="w-4 h-full rounded-full absolute"
            style={{
              backgroundColor: 'white',
              left: (lightness / 100) * lightnessSliderWidth - 8,
              transform: [{ translateY: -2 }],
              borderColor: '#3A3A3A',
              borderWidth: 1,
            }}
          />
        </View>
      </View>

      {/* Chosen Color Display */}
      <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-white text-base">Chosen Color:</Text>
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

      {/* Set Button */}
      <TouchableOpacity
          onPress={handleSetColor}
          className="mt-4 bg-blue-500 py-3 rounded-lg items-center"
      >
          <Text className="text-white text-base font-bold">Set Color</Text>
      </TouchableOpacity>
    </View>
  );
};


const Preferences = () => {
  // --- FIX APPLIED HERE ---
  // Explicitly select all necessary state and actions from the store.
  // This is a robust way to ensure they are defined, assuming they exist
  // within your useThemeStore's state structure.
  const {primary, setPrimary, isCustom, setCustom} = useThemeStore(
    (state) => ({
      primary: state.primary,
      setPrimary: state.setPrimary,
      isCustom: state.isCustom,
      setCustom: state.setCustom,
      // Add any other state or actions you use from useThemeStore here
    })
  );
  // --- END FIX ---

  const [showRecentlyWatched, setShowRecentlyWatched] = useState(
    settingsStorage.getBool('showRecentlyWatched') || false,
  );
  const [disableDrawer, setDisableDrawer] = useState(
    settingsStorage.getBool('disableDrawer') || false,
  );

  const [ExcludedQualities, setExcludedQualities] = useState(
    settingsStorage.getExcludedQualities(),
  );

  const [customColor, setCustomColor] = useState(
    settingsStorage.getCustomColor(),
  );

  const [showMediaControls, setShowMediaControls] = useState<boolean>(
    settingsStorage.showMediaControls(),
  );

  const [showHamburgerMenu, setShowHamburgerMenu] = useState<boolean>(
    settingsStorage.showHamburgerMenu(),
  );

  const [hideSeekButtons, setHideSeekButtons] = useState<boolean>(
    settingsStorage.hideSeekButtons(),
  );

  const [enable2xGesture, setEnable2xGesture] = useState<boolean>(
    settingsStorage.isEnable2xGestureEnabled(),
  );

  const [enableSwipeGesture, setEnableSwipeGesture] = useState<boolean>(
    settingsStorage.isSwipeGestureEnabled(),
  );

  const [showTabBarLables, setShowTabBarLables] = useState<boolean>(
    settingsStorage.showTabBarLabels(),
  );

  const [OpenExternalPlayer, setOpenExternalPlayer] = useState(
    settingsStorage.getBool('useExternalPlayer', false),
  );

  const [hapticFeedback, setHapticFeedback] = useState(
    settingsStorage.isHapticFeedbackEnabled(),
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

        {/* Theme Section */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-3">Appearance</Text>
          <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
            {/* Theme Selector */}
            <View className="flex-row items-center px-4 justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Theme</Text>
              <View className="w-36">
                {isCustom ? (
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      style={{
                        color: 'white',
                        backgroundColor: '#262626',
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        fontSize: 14,
                        flex: 1, // Allow TextInput to take available space
                      }}
                      placeholder="Hex Color"
                      placeholderTextColor="gray"
                      value={customColor}
                      onChangeText={setCustomColor}
                      onSubmitEditing={e => {
                        // Basic validation for hex color (e.g., #RRGGBB or #RGB)
                        const hexRegex = /^#([0-9A-Fa-f]{3}){1,2}$/;
                        const enteredHex = e.nativeEvent.text;
                        if (!hexRegex.test(enteredHex)) {
                          ToastAndroid.show(
                            'Invalid Hex Color (e.g., #RRGGBB or #RGB)',
                            ToastAndroid.SHORT,
                          );
                          return;
                        }
                        settingsStorage.setCustomColor(enteredHex);
                        setPrimary(enteredHex); // This will trigger the useEffect to update HSL sliders
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setCustom(false);
                        setPrimary('#FF6347'); // Revert to default primary color
                        settingsStorage.setCustomColor('#FF6347'); // Also update storage
                      }}>
                      <MaterialCommunityIcons
                        name="close"
                        size={20}
                        color="gray"
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
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
                    value={primary}
                    onChange={value => {
                      if (value.name === 'Custom') {
                        setCustom(true);
                        // When switching to custom, set the primary color to the current customColor
                        // or a default if customColor is not set yet.
                        const initialCustom = settingsStorage.getCustomColor() || '#FF6347';
                        setPrimary(initialCustom);
                        setCustomColor(initialCustom);
                        return;
                      }
                      setCustom(false); // Ensure custom mode is off if a predefined theme is selected
                      setPrimary(value.color);
                      settingsStorage.setCustomColor(value.color); // Store the selected theme color as custom
                    }}
                  />
                )}
              </View>
            </View>

            {/* HSL Color Picker UI - visible only when isCustom is true */}
            {isCustom && (
              <ColorMixer
                primary={primary}
                setPrimary={setPrimary}
                customColor={customColor}
                setCustomColor={setCustomColor}
                isHapticFeedbackEnabled={settingsStorage.isHapticFeedbackEnabled}
              />
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
                  ToastAndroid.show(
                    'Restart App to Apply Changes',
                    ToastAndroid.SHORT,
                  );
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