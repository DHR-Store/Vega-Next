// my-react-native-app/src/screens/About.js

import {
  View,
  Text,
  TouchableNativeFeedback,
  ToastAndroid,
  Linking,
  Alert,
  Switch,
} from 'react-native';
import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { settingsStorage } from '../../lib/storage'; // Assuming this path is correct
import * as RNFS from '@dr.pogodin/react-native-fs'; // Corrected import statement
import { MaterialCommunityIcons } from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore'; // Assuming this path is correct
import * as Application from 'expo-application';
import { notificationService } from '../../lib/services/Notification'; // Assuming this path is correct

// Helper function to download update
const downloadUpdate = async (url, name) => {
  console.log('downloading', url, name);
  await notificationService.requestPermission();

  try {
    if (await RNFS.exists(`${RNFS.DownloadDirectoryPath}/${name}`)) {
      await notificationService.displayUpdateNotification({
        id: 'downloadComplete',
        title: 'Download Completed',
        body: 'Tap to install',
        data: { name: `${name}` },
        actions: [
          {
            title: 'Install',
            pressAction: {
              id: 'install',
            },
          },
        ],
      });
      return;
    }
  } catch (error) {
    console.error("Error checking existing file:", error);
  }

  const { promise } = RNFS.downloadFile({
    fromUrl: url,
    background: true,
    progressInterval: 1000,
    progressDivider: 1,
    toFile: `${RNFS.DownloadDirectoryPath}/${name}`,
    begin: res => {
      console.log('begin', res.jobId, res.statusCode, res.headers);
    },
    progress: res => {
      console.log('progress', res.bytesWritten, res.contentLength);
      notificationService.showUpdateProgress(
        'Downloading Update',
        `Version ${Application.nativeApplicationVersion} -> ${name}`,
        {
          current: res.bytesWritten,
          max: res.contentLength,
          indeterminate: false,
        },
      );
    },
  });

  promise.then(async res => {
    if (res.statusCode === 200) {
      await notificationService.cancelNotification('updateProgress');
      await notificationService.displayUpdateNotification({
        id: 'downloadComplete',
        title: 'Download Complete',
        body: 'Tap to install',
        data: { name },
        actions: [
          {
            title: 'Install',
            pressAction: {
              id: 'install',
            },
          },
        ],
      });
    } else {
      ToastAndroid.show(`Download failed with status: ${res.statusCode}`, ToastAndroid.LONG);
      console.error("Download failed:", res);
    }
  }).catch(err => {
    ToastAndroid.show(`Download error: ${err.message}`, ToastAndroid.LONG);
    console.error("Download promise error:", err);
  });
};

// Helper function to compare versions
function compareVersions(localVersion, remoteVersion) {
  try {
    const local = localVersion.split('.').map(Number);
    const remote = remoteVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(local.length, remote.length); i++) {
      const localPart = local[i] || 0;
      const remotePart = remote[i] || 0;

      if (remotePart > localPart) {
        return true;
      }
      if (remotePart < localPart) {
        return false;
      }
    }
    return false; // Versions are equal
  } catch (error) {
    console.error('Invalid version format during comparison:', error);
    return false;
  }
}

