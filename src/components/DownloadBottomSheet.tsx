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
import React, {useEffect, useRef, useMemo} from 'react';
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
};

const DownloadBottomSheet = ({
  data,
  loading,
  showModal,
  setModal,
  title,
  onPressSubs,
  onPressVideo,
}: Props) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const {primary} = useThemeStore(state => state);
  const [activeTab, setActiveTab] = React.useState<1 | 2>(1);

  // FIXED: Flatten subtitles into a single array using useMemo.
  // This removes the need for nested maps and makes length checks accurate.
  const parsedSubtitles = useMemo(() => {
    if (!data) return [];
    return data.reduce((acc: any[], server) => {
      if (server.subtitles && server.subtitles.length > 0) {
        return [...acc, ...server.subtitles];
      }
      return acc;
    }, []);
  }, [data]);

  useEffect(() => {
    if (showModal) bottomSheetRef.current?.expand();
    else bottomSheetRef.current?.close();
  }, [showModal]);

  // PRESERVED: External Download/Play Logic for Video
  const handlePressVideo = async (item: Stream) => {
    const useExternal = settingsStorage.getBool(
      'alwaysExternalDownloader',
      false,
    );
    if (useExternal) {
      try {
        await Linking.openURL(item.link);
      } catch (error) {
        console.log('Failed to open external link:', error);
      }
    } else {
      onPressVideo(item);
    }
    bottomSheetRef.current?.close();
  };

  // PRESERVED: External Download/Play Logic for Subtitles
  const handlePressSubs = async (item: {
    link: string;
    type: string;
    title: string;
  }) => {
    const useExternal = settingsStorage.getBool(
      'alwaysExternalDownloader',
      false,
    );
    if (useExternal) {
      try {
        await Linking.openURL(item.link);
      } catch (error) {
        console.log('Failed to open subtitle link:', error);
      }
    } else {
      onPressSubs(item);
    }
    bottomSheetRef.current?.close();
  };

  return (
    <Modal
      onRequestClose={() => bottomSheetRef.current?.close()}
      visible={showModal}
      transparent={true}>
      <GestureHandlerRootView>
        <Pressable
          onPress={() => bottomSheetRef.current?.close()}
          className="flex-1">
          <BottomSheet
            enablePanDownToClose
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
                {/* FIXED: Use parsedSubtitles.length for checking existence */}
                {parsedSubtitles.length > 0 && (
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
                  ? data.map(item => (
                      <TouchableOpacity
                        className="p-2 bg-white/30 rounded-md my-1"
                        key={item.link}
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
                        onPress={() => handlePressVideo(item)}>
                        <Text style={{color: 'white'}}>{item.server}</Text>
                      </TouchableOpacity>
                    ))
                  : /* FIXED: Map directly over the flattened parsedSubtitles array */
                  parsedSubtitles.length > 0
                  ? parsedSubtitles.map((item, index) => (
                      <TouchableOpacity
                        className="p-2 bg-white/30 rounded-md my-1"
                        key={item.uri + index}
                        onLongPress={() => {
                          if (settingsStorage.isHapticFeedbackEnabled()) {
                            RNReactNativeHapticFeedback.trigger('effectTick', {
                              enableVibrateFallback: true,
                              ignoreAndroidSystemSettings: false,
                            });
                          }
                          Clipboard.setString(item.uri);
                          ToastAndroid.show('Link copied', ToastAndroid.SHORT);
                        }}
                        onPress={() =>
                          handlePressSubs({
                            server: 'Subtitles',
                            link: item.uri,
                            type:
                              item.type === TextTrackType.VTT ? 'vtt' : 'srt',
                            title: item.title,
                          })
                        }>
                        <Text style={{color: 'white'}}>
                          {item.language} - {item.title}
                        </Text>
                      </TouchableOpacity>
                    ))
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
