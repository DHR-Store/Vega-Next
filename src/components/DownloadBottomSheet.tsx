import {
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Dimensions,
  ToastAndroid,
  View,
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
  // FIX: These props are now used only for internal downloads
  onPressVideo: (item: any) => void;
  onPressSubs: (item: any) => void;
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
  isExternalDownloadMode, // New prop to control download behavior
}: Props) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const {primary} = useThemeStore(state => state);
  const [activeTab, setActiveTab] = React.useState<1 | 2>(1);

  const subtitle = data?.map(server => {
    if (server.subtitles && server.subtitles.length > 0) {
      return server.subtitles;
    }
  });

  // Function to open a URL in the browser
  const openLinkInBrowser = async (url: string) => {
    let finalUrl = url;
    // FIX: Add a protocol if it's missing to ensure Linking works
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      finalUrl = `https://${url}`;
    }
    console.log('Attempting to open link externally:', finalUrl);
    try {
      await Linking.openURL(finalUrl);
      ToastAndroid.show('Opening link in browser...', ToastAndroid.SHORT);
    } catch (e) {
      console.error('Failed to open URL:', e);
      ToastAndroid.show('Failed to open link', ToastAndroid.SHORT);
    }
  };

  useEffect(() => {
    if (showModal) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [showModal]);

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
                          console.log(
                            'Video item pressed. External mode:',
                            isExternalDownloadMode,
                          );
                          if (isExternalDownloadMode) {
                            openLinkInBrowser(item.link);
                          } else {
                            onPressVideo(item);
                          }
                          bottomSheetRef.current?.close();
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
                              console.log(
                                'Subtitle item pressed. External mode:',
                                isExternalDownloadMode,
                              );
                              if (isExternalDownloadMode) {
                                openLinkInBrowser(item.uri);
                              } else {
                                onPressSubs({
                                  server: 'Subtitles',
                                  link: item.uri,
                                  type:
                                    item.type === TextTrackType.VTT
                                      ? 'vtt'
                                      : 'srt',
                                  title: item.title,
                                });
                              }
                              bottomSheetRef.current?.close();
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