// handle check for update
export const checkForUpdate = async (
  setUpdateLoading,
  autoDownload,
  showToast = true,
) => {
  setUpdateLoading(true);
  try {
    // --- IMPORTANT: VERCEL_API_DOMAIN should ONLY be the domain name ---
    const VERCEL_API_DOMAIN = 'my-update-server-ij9t.vercel.app'; // Corrected: Removed 'https://' and trailing slash

    const apiUrl = `https://${VERCEL_API_DOMAIN}/api/latest-release`; // Now correctly forms the URL
    console.log('Attempting to fetch from:', apiUrl); // Log the URL being used

    const res = await fetch(apiUrl);
    const data = await res.json();

    const localVersion = Application.nativeApplicationVersion;
    const remoteVersion = data.version;

    if (compareVersions(localVersion || '', remoteVersion)) {
      ToastAndroid.show('New update available', ToastAndroid.SHORT);
      Alert.alert(
        `Update v${localVersion} -> ${remoteVersion}`,
        data.releaseNotes,
        [
          { text: 'Cancel' },
          {
            text: 'Update',
            onPress: () =>
              autoDownload
                ? downloadUpdate(
                  // Ensure the downloadUrl also uses the correct domain
                  data.downloadUrl.replace('https://your-vercel-app-domain.vercel.app', `https://${VERCEL_API_DOMAIN}`),
                  data.fileName,
                )
                : Linking.openURL(`https://${VERCEL_API_DOMAIN}/releases`), // Link to your Vercel app's releases page if applicable
          },
        ],
      );
      console.log(
        'local version',
        localVersion,
        'remote version',
        remoteVersion,
      );
    } else {
      showToast && ToastAndroid.show('App is up to date', ToastAndroid.SHORT);
      console.log(
        'local version',
        localVersion,
        'remote version',
        remoteVersion,
      );
    }
  } catch (error) {
    ToastAndroid.show('Failed to check for update', ToastAndroid.SHORT);
    console.log('Update error', error);
  }
  setUpdateLoading(false);
};

const About = () => {
  const { primary } = useThemeStore(state => state);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [autoDownload, setAutoDownload] = useState(
    settingsStorage.isAutoDownloadEnabled(),
  );
  const [autoCheckUpdate, setAutoCheckUpdate] = useState(
    settingsStorage.isAutoCheckUpdateEnabled(),
  );

  return (
    <View className="flex-1 bg-black mt-8">
      <View className="px-4 py-3 border-b border-white/10">
        <Text className="text-2xl font-bold text-white">About</Text>
        <Text className="text-gray-400 mt-1 text-sm">
          App information and updates
        </Text>
      </View>

      <View className="p-4 space-y-4 pb-24">
        {/* Version */}
        <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center">
          <Text className="text-white text-base">Version</Text>
          <Text className="text-white/70">
            v{Application.nativeApplicationVersion}
          </Text>
        </View>

        {/* Auto Install Updates */}
        <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center">
          <Text className="text-white text-base">Auto Install Updates</Text>
          <Switch
            value={autoDownload}
            onValueChange={() => {
              setAutoDownload(!autoDownload);
              settingsStorage.setAutoDownloadEnabled(!autoDownload);
            }}
            thumbColor={autoDownload ? primary : 'gray'}
          />
        </View>

        {/* Auto Check Updates */}
        <View className="bg-white/10 p-3 rounded-lg flex-row justify-between items-center">
          <View className="flex-1 mr-2">
            <Text className="text-white text-base">Check Updates on Start</Text>
            <Text className="text-gray-400 text-sm">
              Automatically check for updates when app starts
            </Text>
          </View>
          <Switch
            value={autoCheckUpdate}
            onValueChange={() => {
              setAutoCheckUpdate(!autoCheckUpdate);
              settingsStorage.setAutoCheckUpdateEnabled(!autoCheckUpdate);
            }}
            thumbColor={autoCheckUpdate ? primary : 'gray'}
          />
        </View>

        {/* Check Updates Button */}
        <TouchableNativeFeedback
          onPress={() => checkForUpdate(setUpdateLoading, autoDownload, true)}
          disabled={updateLoading}
          background={TouchableNativeFeedback.Ripple('#ffffff20', false)}>
          <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center mt-4">
            <View className="flex-row items-center space-x-3">
              <MaterialCommunityIcons name="update" size={22} color="white" />
              <Text className="text-white text-base">Check for Updates</Text>
            </View>
            <Feather name="chevron-right" size={20} color="white" />
          </View>
        </TouchableNativeFeedback>
      </View>
    </View>
  );
};

export default About;

