// components/Community/MessageItem.tsx
import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import {CommunityMessage} from '../../lib/services/CommunityService';

const {width: SW, height: SH} = Dimensions.get('window');

interface Props {
  item: CommunityMessage;
  isOwn: boolean;
  onLongPress: (item: CommunityMessage) => void;
  onSwipeToReply: (item: CommunityMessage) => void; // 👈 NEW PROP
}

const ImageLightbox: React.FC<{
  uri: string;
  visible: boolean;
  onClose: () => void;
}> = ({uri, visible, onClose}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}>
    <Pressable style={styles.lightboxBackdrop} onPress={onClose}>
      <Image source={{uri}} style={styles.lightboxImage} resizeMode="contain" />
      <TouchableOpacity style={styles.lightboxClose} onPress={onClose}>
        <Ionicons name="close-circle" size={32} color="#fff" />
      </TouchableOpacity>
    </Pressable>
  </Modal>
);

const MessageItem: React.FC<Props> = ({
  item,
  isOwn,
  onLongPress,
  onSwipeToReply,
}) => {
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [imgError, setImgError] = useState<Record<number, boolean>>({});
  const [imgLoading, setImgLoading] = useState<Record<number, boolean>>({});

  // ── SWIPE TO REPLY LOGIC ──
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      // Only capture the drag if they scroll horizontally more than 15px (prevents accidental vertical scroll blocking)
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 15 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy),

      // Move the message bubble to the right
      onPanResponderMove: (_, gestureState) => {
        // Only allow swiping to the right
        if (gestureState.dx > 0) {
          pan.setValue({x: gestureState.dx, y: 0});
        }
      },

      // When the user lets go of the screen
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          // If swiped far enough right, trigger reply!
          onSwipeToReply(item);
        }
        // Spring the message bubble back into its original place
        Animated.spring(pan, {
          toValue: {x: 0, y: 0},
          useNativeDriver: false,
          bounciness: 10,
        }).start();
      },
    }),
  ).current;

  const date = new Date(item.created_at);
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const timeString = `${hours12}:${minutes} ${ampm}`;
  const dateString = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const isToday = new Date().toDateString() === date.toDateString();

  const Avatar = () => (
    <View style={styles.avatar}>
      {item.user_photo ? (
        <Image
          source={{uri: item.user_photo}}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Text style={styles.avatarText}>
          {(item.user_name?.charAt(0) ?? '?').toUpperCase()}
        </Text>
      )}
    </View>
  );

  const renderAttachment = (att: any, idx: number) => {
    if (att.type === 'sticker') {
      return (
        <Text key={idx} style={styles.stickerEmoji}>
          {att.url}
        </Text>
      );
    }

    if (att.type === 'image') {
      if (imgError[idx]) {
        return (
          <View key={idx} style={styles.imgErrorBox}>
            <Ionicons name="image-outline" size={24} color="#6b7280" />
            <Text style={styles.imgErrorText}>Image unavailable</Text>
          </View>
        );
      }
      const imageUri = att.url?.trim();
      if (!imageUri) return null;

      return (
        <TouchableOpacity
          key={idx}
          onPress={() => setLightboxUri(imageUri)}
          activeOpacity={0.9}
          style={styles.imageWrapper}>
          {imgLoading[idx] && (
            <View style={styles.imgLoadingOverlay}>
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          )}
          <Image
            source={{uri: imageUri, cache: 'force-cache'}}
            style={styles.attachedImage}
            onLoadStart={() => setImgLoading(prev => ({...prev, [idx]: true}))}
            onLoadEnd={() => setImgLoading(prev => ({...prev, [idx]: false}))}
            onError={() => {
              setImgError(prev => ({...prev, [idx]: true}));
              setImgLoading(prev => ({...prev, [idx]: false}));
            }}
          />
          <View style={styles.expandHint}>
            <Ionicons name="expand-outline" size={12} color="#fff" />
          </View>
        </TouchableOpacity>
      );
    }

    if (att.type === 'video') {
      const videoUri = att.url?.trim();
      if (!videoUri) return null;
      return (
        <View key={idx} style={styles.videoBox}>
          <View style={styles.videoIconWrap}>
            <Ionicons name="videocam" size={22} color="#fff" />
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.videoTitle}>Video</Text>
            <Text style={styles.videoSub} numberOfLines={1}>
              {videoUri.split('/').pop()}
            </Text>
          </View>
          <Ionicons name="play-circle" size={28} color="#3b82f6" />
        </View>
      );
    }

    if (att.type === 'audio') {
      const audioUri = att.url?.trim();
      if (!audioUri) return null;
      return (
        <View key={idx} style={styles.audioBox}>
          <MaterialCommunityIcons name="music-note" size={22} color="#a78bfa" />
          <View style={{flex: 1}}>
            <Text style={styles.videoTitle}>Audio</Text>
            <Text style={styles.videoSub} numberOfLines={1}>
              {audioUri.split('/').pop()}
            </Text>
          </View>
          <Ionicons name="play-circle" size={28} color="#a78bfa" />
        </View>
      );
    }

    return null;
  };

  return (
    <>
      <Pressable
        onLongPress={() => onLongPress(item)}
        delayLongPress={300}
        style={{width: '100%'}}>
        {/* 👈 NEW: Animated View wrapper to handle the swipe movement */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.row,
            isOwn ? styles.rowOwn : styles.rowOther,
            {transform: [{translateX: pan.x}]},
          ]}>
          {!isOwn && (
            <View style={styles.avatarContainer}>
              <Avatar />
            </View>
          )}

          <View
            style={[
              styles.contentWrapper,
              isOwn ? {alignItems: 'flex-end'} : {alignItems: 'flex-start'},
            ]}>
            <View style={styles.metaRow}>
              {!isOwn && (
                <Text style={styles.senderName}>{item.user_name}</Text>
              )}
              <Text style={styles.timestamp}>
                {isToday ? timeString : `${dateString} ${timeString}`}
              </Text>
            </View>

            <View
              style={[
                styles.bubble,
                isOwn ? styles.bubbleOwn : styles.bubbleOther,
              ]}>
              {/* 👈 NEW: Embedded Reply Preview Box inside the bubble */}
              {item.reply_to && (
                <View style={styles.replyPreviewBox}>
                  <Text style={styles.replyPreviewName}>
                    Replying to {item.reply_to.user_name}
                  </Text>
                  <Text style={styles.replyPreviewText} numberOfLines={1}>
                    {item.reply_to.message}
                  </Text>
                </View>
              )}

              {!!item.message && (
                <Text style={styles.messageText}>
                  {item.message}
                  {item.is_edited && (
                    <Text style={styles.editedText}> (edited)</Text>
                  )}
                </Text>
              )}
              {item.attachments?.map((att, idx) => renderAttachment(att, idx))}
            </View>
          </View>

          {isOwn && (
            <View style={styles.avatarContainer}>
              <Avatar />
            </View>
          )}
        </Animated.View>
      </Pressable>

      {lightboxUri && (
        <ImageLightbox
          uri={lightboxUri}
          visible
          onClose={() => setLightboxUri(null)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 10,
    alignItems: 'flex-end',
  },
  rowOwn: {justifyContent: 'flex-end'},
  rowOther: {justifyContent: 'flex-start'},
  avatarContainer: {marginHorizontal: 6, marginBottom: 2},
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e2530',
  },
  avatarText: {color: '#fff', fontWeight: '700', fontSize: 14},
  contentWrapper: {maxWidth: '75%'},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    gap: 6,
    paddingHorizontal: 4,
  },
  senderName: {
    color: '#93c5fd',
    fontWeight: '700',
    fontSize: 12,
    maxWidth: 120,
  },
  timestamp: {color: '#4b5563', fontSize: 10},
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: '100%',
  },
  bubbleOwn: {backgroundColor: '#1d4ed8', borderBottomRightRadius: 4},
  bubbleOther: {
    backgroundColor: '#1a1f28',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#1e2530',
  },
  messageText: {color: '#f3f4f6', fontSize: 15, lineHeight: 21, flexShrink: 1},
  editedText: {color: '#93c5fd', fontSize: 11, fontStyle: 'italic'},

  // ── NEW REPLY STYLES ──
  replyPreviewBox: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#60a5fa',
  },
  replyPreviewName: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  replyPreviewText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  // ─────────────────────────

  stickerEmoji: {fontSize: 52, marginTop: 2},
  imageWrapper: {
    marginTop: 6,
    borderRadius: 12,
    overflow: 'hidden',
    width: 200,
    height: 200,
    backgroundColor: '#1e2530',
  },
  attachedImage: {width: '100%', height: '100%'},
  imgLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1e2530',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  expandHint: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 3,
  },
  imgErrorBox: {
    width: 200,
    height: 80,
    backgroundColor: '#1e2530',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  imgErrorText: {color: '#6b7280', fontSize: 12},
  videoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    width: 230,
    gap: 8,
  },
  videoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoTitle: {color: '#f3f4f6', fontWeight: '600', fontSize: 13},
  videoSub: {color: '#6b7280', fontSize: 11, marginTop: 2},
  audioBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    width: 230,
    gap: 8,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {width: SW, height: SH * 0.8},
  lightboxClose: {position: 'absolute', top: 50, right: 20},
});

export default MessageItem;
