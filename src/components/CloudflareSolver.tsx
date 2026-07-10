import React, {useRef, useState} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useCfStore} from '../lib/zustand/cfStore';

export const CloudflareSolver = () => {
  const {isSolving, targetUrl, completeSolver, cancelSolver} = useCfStore();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  // We look at the body size/title to know when the CF Challenge is fully passed
  const aggressiveJS = `
    (function() {
      var checkInterval = setInterval(function() {
        var title = document.title || '';
        var html = document.body ? document.body.innerHTML : '';
        var isCloudflare = title.includes('Just a moment') || html.includes('cf-browser-verification') || document.getElementById('challenge-running');
        
        if (!isCloudflare && title !== '' && html.length > 500) {
          window.ReactNativeWebView.postMessage('AUTO_SAVE|' + navigator.userAgent);
          clearInterval(checkInterval);
        }
      }, 1000);
    })();
    true;
  `;

  const injectScript = () => {
    webViewRef.current?.injectJavaScript(aggressiveJS);
  };

  const handleManualSave = () => {
    const forceFetchJS = `
      window.ReactNativeWebView.postMessage('MANUAL_SAVE|' + navigator.userAgent);
      true;
    `;
    webViewRef.current?.injectJavaScript(forceFetchJS);
  };

  const handleMessage = (event: any) => {
    const data = event.nativeEvent.data;

    if (typeof data === 'string') {
      if (data.startsWith('MANUAL_SAVE|')) {
        const realUserAgent = data.replace('MANUAL_SAVE|', '');
        console.log('✅ Manual Save Triggered. Real UA:', realUserAgent);
        completeSolver(realUserAgent);
      } else if (data.startsWith('AUTO_SAVE|')) {
        const realUserAgent = data.replace('AUTO_SAVE|', '');
        console.log('✅ Captcha Auto-Solved! Real UA:', realUserAgent);
        completeSolver(realUserAgent);
      }
    }
  };

  if (!isSolving) return null;

  return (
    <Modal
      visible={isSolving}
      animationType="slide"
      presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={cancelSolver} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerText}>Security Check</Text>
          <TouchableOpacity onPress={handleManualSave} style={styles.headerBtn}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={{marginTop: 10}}>Loading Challenge...</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{uri: targetUrl}}
          // Do not pass userAgent prop, let the phone decide natively!
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          domStorageEnabled={true}
          javaScriptEnabled={true}
          injectedJavaScript={aggressiveJS}
          onLoadStart={() => injectScript()}
          onNavigationStateChange={() => injectScript()}
          onLoadEnd={() => {
            setLoading(false);
            injectScript();
          }}
          onMessage={handleMessage}
          style={{flex: 1}}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  headerText: {fontSize: 16, fontWeight: 'bold'},
  headerBtn: {padding: 4, minWidth: 60},
  cancelText: {color: '#FF3B30', fontSize: 16},
  saveText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  loader: {padding: 20, alignItems: 'center'},
});
