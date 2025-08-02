import {View, SafeAreaView, StyleSheet, Linking, TouchableOpacity} from 'react-native';
import React, {useRef, useMemo, useEffect} from 'react';
import {WebView} from 'react-native-webview';
import {useRoute, RouteProp, useNavigation} from '@react-navigation/native';
// Corrected import: We import the main Orientation object as a default export.
import Orientation from 'react-native-orientation-locker';
import Ionicons from '@expo/vector-icons/Ionicons';

// Define the route prop type for the WebView screen
type RootStackParamList = {
  WatchTrailer: {videoId: string; link: string};
};

type WebViewScreenRouteProp = RouteProp<RootStackParamList, 'WatchTrailer'>;

const WebViewScreen = () => {
  const route = useRoute<WebViewScreenRouteProp>();
  const navigation = useNavigation();
  const webViewRef = useRef<WebView>(null);

  const {videoId, link} = route.params;

  useEffect(() => {
    // Corrected function call: We now call the function as a method of the Orientation object.
    Orientation.lockToLandscape();
    console.log('Screen locked to landscape');

    return () => {
      // Corrected function call: We now call the function as a method of the Orientation object.
      Orientation.unlockAllOrientations();
      console.log('Screen unlocked from all orientations');
    };
  }, []);

  // HTML and JavaScript for the YouTube Player. This is memoized to prevent unnecessary re-renders.
  const customHTML = useMemo(() => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
      body, html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background-color: black;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      #player-container {
        position: relative;
        width: 100%;
        height: 100%;
      }
      #player {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }
      .controls-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.4);
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
        pointer-events: none;
      }
      .controls-overlay.show {
        opacity: 1;
        pointer-events: auto;
      }
      .top-bar {
        width: 100%;
        display: flex;
        justify-content: space-between;
        padding: 10px;
      }
      .bottom-bar {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
      }
      .control-btn {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        padding: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        transition: transform 0.2s ease-in-out;
        width: 40px;
        height: 40px;
        cursor: pointer;
      }
      .control-btn:active {
        transform: scale(0.9);
      }
      .main-play-btn {
        font-size: 80px;
        color: white;
        text-shadow: 0 0 10px black;
      }
      .progress-bar-container {
        width: 100%;
        height: 5px;
        background: rgba(255, 255, 255, 0.3);
        margin: 0 10px;
      }
      .progress-bar {
        height: 100%;
        background-color: #ff0000;
        transition: width 0.1s linear;
      }
      .time-text {
        color: white;
        font-size: 14px;
        margin: 0 10px;
        white-space: nowrap;
      }
      .icon-svg {
        fill: white;
      }
      .flex-center {
        display: flex;
        justify-content: center;
        align-items: center;
      }
    </style>
  </head>
  <body>
    <div id="player-container">
      <div id="player"></div>
      <div id="overlay" class="controls-overlay">
        <div class="top-bar">
          <span class="control-btn" onclick="postMessage('goBack')">
            <svg class="icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </span>
          <span class="control-btn" onclick="postMessage('openInBrowser')">
            <svg class="icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19 19H5v-7h2v7h10V7h-3V5h5v14zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
          </span>
        </div>
        <div class="flex-center" onclick="togglePlayPause()">
          <span id="play-pause-btn" class="main-play-btn">
            <svg id="play-icon" class="icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="80" height="80"><path d="M8 5v14l11-7z"/></svg>
            <svg id="pause-icon" class="icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="80" height="80" style="display: none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </span>
        </div>
        <div class="bottom-bar">
          <span id="current-time" class="time-text">0:00</span>
          <div class="progress-bar-container">
            <div id="progress-bar" class="progress-bar"></div>
          </div>
          <span id="duration-time" class="time-text">0:00</span>
          <span class="control-btn" onclick="toggleMute()">
            <svg id="volume-icon" class="icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.81 5 3.54 5 6.71s-2.11 5.9-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          </span>
          <span class="control-btn" onclick="toggleFullscreen()">
            <svg id="fullscreen-icon" class="icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
          </span>
        </div>
      </div>
    </div>
    <script>
      var player;
      var overlay = document.getElementById('overlay');
      var playIcon = document.getElementById('play-icon');
      var pauseIcon = document.getElementById('pause-icon');
      var progressBar = document.getElementById('progress-bar');
      var currentTimeDisplay = document.getElementById('current-time');
      var durationTimeDisplay = document.getElementById('duration-time');
      var volumeIcon = document.getElementById('volume-icon');
      var timeoutId;

      function onYouTubeIframeAPIReady() {
        player = new YT.Player('player', {
          videoId: '${videoId}',
          playerVars: {
            controls: 0,
            rel: 0,
            showinfo: 0,
            autoplay: 1
          },
          events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
          }
        });
      }

      function onPlayerReady(event) {
        // Player is ready, start the update interval
        setInterval(updateProgressBar, 500);
        player.playVideo();
        showControls();
      }

      function onPlayerStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING) {
          playIcon.style.display = 'none';
          pauseIcon.style.display = 'block';
          hideControlsWithDelay();
        } else if (event.data === YT.PlayerState.PAUSED) {
          playIcon.style.display = 'block';
          pauseIcon.style.display = 'none';
          showControls();
        } else if (event.data === YT.PlayerState.ENDED) {
          playIcon.style.display = 'block';
          pauseIcon.style.display = 'none';
          player.seekTo(0);
          showControls();
        }
      }

      function updateProgressBar() {
        if (player && player.getCurrentTime) {
          const currentTime = player.getCurrentTime();
          const duration = player.getDuration();
          if (duration > 0) {
            const progress = (currentTime / duration) * 100;
            progressBar.style.width = progress + '%';
            currentTimeDisplay.innerText = formatTime(currentTime);
            durationTimeDisplay.innerText = formatTime(duration);
          }
        }
      }

      function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return minutes + ':' + (remainingSeconds < 10 ? '0' : '') + remainingSeconds;
      }

      function postMessage(type) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type }));
      }

      function togglePlayPause() {
        if (player.getPlayerState() === YT.PlayerState.PLAYING) {
          player.pauseVideo();
        } else {
          player.playVideo();
        }
      }

      function showControls() {
        clearTimeout(timeoutId);
        overlay.classList.add('show');
        hideControlsWithDelay();
      }

      function hideControlsWithDelay() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          overlay.classList.remove('show');
        }, 3000);
      }

      function toggleMute() {
        if (player.isMuted()) {
          player.unMute();
          volumeIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.81 5 3.54 5 6.71s-2.11 5.9-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
        } else {
          player.mute();
          volumeIcon.innerHTML = '<path d="M7 9v6h4l5 5V4l-5 5H7zm13 3c0 2.21-1.28 4.14-3.15 5.1V6.9c1.87.96 3.15 2.89 3.15 5.1z"/>';
        }
      }

      function toggleFullscreen() {
        var elem = document.getElementById('player');
        if (elem.requestFullscreen) {
          elem.requestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen();
        }
      }

      document.getElementById('player-container').addEventListener('click', showControls);
      document.getElementById('player-container').addEventListener('touchstart', showControls);
    </script>
    <script src="https://www.youtube.com/iframe_api"></script>
  </body>
  </html>
  `, [videoId, link]);

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'goBack':
          navigation.goBack();
          break;
        case 'openInBrowser':
          openInBrowser();
          break;
      }
    } catch (e) {
      console.error('Failed to parse message from WebView', e);
    }
  };

  const openInBrowser = () => {
    const url = link || `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Opening URL in browser: ${url}`);
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webViewRef}
        style={styles.webView}
        source={{html: customHTML}}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        onMessage={onMessage}
        onShouldStartLoadWithRequest={() => false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  webView: {
    flex: 1,
    backgroundColor: 'black',
  },
});

export default WebViewScreen;