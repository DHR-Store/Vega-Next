import {
  PermissionsAndroid,
  Platform,
  ToastAndroid,
  Linking,
} from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';

export const YTDownloader = {
  downloadVideo: async (url: string, fileName: string, mimeType?: string) => {
    if (Platform.OS === 'android' && Platform.Version < 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        ToastAndroid.show('Permission Denied', ToastAndroid.SHORT);
        return;
      }
    }

    const {config, fs} = RNFetchBlob;
    const downloads = fs.dirs.DownloadDir;

    let safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/gi, '_');

    if (!safeFileName.includes('.')) {
      if (mimeType?.includes('audio')) safeFileName += '.m4a';
      else if (mimeType?.includes('zip')) safeFileName += '.zip';
      else safeFileName += '.mp4';
    }

    ToastAndroid.show('Download Started...', ToastAndroid.SHORT);

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
          'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
      })
      .then(res => {
        ToastAndroid.show(
          `Saved ${safeFileName} to Downloads folder`,
          ToastAndroid.LONG,
        );
      })
      .catch(err => {
        console.error('RNFetchBlob Error:', err);
        ToastAndroid.show('Using Browser Fallback...', ToastAndroid.SHORT);
        Linking.openURL(url).catch(e => console.error('Fallback Failed', e));
      });
  },
};
