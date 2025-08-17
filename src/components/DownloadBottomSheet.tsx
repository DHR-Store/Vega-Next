import {
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Dimensions,
  ToastAndroid,
  View,
  PermissionsAndroid,
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

type Props = {
  data: Stream[];
  loading: boolean;
  title: string;
  showModal: boolean;
  setModal: (value: boolean) => void;
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
   * Handles the download internally using the 'fetch' API.
   * @param {Stream} item - The stream item to "download".
   * @param {'video' | 'subtitle'} fileType - The type of file being "downloaded".
   */
  const startInternalDownload = async (
    item: Stream,
    fileType: 'video' | 'subtitle',
  ) => {
    const {link, title: itemTitle, server} = item;
    try {
      ToastAndroid.show(
        `Starting download for ${itemTitle || server}...`,
        ToastAndroid.SHORT,
      );

      const response = await fetch(link);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Open the downloaded file in an external app
      Linking.openURL(objectUrl)
        .then(() => {
          ToastAndroid.show(
            'Download opened in a new window.',
            ToastAndroid.SHORT,
          );
        })
        .catch(err => {
          ToastAndroid.show(
            'Could not open file in another application.',
            ToastAndroid.SHORT,
          );
          console.error('An error occurred opening the file: ', err);
        });
    } catch (err) {
      ToastAndroid.show('Download failed!', ToastAndroid.SHORT);
      console.error('Download error:', err);
    } finally {
      bottomSheetRef.current?.close();
    }
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
                            startInternalDownload(item, 'video');
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
                                startInternalDownload(subItem, 'subtitle');
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
