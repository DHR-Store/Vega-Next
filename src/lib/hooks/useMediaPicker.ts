// hooks/useMediaPicker.ts
import {launchImageLibrary, launchCamera} from 'react-native-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {uploadToSupabase} from '../services/uploadService';
import {Alert, PermissionsAndroid, Platform} from 'react-native';

export interface PendingAttachment {
  type: 'image' | 'video' | 'audio' | 'sticker';
  localUri: string;
  uploadedUrl: string | null;
  uploading: boolean;
  mimeType?: string;
}

const requestCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'App needs camera access to take photos.',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

const requestStoragePermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 33) return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'App needs storage access to attach files.',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

export const useMediaPicker = () => {
  // 👇 NEW: Exposed upload function for keyboard‑selected images/GIFs
  const uploadMedia = async (uri: string, mimeType: string): Promise<string> => {
    // Determine bucket based on mime type
    const bucket = mimeType.startsWith('image/')
      ? 'images'
      : mimeType.startsWith('video/')
        ? 'videos'
        : mimeType.startsWith('audio/')
          ? 'audio'
          : 'images';
    return uploadToSupabase(uri, bucket, mimeType);
  };

  const pickImage = async (fromCamera = false): Promise<PendingAttachment | null> => {
    try {
      if (fromCamera) {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
          Alert.alert('Permission Denied', 'Camera permission is required.');
          return null;
        }
      } else {
        await requestStoragePermission();
      }

      const options = {
        mediaType: 'photo' as const,
        quality: 0.85 as const,
        includeBase64: false,
        maxWidth: 1920,
        maxHeight: 1920,
      };

      const result = fromCamera
        ? await launchCamera(options)
        : await launchImageLibrary(options);

      if (result.didCancel || result.errorCode) return null;

      const asset = result.assets?.[0];
      if (!asset?.uri) return null;

      const pending: PendingAttachment = {
        type: 'image',
        localUri: asset.uri,
        uploadedUrl: null,
        uploading: true,
        mimeType: asset.type ?? 'image/jpeg',
      };

      uploadMedia(asset.uri, asset.type ?? 'image/jpeg')
        .then(url => {
          pending.uploadedUrl = url;
          pending.uploading = false;
        })
        .catch(e => {
          console.error('Image upload failed:', e);
          pending.uploading = false;
        });

      return pending;
    } catch (e) {
      console.error('pickImage error:', e);
      return null;
    }
  };

  const pickVideo = async (): Promise<PendingAttachment | null> => {
    try {
      await requestStoragePermission();

      const result = await launchImageLibrary({mediaType: 'video' as const});
      if (result.didCancel || result.errorCode) return null;

      const asset = result.assets?.[0];
      if (!asset?.uri) return null;

      const pending: PendingAttachment = {
        type: 'video',
        localUri: asset.uri,
        uploadedUrl: null,
        uploading: true,
        mimeType: asset.type ?? 'video/mp4',
      };

      uploadMedia(asset.uri, asset.type ?? 'video/mp4')
        .then(url => {
          pending.uploadedUrl = url;
          pending.uploading = false;
        })
        .catch(e => {
          console.error('Video upload failed:', e);
          pending.uploading = false;
        });

      return pending;
    } catch (e) {
      console.error('pickVideo error:', e);
      return null;
    }
  };

  const pickAudio = async (): Promise<PendingAttachment | null> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return null;

      const file = result.assets[0];
      const mimeType = file.mimeType ?? 'audio/mpeg';

      const pending: PendingAttachment = {
        type: 'audio',
        localUri: file.uri,
        uploadedUrl: null,
        uploading: true,
        mimeType,
      };

      uploadMedia(file.uri, mimeType)
        .then(url => {
          pending.uploadedUrl = url;
          pending.uploading = false;
        })
        .catch(e => {
          console.error('Audio upload failed:', e);
          pending.uploading = false;
        });

      return pending;
    } catch (e) {
      console.error('pickAudio error:', e);
      return null;
    }
  };

  return {pickImage, pickVideo, pickAudio, uploadMedia};
};