import {
  View,
  Text,
  TouchableNativeFeedback,
  ToastAndroid,
  Linking,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import React, {useState, useEffect, useRef} from 'react';
import {Feather} from '@expo/vector-icons';
import {settingsStorage} from '../../lib/storage';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

// Define a name for the background notification task
const BACKGROUND_NOTIFICATION_TASK = 'background-notification-task';
const VERCEL_API_DOMAIN = 'my-update-server-ij9t.vercel.app';
const LOCAL_API_URL = 'http://localhost:3000';

// Define the background task to handle silent push notifications
TaskManager.defineTask(
  BACKGROUND_NOTIFICATION_TASK,
  async ({data, error, executionInfo}) => {
    if (error) {
      console.error('Background task error:', error);
      return;
    }

    console.log('Received a background notification with data:', data);

    // Get the user's setting from storage to determine if the notification should be shown
    const showBackgroundNotification =
      await settingsStorage.isBackgroundNotificationEnabled();

    if (showBackgroundNotification) {
      // The background task is triggered by a silent push, and we can then
      // optionally display a local notification based on user settings.
      Notifications.scheduleNotificationAsync({
        content: {
          title: data?.title || 'Background Notification',
          body: data?.body || 'You have received a new background update.',
        },
        trigger: null, // show immediately
      });
    }
  },
);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Helper function to download update
const downloadUpdate = async (url, name) => {
  console.log('downloading', url, name);
  try {
    if (await RNFS.exists(`${RNFS.DownloadDirectoryPath}/${name}`)) {
      // Use Expo Notifications directly to display the notification
      Notifications.scheduleNotificationAsync({
        content: {
          id: 'downloadComplete',
          title: 'Download Completed',
          body: 'Tap to install',
          data: {name: `${name}`},
        },
        trigger: null, // show immediately
      });
      return;
    }
  } catch (error) {
    console.error('Error checking existing file:', error);
  }

  const {promise} = RNFS.downloadFile({
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
      // We will no longer show a progress bar in the notification as it's not supported
      // out of the box with the basic Notifications API.
      // We will rely on the default system download notification.
    },
  });

  promise
    .then(async res => {
      if (res.statusCode === 200) {
        // Use Expo Notifications directly to display the notification
        Notifications.scheduleNotificationAsync({
          content: {
            id: 'downloadComplete',
            title: 'Download Complete',
            body: 'Tap to install',
            data: {name},
          },
          trigger: null,
        });
      } else {
        ToastAndroid.show(
          `Download failed with status: ${res.statusCode}`,
          ToastAndroid.LONG,
        );
        console.error('Download failed:', res);
      }
    })
    .catch(err => {
      ToastAndroid.show(`Download error: ${err.message}`, ToastAndroid.LONG);
      console.error('Download promise error:', err);
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
    // This is now hardcoded to false
    const useLocalServer = false;
    const apiUrl = useLocalServer
      ? `${LOCAL_API_URL}/api/latest-release`
      : `https://${VERCEL_API_DOMAIN}/api/latest-release`;

    console.log('Checking for updates from:', apiUrl);

    const res = await fetch(apiUrl);
    const data = await res.json();

    const localVersion = Application.nativeApplicationVersion;
    const remoteVersion = data.version;

    if (compareVersions(localVersion || '', remoteVersion)) {
      // Schedule a background notification to inform the user
      Notifications.scheduleNotificationAsync({
        content: {
          title: `New Update Available: v${remoteVersion}`,
          body: data.releaseNotes,
        },
        trigger: null, // Show immediately
      });

      // Show an alert to the user with the release notes
      Alert.alert(
        `Update v${localVersion} -> ${remoteVersion}`,
        data.releaseNotes,
        [
          {text: 'Cancel'},
          {
            text: 'Update',
            onPress: () =>
              autoDownload
                ? downloadUpdate(
                    data.downloadUrl.replace(
                      'https://your-vercel-app-domain.vercel.app',
                      `https://${VERCEL_API_DOMAIN}`,
                    ),
                    data.fileName,
                  )
                : Linking.openURL(`https://dhr-store.vercel.app/app2.html`),
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

// Function to send the push token to your server
const sendPushTokenToServer = async (token, useLocalServer) => {
  const apiUrl = useLocalServer
    ? `${LOCAL_API_URL}/api/save-token`
    : `https://${VERCEL_API_DOMAIN}/api/save-token`;

  try {
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({token}),
    });
    console.log('Successfully sent push token to server.');
  } catch (error) {
    console.error('Failed to send push token to server:', error);
  }
};

// Function to register for push notifications and get the token
async function registerForPushNotificationsAsync(useLocalServer) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // To ensure the task is always registered, we unregister it first
  // and then register it again. This is more reliable across app updates
  // and restarts than simply checking if it's already registered.
  if (TaskManager.isTaskRegistered(BACKGROUND_NOTIFICATION_TASK)) {
    await TaskManager.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  }
  await TaskManager.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);

  const {status: existingStatus} = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const {status} = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    Alert.alert(
      'Permission not granted',
      'Failed to get push token for push notification!',
    );
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log('Your Expo Push Token:', token);
  sendPushTokenToServer(token, useLocalServer);
}

const About = () => {
  const {primary} = useThemeStore(state => state);
  const [updateLoading, setUpdateLoading] = useState(false);

  // Initialize state with default values, and then load the actual values in a useEffect
  const [autoDownload, setAutoDownload] = useState(true);
  const [autoCheckUpdate, setAutoCheckUpdate] = useState(true);
  // useLocalServer is now hardcoded to false, so we don't need a state for it.
  const [showBackgroundNotification, setShowBackgroundNotification] =
    useState(true);

  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Load settings from storage when the component mounts
    const loadSettings = async () => {
      const isAutoDownload = await settingsStorage.isAutoDownloadEnabled();
      const isAutoCheckUpdate =
        await settingsStorage.isAutoCheckUpdateEnabled();
      // FIX: Correctly load the background notification setting from storage.
      const isBackgroundNotification =
        await settingsStorage.isBackgroundNotificationEnabled();

      setAutoDownload(isAutoDownload);
      setAutoCheckUpdate(isAutoCheckUpdate);
      setShowBackgroundNotification(isBackgroundNotification);

      // Register for push notifications with the hardcoded server setting
      // Since useLocalServer is now hardcoded to false, we can pass that directly.
      registerForPushNotificationsAsync(false);
    };

    loadSettings();

    // This listener is fired whenever a notification is received while the app is foregrounded
    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received (foreground):', notification);
        const {data, title, body} = notification.request.content;

        // Check for a specific 'update' type in the notification data
        if (data && data.type === 'update') {
          const {downloadUrl, fileName} = data;
          Alert.alert(
            title || 'New App Update Available!',
            body || 'Tap to download and install the latest version.',
            [
              {text: 'Cancel'},
              {
                text: 'Update',
                onPress: () => downloadUpdate(downloadUrl, fileName),
              },
            ],
          );
        } else if (data && data.type === 'background-notification') {
          // Handle a silent background notification received in the foreground
          Alert.alert(
            title || 'Background Notification',
            body || 'You received a new background update!',
            [{text: 'OK'}],
          );
        } else if (data && data.type === 'visible-background-notification') {
          // Handle the new visible background notification
          Alert.alert(
            title || 'Notification',
            body || 'You have received a new message.',
            [{text: 'OK'}],
          );
        } else {
          // Handle a simple text message notification
          Alert.alert(
            title || 'Notification',
            body || 'You received a notification!',
            [{text: 'OK'}],
          );
        }
      });

    // This listener is fired whenever a user taps on or interacts with a notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response received:', response);
        const notificationData = response.notification.request.content.data;
        if (notificationData?.name) {
          console.log('User tapped to install update:', notificationData.name);
          Alert.alert('Install Update', `Installing ${notificationData.name}`);
        }
      });

    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current,
      );
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

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
            onValueChange={async () => {
              const newValue = !autoDownload;
              setAutoDownload(newValue);
              await settingsStorage.setAutoDownloadEnabled(newValue);
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
            onValueChange={async () => {
              const newValue = !autoCheckUpdate;
              setAutoCheckUpdate(newValue);
              await settingsStorage.setAutoCheckUpdateEnabled(newValue);
            }}
            thumbColor={autoCheckUpdate ? primary : 'gray'}
          />
        </View>

        {/* Show Background Notifications */}
        <View className="bg-white/10 p-3 rounded-lg flex-row justify-between items-center">
          <View className="flex-1 mr-2">
            <Text className="text-white text-base">
              Show Background Notifications
            </Text>
            <Text className="text-gray-400 text-sm">
              Receive notifications when the app is closed.
            </Text>
          </View>
          <Switch
            value={showBackgroundNotification}
            onValueChange={async () => {
              const newValue = !showBackgroundNotification;
              setShowBackgroundNotification(newValue);
              // FIX: Save the new value to storage.
              await settingsStorage.setBackgroundNotificationEnabled(newValue);
              ToastAndroid.show(
                `Background notifications are now ${
                  newValue ? 'enabled' : 'disabled'
                }`,
                ToastAndroid.SHORT,
              );
            }}
            thumbColor={showBackgroundNotification ? primary : 'gray'}
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
