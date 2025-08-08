import {
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Dimensions,
  ToastAndroid,
  View,
  PermissionsAndroid, // Still imported, but its usage will be simplified
  Platform,
  Linking,
} from 'react-native';
import React, {useEffect, useRef} from 'react';
import {Stream} from '../lib/providers/types';
import BottomSheet, {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import SkeletonLoader from './Skeleton';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {Clipboard} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import {TextTrackType} from 'react-native-video';
import {settingsStorage} from '../lib/storage';

// Removed: import RNFS from 'react-native-fs';
// Removed: import PushNotification from 'react-native-push-notification';

type Props = {
  data: Stream[];
  loading: boolean;
  title: string;
  showModal: boolean;
  setModal: (value: boolean) => void;
  // Re-added the props from the original file for external downloads
  onPressVideo: (item: any) => void;
  onPressSubs: (item: any) => void;
  /**
   * @property {boolean} isExternalDownloadMode - If true, downloads will attempt to open in an external browser.
   * If false, the app will try to handle the download internally (requiring permissions).
   * This prop should be controlled by your app's settings or preferences.
   */
  isExternalDownloadMode: boolean;
};

const DownloadBottomSheet = ({
  data,
  loading,
  showModal,
  setModal,
  title,
  onPressSubs,
  onPressVideo,
  isExternalDownloadMode,
}: Props) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const {primary} = useThemeStore(state => state);
  const [activeTab, setActiveTab] = React.useState<1 | 2>(1);

  const subtitle = data?.map(server => {
    if (server.subtitles && server.subtitles.length > 0) {
      return server.subtitles;
    }
  });

  useEffect(() => {
    if (showModal) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [showModal]);

  // Removed: useEffect for PushNotification.createChannel

  /**
   * Attempts to open a given URL in the device's default web browser.
   * This is used when `isExternalDownloadMode` is true.
   * @param {string} url - The URL to open.
   */
  const openLinkInBrowser = (url: string) => {
    Linking.openURL(url).catch(err =>
      ToastAndroid.show(
        `Couldn't open URL: ${err.message}`,
        ToastAndroid.SHORT,
      ),
    );
  };

  /**
   * Placeholder for requesting download permissions and initiating an internal download.
   * Without `react-native-fs`, this function will only show toast messages.
   * @param {Stream} item - The stream item to "download".
   * @param {'video' | 'subtitle'} fileType - The type of file being "downloaded".
   */
  const requestDownloadPermissionAndStart = async (
    item: Stream,
    fileType: 'video' | 'subtitle',
  ) => {
    if (Platform.OS === 'android') {
      // With RNFS removed, explicit storage permissions are not directly handled by this component.
      // Modern Android versions (API 29+) do not require WRITE_EXTERNAL_STORAGE for public downloads.
      // For older versions, if a custom download mechanism were implemented without RNFS,
      // it would need to handle permissions. For now, we'll just proceed with the placeholder.
      ToastAndroid.show(
        'Attempting internal download (functionality is a placeholder without a download library).',
        ToastAndroid.SHORT,
      );
      startInternalDownload(item, fileType);
    } else {
      // iOS permissions are handled differently. We can proceed with the placeholder directly here.
      ToastAndroid.show('Starting download...', ToastAndroid.SHORT);
      startInternalDownload(item, fileType);
    }
  };

  /**
   * Placeholder function for initiating the actual internal download process.
   * Without `react-native-fs`, this function will only show a toast and close the bottom sheet.
   * @param {Stream} item - The stream item to "download".
   * @param {'video' | 'subtitle'} fileType - The type of file being "downloaded".
   */
  const startInternalDownload = (
    item: Stream,
    fileType: 'video' | 'subtitle',
  ) => {
    // This is now purely a placeholder. No actual file download occurs here.
    console.log(`Attempting to "download" ${fileType}: ${item.link}`);
    ToastAndroid.show(
      `"Downloading" ${item.server || item.title}... (Placeholder)`,
      ToastAndroid.SHORT,
    );
    bottomSheetRef.current?.close();
  };

  return (
    <Modal
      onRequestClose={() => {
        bottomSheetRef.current?.close();
      }}
      visible={showModal}
      transparent={true}>
      <GestureHandlerRootView>
        <Pressable
          onPress={() => bottomSheetRef.current?.close()}
          className="flex-1">
          <BottomSheet
            // detached={true}
            enablePanDownToClose={true}
            snapPoints={['30%', 450]}
            containerStyle={{marginHorizontal: 5}}
            ref={bottomSheetRef}
            backgroundStyle={{backgroundColor: '#1a1a1a'}}
            handleIndicatorStyle={{backgroundColor: '#333'}}
            onClose={() => setModal(false)}>
            <Pressable className="flex-1" onPress={e => e.stopPropagation()}>
              <Text className="text-white text-xl p-1 font-semibold text-center">
                {title}
              </Text>
              <BottomSheetScrollView
                style={{padding: 5, marginBottom: 5}}
                showsVerticalScrollIndicator={false}>
                {subtitle.length > 0 && subtitle[0] !== undefined && (
                  <View className="flex-row items-center justify-center gap-x-3 w-full my-5">
                    <Text
                      className={'text-lg p-1 font-semibold text-center'}
                      style={{
                        color: activeTab === 1 ? primary : 'white',
                        borderBottomWidth: activeTab === 1 ? 2 : 0,
                        borderBottomColor:
                          activeTab === 1 ? 'white' : 'transparent',
                      }}
                      onPress={() => setActiveTab(1)}>
                      Video
                    </Text>
                    <Text
                      className={'text-lg p-1 font-semibold text-center'}
                      style={{
                        color: activeTab === 2 ? primary : 'white',
                        borderBottomWidth: activeTab === 2 ? 2 : 0,
                        borderBottomColor:
                          activeTab === 2 ? 'white' : 'transparent',
                      }}
                      onPress={() => setActiveTab(2)}>
                      Subtitle
                    </Text>
                  </View>
                )}
                {loading
                  ? Array.from({length: 4}).map((_, index) => (
                      <SkeletonLoader
                        key={index}
                        width={Dimensions.get('window').width - 30}
                        height={35}
                        marginVertical={5}
                      />
                    ))
                  : activeTab === 1
                  ? data.map((item, index) => (
                      <TouchableOpacity
                        className="p-2 bg-white/30 rounded-md my-1"
                        key={`${item.link}-${index}`}
                        onLongPress={() => {
                          if (settingsStorage.isHapticFeedbackEnabled()) {
                            RNReactNativeHapticFeedback.trigger('effectTick', {
                              enableVibrateFallback: true,
                              ignoreAndroidSystemSettings: false,
                            });
                          }
                          Clipboard.setString(item.link);
                          ToastAndroid.show('Link copied', ToastAndroid.SHORT);
                        }}
                        onPress={() => {
                          // Logic to decide between external and internal "download" for video
                          if (isExternalDownloadMode) {
                            // If external download mode is enabled, open the link in a browser
                            openLinkInBrowser(item.link);
                          } else {
                            // Otherwise, trigger the placeholder internal "download"
                            requestDownloadPermissionAndStart(item, 'video');
                          }
                        }}>
                        <Text style={{color: 'white'}}>{item.server}</Text>
                      </TouchableOpacity>
                    ))
                  : subtitle.length > 0
                  ? subtitle.map(
                      subs =>
                        subs?.map((item, index) => (
                          <TouchableOpacity
                            className="p-2 bg-white/30 rounded-md my-1"
                            key={`${item.uri}-${index}`}
                            onLongPress={() => {
                              if (settingsStorage.isHapticFeedbackEnabled()) {
                                RNReactNativeHapticFeedback.trigger(
                                  'effectTick',
                                  {
                                    enableVibrateFallback: true,
                                    ignoreAndroidSystemSettings: false,
                                  },
                                );
                              }
                              Clipboard.setString(item.uri);
                              ToastAndroid.show(
                                'Link copied',
                                ToastAndroid.SHORT,
                              );
                            }}
                            onPress={() => {
                              // Logic to decide between external and internal "download" for subtitles
                              if (isExternalDownloadMode) {
                                // If external download mode is enabled, open the URI in a browser
                                openLinkInBrowser(item.uri);
                              } else {
                                // Otherwise, prepare subtitle item and trigger the placeholder internal "download"
                                const subItem = {
                                  ...item,
                                  link: item.uri,
                                  server: 'Subtitles',
                                  type:
                                    item.type === TextTrackType.VTT
                                      ? 'vtt'
                                      : 'srt',
                                };
                                requestDownloadPermissionAndStart(
                                  subItem,
                                  'subtitle',
                                );
                              }
                            }}>
                            <Text style={{color: 'white'}}>
                              {item.language}
                              {' - '} {item.title}
                            </Text>
                          </TouchableOpacity>
                        )),
                    )
                  : null}
                {data.length === 0 && !loading && (
                  <Text className="text-red-500 text-lg text-center">
                    No server found
                  </Text>
                )}
              </BottomSheetScrollView>
            </Pressable>
          </BottomSheet>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default DownloadBottomSheet;
