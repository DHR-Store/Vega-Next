import {DeviceEventEmitter, Platform} from 'react-native';

// This utility handles the logic for background play signals
export const YTBackgroundHandler = {
  // Call this from your WebView onMessage when 'bgStart' or 'bgUpdate' is received
  handleBackgroundEvent: (data: any) => {
    if (data.type === 'BG_START' || data.type === 'BG_UPDATE') {
      console.log('Playing in background:', data.title);
      // Here you would normally interface with a Native Module
      // like react-native-track-player or a custom Android Service
    }
  },

  // Script to inject into WebView to prevent video from pausing when tab hidden
  getBackgroundScript: () => `
    (function() {
      // Prevent Page Visibility API from pausing video
      Object.defineProperty(document, 'hidden', { value: false, writable: false });
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: false });
      document.dispatchEvent(new Event('visibilitychange'));

      // Intercept pause calls when app goes to background
      const origPause = HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.pause = function() {
        if (window.isAp) { // YTPro flag for background play
          console.log('Background play active, ignoring pause');
          return;
        }
        return origPause.apply(this, arguments);
      };
    })();
  `,
};
