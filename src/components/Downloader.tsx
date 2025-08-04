import React, {useEffect, useLayoutEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import {ifExists} from '../lib/file/ifExists';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Octicons from '@expo/vector-icons/Octicons';
import {Stream} from '../lib/providers/types';
import {MotiView} from 'moti';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../lib/zustand/contentStore';
import {downloadManager} from '../lib/downloader';
import {cancelHlsDownload} from '../lib/hlsDownloader2';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {downloadFolder} from '../lib/constants';
import useThemeStore from '../lib/zustand/themeStore';
import DownloadBottomSheet from './DownloadBottomSheet';
import {settingsStorage} from '../lib/storage';
import {providerManager} from '../lib/services/ProviderManager';

const DownloadComponent = ({
  link,
  fileName,
  type,
  providerValue,
  title,
}: {
  link: string;
  fileName: string;
  type: string;
  providerValue: string;
  title: string;
}) => {
  const {primary} = useThemeStore(state => state);
  const {provider} = useContentStore(state => state);
  const [alreadyDownloaded, setAlreadyDownloaded] = useState<string | boolean>(
    false,
  );
  const [deleteModal, setDeleteModal] = useState(false);
  const [downloadModal, setDownloadModal] = useState(false);
  // FIX: New state to determine the download mode
  const [isExternalDownload, setIsExternalDownload] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [downloadId, setDownloadId] = useState<number | null>(null);
  const [servers, setServers] = useState<Stream[]>([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [downloadActive, setDownloadActive] = useState(false);

  // check if file already exists
  useLayoutEffect(() => {
    const checkIfDownloaded = async () => {
      const exists = await ifExists(fileName);
      setAlreadyDownloaded(exists);
    };
    checkIfDownloaded();
  }, [fileName]);

  // handle download deletion
  const deleteDownload = async () => {
    try {
      const fileList = await RNFS.readDir(downloadFolder);
      // Find a file with the given name (without extension)
      const foundFile = fileList.find(fileItem => {
        const nameWithoutExtension = fileItem.name
          .split('.')
          .slice(0, -1)
          .join('.');
        return nameWithoutExtension === fileName;
      });
      if (foundFile) {
        await RNFS.unlink(foundFile.path);
        setAlreadyDownloaded(false);
        setDeleteModal(false);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // choose server
  useEffect(() => {
    const controller = new AbortController();
    if (!downloadModal) {
      return;
    }
    const getServer = async () => {
      setServerLoading(true);
      const servers = await providerManager.getStream({
        link,
        type,
        signal: controller.signal,
        providerValue: providerValue || provider.value,
      });
      const filteredServers = servers;
      setServerLoading(false);
      setServers(filteredServers);
    };
    getServer();

    return () => {
      controller.abort();
    };
  }, [downloadModal]);

  return (
    <>
      <View className="flex-row items-center mt-1 justify-between rounded-full bg-white/30 p-1">
        {downloadActive ? (
          <MotiView
            style={{
              marginHorizontal: 4,
            }}
            // animate opacity to opacity while downloding
            from={{opacity: 1}}
            animate={{opacity: 0.5}}
            //@ts-ignore
            transition={{type: 'timing', duration: 500, loop: true}}>
            <TouchableOpacity
              onPress={() => {
                setCancelModal(prev => !prev);
              }}>
              <MaterialIcons name="downloading" size={27} color={primary} />
            </TouchableOpacity>
          </MotiView>
        ) : alreadyDownloaded ? (
          <TouchableOpacity
            onPress={() => setDeleteModal(true)}
            className="mx-1">
            <MaterialIcons name="delete-outline" size={27} color="#c1c4c9" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              const alwaysExternal = settingsStorage.getBool(
                'alwaysExternalDownloader',
              );
              // FIX: Set the external download mode based on the setting
              setIsExternalDownload(!!alwaysExternal);
              setDownloadModal(true);
            }}
            onLongPress={() => {
              if (settingsStorage.getBool('hapticFeedback') !== false) {
                ReactNativeHapticFeedback.trigger('effectHeavyClick', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
              }
              // FIX: A long press always sets the mode to external
              setIsExternalDownload(true);
              setDownloadModal(true);
            }}
            className="mx-2">
            <Octicons name="download" size={25} color="#c1c4c9" />
          </TouchableOpacity>
        )}
        {/* delete modal */}
        {
          <Modal animationType="fade" visible={deleteModal} transparent={true}>
            <View className="flex-1 bg-black/10 justify-center items-center p-4">
              <View className="bg-tertiary p-3 w-80 rounded-md justify-center items-center">
                <Text className="text-2xl font-semibold my-3 text-white">
                  Confirm to delete
                </Text>
                <View className="flex-row items-center justify-evenly w-full my-5">
                  <TouchableOpacity
                    onPress={deleteDownload}
                    className="p-2 rounded-md m-1 px-3"
                    style={{backgroundColor: primary}}>
                    <Text className="text-white font-semibold text-base rounded-md capitalize px-1">
                      Yes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setDeleteModal(false)}
                    className="p-2 px-4 rounded-md m-1"
                    style={{backgroundColor: primary}}>
                    <Text className="text-white font-semibold text-base rounded-md capitalize px-1">
                      No
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        }
        {/* FIX: Consolidated download modals into a single component */}
        <DownloadBottomSheet
          setModal={setDownloadModal}
          showModal={downloadModal}
          data={servers}
          loading={serverLoading}
          // FIX: The title now changes based on the download mode
          title={
            isExternalDownload
              ? 'Select Server to Open'
              : 'Select Server to Download'
          }
          isExternalDownloadMode={isExternalDownload}
          onPressVideo={(server: Stream) => {
            downloadManager({
              title: title,
              url: server.link,
              fileName: fileName,
              fileType: server.type,
              setDownloadActive: setDownloadActive,
              setAlreadyDownloaded: setAlreadyDownloaded,
              setDownloadId: setDownloadId,
              headers: server?.headers,
              deleteDownload: deleteDownload,
            });
          }}
          onPressSubs={(sub: {link: string; type: string; title: string}) => {
            downloadManager({
              title: title + ' ' + sub.title + ' Subtitle ',
              url: sub.link,
              fileName: fileName + '-' + sub.title,
              fileType: sub.type,
              setDownloadActive: setDownloadActive,
              setAlreadyDownloaded: () => {},
              setDownloadId: setDownloadId,
              deleteDownload: () => {},
            });
          }}
        />
      </View>
      {cancelModal && downloadId && (
        <Pressable
          onPress={async () => {
            setCancelModal(false);
            try {
              // Check if this is an HLS download (ID >= 1000) or regular download
              if (typeof downloadId === 'number' && downloadId >= 1000) {
                // HLS download cancellation
                cancelHlsDownload(downloadId);
              } else {
                // Regular download cancellation
                RNFS.stopDownload(downloadId);
              }
              setDownloadActive(false);

              const files = await RNFS.readDir(downloadFolder);
              // Find a file with the given name (without extension)
              const foundFile = files.find(fileItem => {
                const nameWithoutExtension = fileItem.name
                  .split('.')
                  .slice(0, -1)
                  .join('.');
                return nameWithoutExtension === fileName;
              });
              if (foundFile) {
                await RNFS.unlink(foundFile.path);
              }
            } catch (error) {
              console.log('Error cancelling download', error);
            }
          }}
          className="absolute right-12 bg-quaternary/80 bottom-3 rounded-md px-2">
          <Text className="text-lg text-white">Cancel</Text>
        </Pressable>
      )}
    </>
  );
};

export default DownloadComponent;
