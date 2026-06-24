// components/Community/MessageActionModal.tsx
import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  ToastAndroid,
  Alert,
  ScrollView,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  MaterialIcons,
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import {CommunityMessage} from '../../lib/services/CommunityService';

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedMessage: CommunityMessage | null;
  currentUserId: string | undefined;
  onEdit: (message: CommunityMessage) => void;
  onDelete: (id: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onReply: (message: CommunityMessage) => void; // 👈 NEW: Added onReply prop
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🔥'];

const MessageActionModal: React.FC<Props> = ({
  visible,
  onClose,
  selectedMessage,
  currentUserId,
  onEdit,
  onDelete,
  onReact,
  onReply, // 👈 NEW: Destructure prop
}) => {
  if (!selectedMessage) return null;

  const isOwner = selectedMessage.user_id === currentUserId;

  const handleCopy = () => {
    if (!selectedMessage.message) return;
    Clipboard.setString(selectedMessage.message);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
    } else {
      Alert.alert('Copied', 'Message copied to clipboard.');
    }
    onClose();
  };

  const handleReact = (emoji: string) => {
    onReact?.(selectedMessage.id, emoji);
    onClose();
  };

  const previewText = selectedMessage.message
    ? selectedMessage.message.length > 80
      ? selectedMessage.message.slice(0, 80) + '…'
      : selectedMessage.message
    : selectedMessage.attachments?.length
      ? `📎 Attachment`
      : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          {/* Handle pill */}
          <View style={styles.handle} />

          {/* Sender info + preview */}
          <View style={styles.preview}>
            <Text style={styles.previewSender}>
              {selectedMessage.user_name}
            </Text>
            {!!previewText && (
              <Text style={styles.previewText} numberOfLines={2}>
                {previewText}
              </Text>
            )}
          </View>

          {/* Quick reactions */}
          {onReact && (
            <View style={styles.reactionsRow}>
              {QUICK_REACTIONS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionBtn}
                  onPress={() => handleReact(emoji)}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionGroup}>
            {/* 👈 NEW: Reply Action (Available to everyone) */}
            <TouchableOpacity
              style={styles.action}
              onPress={() => {
                onClose();
                onReply(selectedMessage);
              }}>
              <View style={[styles.actionIcon, {backgroundColor: '#1e3a8a'}]}>
                <Ionicons name="arrow-undo-outline" size={20} color="#60a5fa" />
              </View>
              <Text style={styles.actionText}>Reply</Text>
              <Ionicons name="chevron-forward" size={16} color="#374151" />
            </TouchableOpacity>

            {!!selectedMessage.message && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.action} onPress={handleCopy}>
                  <View
                    style={[styles.actionIcon, {backgroundColor: '#1e2d4a'}]}>
                    <Ionicons name="copy-outline" size={20} color="#60a5fa" />
                  </View>
                  <Text style={styles.actionText}>Copy Text</Text>
                  <Ionicons name="chevron-forward" size={16} color="#374151" />
                </TouchableOpacity>
              </>
            )}

            {isOwner && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.action}
                  onPress={() => {
                    onClose();
                    onEdit(selectedMessage);
                  }}>
                  <View
                    style={[styles.actionIcon, {backgroundColor: '#1a2e1a'}]}>
                    <MaterialIcons name="edit" size={20} color="#4ade80" />
                  </View>
                  <Text style={styles.actionText}>Edit Message</Text>
                  <Ionicons name="chevron-forward" size={16} color="#374151" />
                </TouchableOpacity>

                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.action}
                  onPress={() => {
                    onClose();
                    onDelete(selectedMessage.id);
                  }}>
                  <View
                    style={[styles.actionIcon, {backgroundColor: '#2d1a1a'}]}>
                    <MaterialIcons
                      name="delete-outline"
                      size={20}
                      color="#f87171"
                    />
                  </View>
                  <Text style={[styles.actionText, {color: '#f87171'}]}>
                    Delete Message
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#374151" />
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111318',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: '#1e2530',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  preview: {
    backgroundColor: '#1a1f28',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  previewSender: {
    color: '#60a5fa',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  previewText: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1a1f28',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  reactionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e2530',
  },
  reactionEmoji: {fontSize: 22},
  actionGroup: {
    backgroundColor: '#1a1f28',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    flex: 1,
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#1e2530',
    marginHorizontal: 14,
  },
  cancelBtn: {
    backgroundColor: '#1a1f28',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  cancelText: {
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MessageActionModal;
