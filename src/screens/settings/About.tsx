// my-react-native-app/src/screens/About.js

import {
  View,
  Text,
  TouchableNativeFeedback,
  ToastAndroid,
  Linking,
  Alert,
  Switch,
  Platform,
  AppState,
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

// Custom hook to detect if the app is in the foreground
const useIsForeground = () => {
  const [isForeground, setIsForeground] = useState(true);
  useEffect(() => {
    const onChange = state => {
      setIsForeground(state === 'active');
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [setIsForeground]);
  return isForeground;
};

// Define the background task to handle silent push notifications
TaskManager.defineTask(
  BACKGROUND_NOTIFICATION_TASK,
  async ({data, error, executionInfo}) => {
    console.log('Background task started...');
    console.log('--- Background Task Payload Received ---');
    console.log('Execution Info:', JSON.stringify(executionInfo, null, 2));
    console.log('Data:', JSON.stringify(data, null, 2));
    console.log('--- End of Background Task Payload ---');

    if (executionInfo?.remoteNotificationPayload?.notification) {
      console.error(
        "ERROR: Received a push notification with a 'notification' key. " +
          'This is not a data-only payload and is likely causing the ' +
          "' (NOBRIDGE) ERROR [TypeError: _Notification.default.actionHandler is not a function]' error. " +
          'Please ensure your server sends a data-only payload.',
      );
      return;
    }

    if (error) {
      console.error('Background task error:', error);
      return;
    }

    try {
      if (data && data.type === 'update-available') {
        const {title, body, releaseNotes, version, ...otherData} = data;
        Notifications.scheduleNotificationAsync({
          content: {
            title: title || `New App Update: v${version} is available!`,
            body: body || releaseNotes,
            data: {
              ...otherData,
              type: 'update',
            },
          },
          trigger: null,
        });
        console.log('Update notification scheduled from background task.');
      } else if (data && data.type === 'message') {
        const {title, message} = data;
        Notifications.scheduleNotificationAsync({
          content: {
            title: title || 'New Message',
            body: message || 'You have a new notification!',
            data: data,
          },
          trigger: null,
        });
        console.log('Foreground notification scheduled from background task.');
      }
    } catch (e) {
      console.error('Error within background task:', e);
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
      Notifications.scheduleNotificationAsync({
        content: {
          id: 'downloadComplete',
          title: `Download of ${name} completed!`,
          body: 'Tap to install the update.',
          data: {name: `${name}`},
        },
        trigger: null,
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
    },
  });

  promise
    .then(async res => {
      if (res.statusCode === 200) {
        Notifications.scheduleNotificationAsync({
          content: {
            id: 'downloadComplete',
            title: `Download of ${name} complete!`,
            body: 'Tap to install the update.',
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
    return false;
  } catch (error) {
    console.error('Invalid version format during comparison:', error);
    return false;
  }
}

export const checkForUpdate = async (
  setUpdateLoading,
  autoDownload,
  showToast = true,
) => {
  setUpdateLoading(true);
  try {
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
      Alert.alert(
        data.title || `Update v${localVersion} -> ${remoteVersion}`,
        data.body || data.releaseNotes,
        [
          {text: 'Cancel'},
          {
            text: 'Update',
            onPress: () =>
              Linking.openURL(
                data.downloadUrl.replace(
                  'https://your-vercel-app-domain.vercel.app',
                  `https://${VERCEL_API_DOMAIN}`,
                ),
              ),
          },
        ],
      );
      console.log(
        'An update is available! local version',
        localVersion,
        'remote version',
        remoteVersion,
      );

      Notifications.scheduleNotificationAsync({
        content: {
          title:
            data.title || `New App Update: v${remoteVersion} is available!`,
          body: data.body || data.releaseNotes,
          data: {
            ...data,
            type: 'update',
            downloadUrl: data.downloadUrl.replace(
              'https://your-vercel-app-domain.vercel.app',
              `https://${VERCEL_API_DOMAIN}`,
            ),
          },
        },
        trigger: null,
      });
      console.log('Local notification scheduled for foreground check.');
    } else {
      showToast && ToastAndroid.show('App is up to date', ToastAndroid.SHORT);
      console.log(
        'App is up to date. local version',
        localVersion,
        'remote version',
        remoteVersion,
      );
    }
  } catch (error) {
    ToastAndroid.show('Failed to check for update', ToastAndroid.SHORT);
    console.log('Update error', error);
  } finally {
    setUpdateLoading(false);
  }
};

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

async function registerForPushNotificationsAsync(
  useLocalServer,
  isInitialRequest = false,
) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  console.log('Checking if background task is already registered...');
  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    BACKGROUND_NOTIFICATION_TASK,
  );
  if (isRegistered) {
    console.log('Task already registered.');
  } else {
    console.log('Registering background task...');
    await TaskManager.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('Background task registered successfully.');
  }

  const {status: existingStatus} = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Add a pop-up message for the initial permission request
  if (isInitialRequest && existingStatus === 'undetermined') {
    Alert.alert(
      'Enable Notifications',
      'Please enable notifications to receive updates about new messages and app updates even when the app is closed.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'OK',
          onPress: async () => {
            const {status} = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          },
        },
      ],
    );
  } else if (existingStatus !== 'granted') {
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

async function unregisterBackgroundTaskAsync() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    BACKGROUND_NOTIFICATION_TASK,
  );
  if (isRegistered) {
    await TaskManager.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('Background task unregistered successfully.');
  } else {
    console.log('Background task was not registered, no action needed.');
  }
}

const About = () => {
  const {primary} = useThemeStore(state => state);
  const [updateLoading, setUpdateLoading] = useState(false);
  const isForeground = useIsForeground();
  const [autoDownload, setAutoDownload] = useState(true);
  const [autoCheckUpdate, setAutoCheckUpdate] = useState(true);
  const [showBackgroundNotification, setShowBackgroundNotification] =
    useState(true);
  const notificationListener = useRef();
  const responseListener = useRef();

  // The fix is here: we now use the nativeApplicationVersion property directly.
  const appVersion = Application.nativeApplicationVersion || 'N/A';

  useEffect(() => {
    const loadSettings = async () => {
      const isAutoDownload = await settingsStorage.isAutoDownloadEnabled();
      const isAutoCheckUpdate =
        await settingsStorage.isAutoCheckUpdateEnabled();
      const isBackgroundNotification =
        await settingsStorage.isBackgroundNotificationEnabled();
      setAutoDownload(isAutoDownload);
      setAutoCheckUpdate(isAutoCheckUpdate);
      setShowBackgroundNotification(isBackgroundNotification);

      if (isBackgroundNotification) {
        // Pass 'true' to indicate this is the initial request from useEffect
        registerForPushNotificationsAsync(false, true);
      } else {
        unregisterBackgroundTaskAsync();
      }

      if (isAutoCheckUpdate) {
        checkForUpdate(setUpdateLoading, isAutoDownload);
      }
    };

    loadSettings();

    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        const {type, ...data} = notification.request.content.data;
        if (isForeground) {
          if (type === 'message') {
            Notifications.scheduleNotificationAsync({
              content: {
                title: data.title || 'New Message',
                body: data.message || 'You have a new message.',
              },
              trigger: null,
            });
          }
        }
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log(response);
        const {type, downloadUrl, fileName} =
          response.notification.request.content.data;
        if (type === 'update' && downloadUrl && fileName) {
          downloadUpdate(downloadUrl, fileName);
        }
      });

    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current,
      );
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [isForeground]);

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
          <Text className="text-white/70">v{appVersion}</Text>
        </View>

        {/* Background Notifications */}
        <View className="bg-white/10 p-3 rounded-lg flex-row justify-between items-center">
          <View className="flex-1 mr-2">
            <Text className="text-white text-base">
              Background Notifications
            </Text>
            <Text className="text-gray-400 text-sm">
              Receive notifications even when the app is closed.
            </Text>
          </View>
          <Switch
            value={showBackgroundNotification}
            onValueChange={async () => {
              const newValue = !showBackgroundNotification;
              setShowBackgroundNotification(newValue);
              await settingsStorage.setBackgroundNotificationEnabled(newValue);
              if (newValue) {
                // Pass 'false' to avoid showing the pop-up on subsequent toggles
                registerForPushNotificationsAsync(false, false);
                ToastAndroid.show(
                  'Background notifications are now enabled',
                  ToastAndroid.SHORT,
                );
              } else {
                unregisterBackgroundTaskAsync();
                ToastAndroid.show(
                  'Background notifications are now disabled',
                  ToastAndroid.SHORT,
                );
              }
            }}
            thumbColor={showBackgroundNotification ? primary : 'gray'}
          />
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
