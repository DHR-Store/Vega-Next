/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './src/App';
import notifee, {EventType} from '@notifee/react-native';
import notificationService from './src/lib/services/Notification';
// index.js — line 1
import 'react-native-url-polyfill/auto';

// 👉 IMPORT the handler we just created in downloader.ts 
// (Adjust the path below if your downloader.ts is in a different folder)
import { handleDownloadAction } from './src/lib/downloader'; 

// Enable react-native-firebase debug mode for Analytics DebugView in dev
if (__DEV__) {
  globalThis.RNFBDebug = true;
}

/**
 * Register Notifee Foreground Service.
 * Keeps JS thread alive during downloads.
 */
notifee.registerForegroundService(notification => {
  return new Promise(async resolve => {
    const unsubscribe = notifee.onForegroundEvent(async ({type, detail}) => {
      if (type === EventType.ACTION_PRESS) {
        const actionId = detail.pressAction?.id;
        
        // If it's a cancel action, resolve the service promise to stop the lock
        if (actionId?.startsWith('cancel_') || actionId === 'stop_service') {
          unsubscribe();
          await notifee.stopForegroundService();
          resolve();
        }
      }

      if (type === EventType.DISMISSED) {
        unsubscribe();
        await notifee.stopForegroundService();
        resolve();
      }
    });
  });
});

/**
 * Background event handler (runs when app is fully killed/backgrounded).
 */
notifee.onBackgroundEvent(async ({type, detail}) => {
  // 1. 👉 Process download Pause/Cancel actions when app is killed!
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id) {
    const actionId = detail.pressAction.id;
    if (actionId.startsWith('cancel_') || actionId.startsWith('toggle_')) {
      await handleDownloadAction(type, detail);
      
      // If it was cancelled, stop the foreground service 
      if (actionId.startsWith('cancel_')) {
         await notifee.stopForegroundService();
      }
      return; // Stop execution here so we don't trigger the old bug below
    }
  }

  // 2. 👉 FIX FOR THE CRASH LOOP: Check if actionHandler actually exists before calling it
  if (notificationService && typeof notificationService.actionHandler === 'function') {
    try {
      notificationService.actionHandler({type, detail});
    } catch (e) {
      console.error("Error in notificationService.actionHandler:", e);
    }
  }
});

AppRegistry.registerComponent('main', () => App);