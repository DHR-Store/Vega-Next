import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  ToastAndroid,
  StatusBar,
  TextInput,
  DeviceEventEmitter,
} from 'react-native';
import React, {useState, useEffect} from 'react';
import {MMKV} from '../../lib/Mmkv';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useThemeStore from '../../lib/zustand/themeStore';
import {Dropdown} from 'react-native-element-dropdown';
import {themes} from '../../lib/constants';
import {extensionManager} from '../../lib/services/ExtensionManager';

// --- Constants for New Features ---
const dnsProviders = [
  {name: 'Default (ISP/System)', value: ''},
  {name: 'Cloudflare (1.1.1.1)', value: 'https://cloudflare-dns.com/dns-query'},
  {name: 'Google (8.8.8.8)', value: 'https://dns.google/dns-query'},
  {name: 'AdGuard (AdBlock)', value: 'https://dns.adguard-dns.com/dns-query'},
  {name: 'Quad9 (Security)', value: 'https://dns.quad9.net/dns-query'},
  {name: 'Custom', value: 'custom'},
];

const userAgents = [
  {name: 'Default (Android)', value: ''},
  {
    name: 'Chrome (Windows)',
    value:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  {
    name: 'Firefox (Windows)',
    value:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  },
  {
    name: 'Safari (macOS)',
    value:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  },
  {
    name: 'iPhone (iOS)',
    value:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  },
  {name: 'Custom', value: 'custom'},
];

// Helper to prevent "false" string vs false boolean bugs from MMKV
const safeGetBool = (key: string, defaultValue: boolean) => {
  const val = MMKV.getBool(key);
  if (val === 'false' || val === false) return false;
  if (val === 'true' || val === true) return true;
  return defaultValue;
};

const Preferences = () => {
  const {primary, setPrimary, isCustom, setCustom} = useThemeStore(
    state => state,
  );

  // Existing States initialized safely
  const [showRecentlyWatched, setShowRecentlyWatched] = useState(
    safeGetBool('showRecentlyWatched', true),
  );
  const [disableDrawer, setDisableDrawer] = useState(
    safeGetBool('disableDrawer', false),
  );
  const [ExcludedQualities, setExcludedQualities] = useState(
    MMKV.getArray('ExcludedQualities') || [],
  );
  const [customColor, setCustomColor] = useState(
    MMKV.getString('customColor') || '#FF6347',
  );
  const [showMediaControls, setShowMediaControls] = useState<boolean>(
    safeGetBool('showMediaControls', true),
  );
  const [showHamburgerMenu, setShowHamburgerMenu] = useState<boolean>(
    safeGetBool('showHamburgerMenu', true),
  );
  const [hideSeekButtons, setHideSeekButtons] = useState<boolean>(
    safeGetBool('hideSeekButtons', false),
  );
  const [enableSwipeGesture, setEnableSwipeGesture] = useState<boolean>(
    safeGetBool('enableSwipeGesture', true),
  );
  const [showTabBarLables, setShowTabBarLables] = useState<boolean>(
    safeGetBool('showTabBarLables', false),
  );
  const [OpenExternalPlayer, setOpenExternalPlayer] = useState(
    safeGetBool('useExternalPlayer', false),
  );
  const [hapticFeedback, setHapticFeedback] = useState(
    safeGetBool('hapticFeedback', false),
  );
  const [alwaysUseExternalDownload, setAlwaysUseExternalDownload] = useState(
    safeGetBool('alwaysExternalDownloader', false),
  );

  // New States for DNS and User Agent
  const [dnsUrl, setDnsUrl] = useState(MMKV.getString('dnsUrl') || '');
  const [userAgent, setUserAgent] = useState(MMKV.getString('userAgent') || '');

  // Developer States
  const [developerMode, setDeveloperMode] = useState<boolean>(
    safeGetBool('developerMode', false),
  );
  const [testBaseUrl, setTestBaseUrl] = useState<string>(
    MMKV.getString('testBaseUrl') || 'http://10.0.2.2:3000',
  );

  const [autoPip, setAutoPip] = useState<boolean>(false);

  // FIXED: Reusable function to dynamically check preference before vibrating
  const triggerHaptic = () => {
    if (hapticFeedback) {
      RNReactNativeHapticFeedback.trigger('effectTick');
    }
  };

  // Sync data values to Extension Manager initialization loop
  useEffect(() => {
    extensionManager.setTestMode(developerMode);
    extensionManager.setBaseUrlTestMode(testBaseUrl);
  }, [developerMode, testBaseUrl]);

  useEffect(() => {
    // Retrieve saved value on mount (defaults to false if not set)
    const savedAutoPip = MMKV.getBool ? MMKV.getBool('AutoPip') : false;
    setAutoPip(!!savedAutoPip);
  }, []);

  return (
    <ScrollView
      className="w-full h-full bg-black"
      contentContainerStyle={{
        paddingTop: StatusBar.currentHeight || 0,
        paddingBottom: 50,
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
                      }}
                      placeholder="Hex Color"
                      placeholderTextColor="gray"
                      value={customColor}
                      onChangeText={setCustomColor}
                      onSubmitEditing={e => {
                        if (e.nativeEvent.text.length < 7) {
                          ToastAndroid.show(
                            'Invalid Color',
                            ToastAndroid.SHORT,
                          );
                          return;
                        }
                        triggerHaptic();
                        MMKV.setString('customColor', e.nativeEvent.text);
                        setPrimary(e.nativeEvent.text);
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        triggerHaptic();
                        setCustom(false);
                        setPrimary('#FF6347');
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
                      triggerHaptic();
                      if (value.name === 'Custom') {
                        setCustom(true);
                        setPrimary(customColor);
                        return;
                      }
                      setPrimary(value.color);
                    }}
                  />
                )}
              </View>
            </View>

            {/* Haptic Feedback Switch */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Haptic Feedback</Text>
              <Switch
                thumbColor={hapticFeedback ? primary : 'gray'}
                value={hapticFeedback}
                onValueChange={() => {
                  // Vibrate before disabling if it was on, or vibrate upon turning back on
                  if (hapticFeedback) {
                    RNReactNativeHapticFeedback.trigger('effectTick');
                  }
                  const nextVal = !hapticFeedback;
                  MMKV.setBool('hapticFeedback', nextVal);
                  setHapticFeedback(nextVal);

                  // If it's freshly turned on, trigger feedback acknowledgment
                  if (nextVal) {
                    setTimeout(
                      () => RNReactNativeHapticFeedback.trigger('effectTick'),
                      50,
                    );
                  }
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
                  triggerHaptic();
                  const newVal = !showTabBarLables;
                  MMKV.setBool('showTabBarLables', newVal);
                  setShowTabBarLables(newVal);
                  DeviceEventEmitter.emit('changeTabBarLabel', newVal);
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
                  triggerHaptic();
                  MMKV.setBool('showHamburgerMenu', !showHamburgerMenu);
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
                  triggerHaptic();
                  const newVal = !showRecentlyWatched;
                  MMKV.setBool('showRecentlyWatched', newVal);
                  setShowRecentlyWatched(newVal);
                  DeviceEventEmitter.emit('changeRecentlyWatched', newVal);
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
                  triggerHaptic();
                  MMKV.setBool('disableDrawer', !disableDrawer);
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
                  triggerHaptic();
                  MMKV.setBool(
                    'alwaysExternalDownloader',
                    !alwaysUseExternalDownload,
                  );
                  setAlwaysUseExternalDownload(!alwaysUseExternalDownload);
                }}
              />
            </View>
          </View>
        </View>

        {/* Picture in Picture Settings */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-3">Player Settings</Text>
          <View className="bg-[#1A1A1A] rounded-xl p-4 flex-row justify-between items-center">
            <View className="flex-1 pr-4">
              <Text className="text-white text-base mb-1">
                Auto Picture-in-Picture
              </Text>
              <Text className="text-gray-400 text-xs">
                Automatically switch to PiP mode when home button is pressed.
              </Text>
            </View>
            <Switch
              value={autoPip}
              onValueChange={value => {
                if (typeof triggerHaptic === 'function') triggerHaptic();
                setAutoPip(value);
                if (MMKV.setBool) {
                  MMKV.setBool('AutoPip', value);
                } else if (MMKV.set) {
                  MMKV.set('AutoPip', value);
                }
              }}
              trackColor={{false: '#262626', true: primary}}
              thumbColor={autoPip ? '#white' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* --- Custom Cloud Features --- */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-3">
            Custom Cloud Features
          </Text>
          <View className="bg-[#1A1A1A] rounded-xl overflow-hidden p-4">
            {/* Custom DNS (DoH) */}
            <View className="mb-4">
              <Text className="text-white text-base mb-2">
                Custom DNS (DoH)
              </Text>
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
                }}
                itemTextStyle={{color: 'white'}}
                activeColor="#3A3A3A"
                itemContainerStyle={{
                  backgroundColor: '#262626',
                  borderWidth: 0,
                }}
                style={{
                  backgroundColor: '#262626',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
                placeholderStyle={{color: 'gray'}}
                iconStyle={{tintColor: 'white'}}
                data={dnsProviders}
                labelField="name"
                valueField="value"
                value={
                  dnsProviders.some(p => p.value === dnsUrl) ? dnsUrl : 'custom'
                }
                onChange={item => {
                  triggerHaptic();
                  if (item.value !== 'custom') {
                    MMKV.setString('dnsUrl', item.value);
                    setDnsUrl(item.value);
                    ToastAndroid.show(`DNS: ${item.name}`, ToastAndroid.SHORT);
                  }
                }}
              />

              {/* Custom DNS Input */}
              {(dnsUrl === 'custom' ||
                (!dnsProviders.some(d => d.value === dnsUrl) &&
                  dnsUrl !== '')) && (
                <View className="mt-3">
                  <TextInput
                    style={{
                      color: 'white',
                      backgroundColor: '#262626',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: 14,
                    }}
                    placeholder="https://..."
                    placeholderTextColor="gray"
                    defaultValue={dnsUrl}
                    onSubmitEditing={e => {
                      triggerHaptic();
                      MMKV.setString('dnsUrl', e.nativeEvent.text);
                      setDnsUrl(e.nativeEvent.text);
                      ToastAndroid.show('Custom DNS Saved', ToastAndroid.SHORT);
                    }}
                  />
                  <Text className="text-gray-500 text-xs mt-2 ml-1">
                    Enter a valid DNS-over-HTTPS URL.
                  </Text>
                </View>
              )}
            </View>

            {/* User Agent */}
            <View>
              <Text className="text-white text-base mb-2">User Agent</Text>
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
                }}
                itemTextStyle={{color: 'white'}}
                activeColor="#3A3A3A"
                itemContainerStyle={{
                  backgroundColor: '#262626',
                  borderWidth: 0,
                }}
                style={{
                  backgroundColor: '#262626',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
                placeholderStyle={{color: 'gray'}}
                iconStyle={{tintColor: 'white'}}
                data={userAgents}
                labelField="name"
                valueField="value"
                value={
                  userAgents.some(ua => ua.value === userAgent)
                    ? userAgent
                    : 'custom'
                }
                onChange={item => {
                  triggerHaptic();
                  if (item.value !== 'custom') {
                    MMKV.setString('userAgent', item.value);
                    setUserAgent(item.value);
                    ToastAndroid.show(
                      `Applied: ${item.name}`,
                      ToastAndroid.SHORT,
                    );
                  }
                }}
              />

              {/* Custom User Agent Input */}
              {(userAgent === 'custom' ||
                (!userAgents.some(ua => ua.value === userAgent) &&
                  userAgent !== '')) && (
                <TextInput
                  style={{
                    color: 'white',
                    backgroundColor: '#262626',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 14,
                    marginTop: 12,
                  }}
                  placeholder="Enter custom User-Agent..."
                  placeholderTextColor="gray"
                  defaultValue={userAgent}
                  onSubmitEditing={e => {
                    triggerHaptic();
                    MMKV.setString('userAgent', e.nativeEvent.text);
                    setUserAgent(e.nativeEvent.text);
                    ToastAndroid.show('Custom UA Saved', ToastAndroid.SHORT);
                  }}
                />
              )}
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
                  triggerHaptic();
                  MMKV.setBool('useExternalPlayer', val);
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
                  triggerHaptic();
                  MMKV.setBool('showMediaControls', !showMediaControls);
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
                  triggerHaptic();
                  MMKV.setBool('hideSeekButtons', !hideSeekButtons);
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
                  triggerHaptic();
                  MMKV.setBool('enableSwipeGesture', !enableSwipeGesture);
                  setEnableSwipeGesture(!enableSwipeGesture);
                }}
              />
            </View>
          </View>
        </View>

        {/* Developer Settings */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-3">Developer</Text>
          <View className="bg-[#1A1A1A] rounded-xl overflow-hidden p-4">
            <View className="flex-row items-center justify-between pb-4 border-b border-[#262626]">
              <Text className="text-white text-base">
                Enable Provider Test Mode
              </Text>
              <Switch
                thumbColor={developerMode ? primary : 'gray'}
                value={developerMode}
                onValueChange={val => {
                  triggerHaptic();
                  MMKV.setBool('developerMode', val);
                  setDeveloperMode(val);
                  extensionManager.setTestMode(val);
                  ToastAndroid.show(
                    `Test Mode ${val ? 'Enabled' : 'Disabled'}`,
                    ToastAndroid.SHORT,
                  );
                }}
              />
            </View>

            {developerMode && (
              <View className="mt-4">
                <Text className="text-white text-base mb-2">
                  Localhost Base URL
                </Text>
                <TextInput
                  style={{
                    color: 'white',
                    backgroundColor: '#262626',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 14,
                  }}
                  placeholder="http://10.0.2.2:3000"
                  placeholderTextColor="gray"
                  defaultValue={testBaseUrl}
                  onSubmitEditing={e => {
                    triggerHaptic();
                    const newUrl = e.nativeEvent.text;
                    MMKV.setString('testBaseUrl', newUrl);
                    setTestBaseUrl(newUrl);
                    extensionManager.setBaseUrlTestMode(newUrl);
                    ToastAndroid.show('Test URL Saved', ToastAndroid.SHORT);
                  }}
                />
              </View>
            )}
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
                    triggerHaptic();
                    const newExcluded = ExcludedQualities.includes(quality)
                      ? ExcludedQualities.filter(q => q !== quality)
                      : [...ExcludedQualities, quality];
                    setExcludedQualities(newExcluded);
                    MMKV.setArray('ExcludedQualities', newExcluded);
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
