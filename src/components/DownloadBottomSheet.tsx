import {
  Text,
  Modal,
  TouchableOpacity,
  Dimensions,
  ToastAndroid,
  View,
  Linking,
  StyleSheet,
} from 'react-native';
import React, {useEffect, useRef, useMemo, useCallback} from 'react';
import {Stream} from '../lib/providers/types';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
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

// Optimization: Pre-allocate static array to prevent recreation lags on mount
const SKELETONS = [1, 2, 3, 4];
const WINDOW_WIDTH = Dimensions.get('window').width;

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

  const parsedSubtitles = useMemo(() => {
    if (!data) return [];
    return data.reduce((acc: any[], server) => {
      if (server.subtitles && server.subtitles.length > 0) {
        return [...acc, ...server.subtitles];
      }
      return acc;
    }, []);
  }, [data]);

  // Instantly trigger sheet expansion without frame lag
  useEffect(() => {
    if (showModal) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [showModal]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.5}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handlePressVideo = (item: Stream) => {
    bottomSheetRef.current?.close();
    setTimeout(async () => {
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
    }, 300);
  };

  const handlePressSubs = (item: {
    link: string;
    type: string;
    title: string;
  }) => {
    bottomSheetRef.current?.close();
    setTimeout(async () => {
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
    }, 300);
  };

  return (
    <Modal
      onRequestClose={() => bottomSheetRef.current?.close()}
      visible={showModal}
      transparent={true}
      animationType="none" // FIX: Removed "fade" to prevent layout block delays
      statusBarTranslucent={true}>
      <GestureHandlerRootView style={StyleSheet.absoluteFillObject}>
        <BottomSheet
          enablePanDownToClose
          snapPoints={['30%', 450]}
          containerStyle={styles.container}
          ref={bottomSheetRef}
          backgroundStyle={styles.background}
          handleIndicatorStyle={styles.indicator}
          backdropComponent={renderBackdrop}
          onClose={() => setModal(false)}>
          <Text className="text-white text-xl p-1 font-semibold text-center">
            {title}
          </Text>
          <BottomSheetScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}>
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
              ? SKELETONS.map((_, index) => (
                  <SkeletonLoader
                    key={index}
                    width={WINDOW_WIDTH - 30}
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
                : parsedSubtitles.length > 0
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
        </BottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 5,
  },
  background: {
    backgroundColor: '#1a1a1a',
  },
  indicator: {
    backgroundColor: '#333',
  },
  scrollView: {
    padding: 5,
    marginBottom: 5,
  },
});

export default DownloadBottomSheet;
