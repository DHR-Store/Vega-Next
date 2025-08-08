// my-react-native-app/src/screens/About.js

import {
  View,
  Text,
  TouchableNativeFeedback,
  ToastAndroid,
  Linking,
  Alert,
  Switch,
  Platform, // Import Platform for device detection
} from 'react-native';
import React, {useState, useEffect, useRef} from 'react'; // Import useEffect and useRef
import {Feather} from '@expo/vector-icons';
import {settingsStorage} from '../../lib/storage'; // Assuming this path is correct
import * as RNFS from '@dr.pogodin/react-native-fs'; // Corrected import statement
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore'; // Assuming this path is correct
import * as Application from 'expo-application';
import {notificationService} from '../../lib/services/Notification'; // Assuming this path is correct
import * as Notifications from 'expo-notifications'; // Import expo-notifications
import * as TaskManager from 'expo-task-manager'; // Import TaskManager

// Define a name for the background notification task
// This task will run when a push notification is received while the app is in the background or closed.
const BACKGROUND_NOTIFICATION_TASK = 'background-notification-task';

// Configure Expo Notifications to show alerts when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Register the task with TaskManager. This needs to be outside the component.
TaskManager.defineTask(
  BACKGROUND_NOTIFICATION_TASK,
  ({data, error, executionInfo}) => {
    if (error) {
      console.error('Background task error:', error);
      return;
    }
    // The 'data' payload is what your backend sends.
    console.log('Received a background notification!', data);
    // Here, you can process the notification data and perform tasks
    // like saving the notification to local storage or making an API call.
  },
);

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
        data: {name: `${name}`},
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

  promise
    .then(async res => {
      if (res.statusCode === 200) {
        await notificationService.cancelNotification('updateProgress');
        await notificationService.displayUpdateNotification({
          id: 'downloadComplete',
          title: 'Download Complete',
          body: 'Tap to install',
          data: {name},
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
          {text: 'Cancel'},
          {
            text: 'Update',
            onPress: () =>
              autoDownload
                ? downloadUpdate(
                    // Ensure the downloadUrl also uses the correct domain
                    data.downloadUrl.replace(
                      'https://your-vercel-app-domain.vercel.app',
                      `https://${VERCEL_API_DOMAIN}`,
                    ),
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

// Function to register for push notifications and get the token
async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

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

  token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log('Expo Push Token:', token);
  return token;
}

// Function to send a custom text notification via your Vercel backend
export const sendPushNotificationViaBackend = async (pushToken, title) => {
  if (!pushToken) {
    ToastAndroid.show(
      'Push token not available. Register for notifications first.',
      ToastAndroid.LONG,
    );
    return;
  }

  try {
    const VERCEL_API_DOMAIN = 'my-update-server-ij9t.vercel.app'; // Your Vercel domain
    const response = await fetch(
      `https://${VERCEL_API_DOMAIN}/api/send-push-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pushToken: pushToken,
          title: title,
          // The 'message' is no longer sent from the app as it is hardcoded on the server.
        }),
      },
    );

    const data = await response.json();
    if (response.ok) {
      ToastAndroid.show(
        'Push notification sent via backend!',
        ToastAndroid.SHORT,
      );
      console.log('Backend response:', data);
    } else {
      ToastAndroid.show(
        `Failed to send push notification: ${
          data.error || response.statusText
        }`,
        ToastAndroid.LONG,
      );
      console.error('Backend error:', data);
    }
  } catch (error) {
    ToastAndroid.show(
      'Network error sending push notification.',
      ToastAndroid.LONG,
    );
    console.error('Network error sending push notification:', error);
  }
};

const About = () => {
  const {primary} = useThemeStore(state => state);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [autoDownload, setAutoDownload] = useState(
    settingsStorage.isAutoDownloadEnabled(),
  );
  const [autoCheckUpdate, setAutoCheckUpdate] = useState(
    settingsStorage.isAutoCheckUpdateEnabled(),
  );
  const [expoPushToken, setExpoPushToken] = useState(''); // State to store the push token
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // This is a clean approach to use Expo Notifications for both foreground and background notifications.
    // If you need to use another library like Notifee for more advanced local notifications, you
    // can install it and use it for that purpose, but it should not be configured to handle
    // remote push notifications to avoid conflicts.

    // Register for push notifications and the background task
    registerForPushNotificationsAsync().then(token => {
      setExpoPushToken(token);
      console.log(
        'Successfully registered for push notifications and got token.',
      );
    });

    Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK)
      .then(() => {
        console.log('Background notification task registered.');
        ToastAndroid.show('Background task registered!', ToastAndroid.SHORT);
      })
      .catch(error => {
        console.error('Failed to register background task:', error);
        ToastAndroid.show(
          'Failed to register background task.',
          ToastAndroid.LONG,
        );
      });

    // This listener is fired whenever a notification is received while the app is foregrounded
    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received (foreground):', notification);
        // You can display an in-app alert or custom UI here if needed
        Alert.alert(
          notification.request.content.title || 'Notification',
          notification.request.content.body || 'You received a notification!',
          [{text: 'OK'}],
        );
      });

    // This listener is fired whenever a user taps on or interacts with a notification
    // (works when app is foregrounded, backgrounded, or killed)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response received:', response);
        // Handle navigation or specific actions based on notification data
      });

    // Clean up listeners when the component unmounts
    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current,
      );
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []); // Empty dependency array means this runs once on mount

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

        {/* Display Push Token */}
        {expoPushToken ? (
          <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center mt-4">
            <Text className="text-white text-base">Your Push Token:</Text>
            <Text
              selectable={true}
              className="text-white/70 text-xs ml-2 flex-1">
              {expoPushToken}
            </Text>
          </View>
        ) : (
          <View className="bg-white/10 p-4 rounded-lg flex-row justify-center items-center mt-4">
            <Text className="text-gray-400 text-sm">Getting push token...</Text>
          </View>
        )}

        {/* New: Send Push Notification via Backend Button */}
        <TouchableNativeFeedback
          onPress={() =>
            sendPushNotificationViaBackend(expoPushToken, 'Hello from Vercel!')
          }
          background={TouchableNativeFeedback.Ripple('#ffffff20', false)}>
          <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center mt-4">
            <View className="flex-row items-center space-x-3">
              <Feather name="send" size={22} color="white" />
              <Text className="text-white text-base">
                Send Push Notification (Backend)
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="white" />
          </View>
        </TouchableNativeFeedback>
      </View>
    </View>
  );
};

export default About;
