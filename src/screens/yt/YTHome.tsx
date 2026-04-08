import React, {useRef, useState, useCallback, useEffect} from 'react';
import {
  SafeAreaView,
  BackHandler,
  Linking,
  ToastAndroid,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  StatusBar,
} from 'react-native';
import {WebView, WebViewMessageEvent} from 'react-native-webview';
import {useFocusEffect} from '@react-navigation/native';
import RNFetchBlob from 'rn-fetch-blob';
import Orientation from 'react-native-orientation-locker';

const YTHome = ({navigation}: any) => {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    return () => {
      Orientation.lockToPortrait();
      StatusBar.setHidden(false);
    };
  }, []);

  const handleDownload = async (
    url: string,
    name: string,
    mimeType?: string,
  ) => {
    try {
      if (Platform.OS === 'android' && Platform.Version < 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          ToastAndroid.show('Storage Permission Denied', ToastAndroid.SHORT);
          return;
        }
      }

      const {config, fs} = RNFetchBlob;
      const downloads = fs.dirs.DownloadDir;

      let safeFileName = name
        ? name.replace(/[^a-zA-Z0-9.-]/gi, '_')
        : `ytpro_download_${Date.now()}`;

      if (!safeFileName.includes('.')) {
        if (mimeType?.includes('audio')) safeFileName += '.m4a';
        else if (mimeType?.includes('zip')) safeFileName += '.zip';
        else if (mimeType?.includes('image')) safeFileName += '.jpg';
        else safeFileName += '.mp4';
      }

      ToastAndroid.show(
        `Starting Download: ${safeFileName}`,
        ToastAndroid.SHORT,
      );

      config({
        fileCache: true,
        addAndroidDownloads: {
          useDownloadManager: true,
          notification: true,
          title: safeFileName,
          path: `${downloads}/${safeFileName}`,
          description: 'Downloading via Vega Next',
          mime: mimeType || 'video/mp4',
          mediaScannable: true,
        },
      })
        .fetch('GET', url, {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        })
        .then(() =>
          ToastAndroid.show(
            `Saved ${safeFileName} to Gallery!`,
            ToastAndroid.LONG,
          ),
        )
        .catch(err => {
          console.error('Download error:', err);
          ToastAndroid.show('Using Browser Fallback...', ToastAndroid.SHORT);
          Linking.openURL(url).catch(e => console.error('Fallback Failed', e));
        });
    } catch (err) {
      console.error(err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isFullscreen) {
          Orientation.lockToPortrait();
          StatusBar.setHidden(false);
          setIsFullscreen(false);

          webViewRef.current?.injectJavaScript(`
            if (document.exitFullscreen) { document.exitFullscreen(); }
            else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
            true;
          `);
          return true;
        }

        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        navigation.goBack();
        return true;
      };
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () =>
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [canGoBack, navigation, isFullscreen]),
  );

  const ytproWindowBridge = `
    (function() {
      // 🔴 Spoof an extremely high version number to trick the external script
      window.YTProVer = "999.99";
      window.isAp = true;

      window.downvid = function(name, url, mime) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'DOWNLOAD', 
          name: name, 
          url: url, 
          mime: mime 
        }));
      };
      
      window.oplink = function(url) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_LINK', url: url }));
      };

      window.pipvid = function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PIP' }));
      };

      window.Android = {
        getInfo: function() { return window.YTProVer; },
        downvid: window.downvid,
        oplink: window.oplink,
        pipvid: window.pipvid,
      };

      const originalPause = HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.pause = function() {
        if (document.hidden || document.visibilityState === 'hidden') {
          return Promise.resolve();
        }
        return originalPause.apply(this, arguments);
      };

      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      function checkFullscreen() {
        var isFull = document.fullscreenElement || document.webkitFullscreenElement;
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: isFull ? 'FULLSCREEN_ENTER' : 'FULLSCREEN_EXIT' 
        }));
      }
      
      document.addEventListener('fullscreenchange', checkFullscreen);
      document.addEventListener('webkitfullscreenchange', checkFullscreen);
    })();
    true;
  `;

  const ytproScriptsInjection = `
    (function() {
      // 🔴 Block the update popup function entirely just to be safe
      window.updateModel = function() {};

      var style = document.createElement('style');
      style.innerHTML = \`
        .ad-container, .ad-interrupting, .ytp-ad-overlay-container, 
        ytd-promoted-video-renderer, ytd-display-ad-renderer, 
        .ytd-ad-slot-renderer, ytd-ad-slot-renderer { display: none !important; }
        
        #downytprodiv { 
          background: #1a1a1a !important; 
          border-radius: 12px !important; 
          margin: 10px !important; 
          padding: 15px !important; 
          color: white !important; 
          box-shadow: 0 4px 15px rgba(0,0,0,0.6);
        }
      \`;
      document.head.appendChild(style);

      setInterval(function() {
        var skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
        if (skipBtn) skipBtn.click();
      }, 1000);

      if (!window.ytproLoaded) {
        window.ytproLoaded = true;
        var s1 = document.createElement('script');
        s1.src = 'https://cdn.jsdelivr.net/gh/prateek-chaubey/YTPRO@main/script.js';
        document.body.appendChild(s1);

        var s2 = document.createElement('script');
        s2.type = 'module';
        s2.src = 'https://cdn.jsdelivr.net/gh/prateek-chaubey/YTPRO@main/innertube.js';
        document.body.appendChild(s2);
      }
    })();
    true;
  `;

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'DOWNLOAD':
          handleDownload(data.url, data.name, data.mime);
          break;
        case 'OPEN_LINK':
          Linking.openURL(data.url);
          break;
        case 'BG_PLAY':
          ToastAndroid.show('Background Play Active', ToastAndroid.SHORT);
          break;
        case 'FULLSCREEN_ENTER':
          setIsFullscreen(true);
          Orientation.lockToLandscape();
          StatusBar.setHidden(true);
          break;
        case 'FULLSCREEN_EXIT':
          setIsFullscreen(false);
          Orientation.lockToPortrait();
          StatusBar.setHidden(false);
          break;
      }
    } catch (e) {}
  };

  return (
    <SafeAreaView style={styles.container}>
      {!isFullscreen && (
        <StatusBar backgroundColor="#000" barStyle="light-content" />
      )}

      <WebView
        ref={webViewRef}
        source={{uri: 'https://www.youtube.com/'}}
        injectedJavaScriptBeforeContentLoaded={ytproWindowBridge}
        injectedJavaScript={ytproScriptsInjection}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        onMessage={handleWebViewMessage}
        onNavigationStateChange={navState => setCanGoBack(navState.canGoBack)}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        scalesPageToFit={true}
        style={styles.webview}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: 'black'},
  webview: {flex: 1, backgroundColor: 'black'},
});

export default YTHome;
