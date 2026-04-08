/**
 * ProfileAvatar.tsx
 *
 * Reusable profile picture component.
 * - Shows custom photo, OAuth photo URL, or initials fallback
 * - Tap to change photo via camera or gallery (expo-image-picker)
 * - Saves to user's MMKV partition via userSession.updateProfilePhoto()
 *
 * Installation (if not already installed):
 *   npx expo install expo-image-picker
 */

import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {userSession, User} from '../lib/services/login';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileAvatarProps {
  /** Size of the avatar circle in dp. Default 72. */
  size?: number;
  /** Whether tapping opens the photo picker. Default true. */
  editable?: boolean;
  /** Called after a new photo is saved. */
  onPhotoChanged?: (uri: string) => void;
  /** Override the user object (defaults to userSession.getCurrentUser()) */
  user?: User | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Derive a deterministic background color from the user's name/email. */
function getAvatarColor(seed: string): string {
  const colors = [
    '#e53e3e',
    '#dd6b20',
    '#d69e2e',
    '#38a169',
    '#319795',
    '#3182ce',
    '#805ad5',
    '#d53f8c',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileAvatar({
  size = 72,
  editable = true,
  onPhotoChanged,
  user: userProp,
}: ProfileAvatarProps) {
  const user = userProp ?? userSession.getCurrentUser();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Load the best available photo on mount and whenever user changes
  useEffect(() => {
    setPhotoUri(userSession.getBestPhotoUri());
  }, [user?.id]);

  const avatarColor = getAvatarColor(user?.email ?? user?.name ?? 'user');
  const initials = getInitials(user?.name ?? user?.email ?? 'U');
  const fontSize = Math.round(size * 0.35);
  const editBadgeSize = Math.round(size * 0.3);

  // ── Image picking ──────────────────────────────────────────────────────────

  const pickFromLibrary = useCallback(async () => {
    setMenuVisible(false);
    const {status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library.',
      );
      return;
    }

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const dataUri = `data:image/jpeg;base64,${asset.base64}`;
        userSession.updateProfilePhoto(dataUri);
        setPhotoUri(dataUri);
        onPhotoChanged?.(dataUri);
        DeviceEventEmitter.emit('profilePhotoChanged', dataUri);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onPhotoChanged]);

  const pickFromCamera = useCallback(async () => {
    setMenuVisible(false);
    const {status} = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access.');
      return;
    }

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const dataUri = `data:image/jpeg;base64,${asset.base64}`;
        userSession.updateProfilePhoto(dataUri);
        setPhotoUri(dataUri);
        onPhotoChanged?.(dataUri);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onPhotoChanged]);

  const removePhoto = useCallback(() => {
    setMenuVisible(false);
    Alert.alert('Remove Photo', 'Remove your profile photo?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          userSession.clearProfilePhoto();
          // Fall back to OAuth photo or null
          setPhotoUri(userSession.getBestPhotoUri());
          onPhotoChanged?.('');
        },
      },
    ]);
  }, [onPhotoChanged]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <TouchableOpacity
        onPress={() => editable && setMenuVisible(true)}
        activeOpacity={editable ? 0.8 : 1}
        style={[
          styles.container,
          {width: size, height: size, borderRadius: size / 2},
        ]}>
        {/* Photo or initials */}
        {photoUri ? (
          <Image
            source={{uri: photoUri}}
            style={[styles.image, {borderRadius: size / 2}]}
          />
        ) : (
          <View
            style={[
              styles.initialsCircle,
              {backgroundColor: avatarColor, borderRadius: size / 2},
            ]}>
            <Text style={[styles.initials, {fontSize}]}>{initials}</Text>
          </View>
        )}

        {/* Loading overlay */}
        {loading && (
          <View style={[styles.loadingOverlay, {borderRadius: size / 2}]}>
            <ActivityIndicator color="#fff" />
          </View>
        )}

        {/* Edit badge */}
        {editable && !loading && (
          <View
            style={[
              styles.editBadge,
              {
                width: editBadgeSize,
                height: editBadgeSize,
                borderRadius: editBadgeSize / 2,
                bottom: 0,
                right: 0,
              },
            ]}>
            <Text style={styles.editBadgeIcon}>✎</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Action sheet modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Profile Photo</Text>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={pickFromCamera}>
              <Text style={styles.sheetOptionIcon}>📷</Text>
              <Text style={styles.sheetOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={pickFromLibrary}>
              <Text style={styles.sheetOptionIcon}>🖼️</Text>
              <Text style={styles.sheetOptionText}>Choose from Library</Text>
            </TouchableOpacity>

            {photoUri && (
              <TouchableOpacity
                style={[styles.sheetOption, styles.sheetOptionDestructive]}
                onPress={removePhoto}>
                <Text style={styles.sheetOptionIcon}>🗑️</Text>
                <Text style={[styles.sheetOptionText, {color: '#ef4444'}]}>
                  Remove Photo
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setMenuVisible(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initialsCircle: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  editBadgeIcon: {
    fontSize: 10,
    color: '#000',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  sheetTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2d',
    gap: 14,
  },
  sheetOptionDestructive: {
    borderBottomWidth: 0,
  },
  sheetOptionIcon: {
    fontSize: 20,
  },
  sheetOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  sheetCancel: {
    marginTop: 12,
    paddingVertical: 14,
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
