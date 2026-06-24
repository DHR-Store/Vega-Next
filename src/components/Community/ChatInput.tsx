// components/Community/ChatInput.tsx
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
// 👇 Required for TypeScript to recognise onImageChange
import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import {PendingAttachment} from '../../lib/hooks/useMediaPicker';

interface Props {
  inputText: string;
  setInputText: (text: string) => void;
  sending: boolean;
  editingMessageId: string | null;
  activeChannel: string;
  paddingBottom: number;
  pendingAttachment: PendingAttachment | null;
  onSendOrEdit: () => void;
  onCancelEdit: () => void;
  onAttachPress: () => void;
  onClearAttachment: () => void;
  onImageSelected?: (imageData: {
    uri: string;
    mime: string;
    data?: string;
  }) => void;
}

const ChatInput: React.FC<Props> = ({
  inputText,
  setInputText,
  sending,
  editingMessageId,
  activeChannel,
  paddingBottom,
  pendingAttachment,
  onSendOrEdit,
  onCancelEdit,
  onAttachPress,
  onClearAttachment,
  onImageSelected,
}) => {
  const canSend =
    (inputText.trim().length > 0 || pendingAttachment !== null) && !sending;
  const previewUri = pendingAttachment?.localUri ?? null;

  const handleImageChange = (event: any) => {
    const {uri, mime, data} = event.nativeEvent;
    if (onImageSelected && uri) {
      onImageSelected({uri, mime, data});
    }
  };

  return (
    <View style={[styles.container, {paddingBottom}]}>
      {editingMessageId && (
        <View style={styles.editBanner}>
          <View style={styles.editBannerLeft}>
            <MaterialCommunityIcons name="pencil" size={14} color="#60a5fa" />
            <Text style={styles.editBannerText}>Editing message</Text>
          </View>
          <TouchableOpacity onPress={onCancelEdit} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>
      )}

      {pendingAttachment && (
        <View style={styles.attachmentPreview}>
          {pendingAttachment.type === 'image' && previewUri ? (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{uri: previewUri}} style={styles.imagePreview} />
              {pendingAttachment.uploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.uploadingText}>Uploading…</Text>
                </View>
              )}
              {!pendingAttachment.uploading &&
                pendingAttachment.uploadedUrl && (
                  <View style={styles.uploadedBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#22c55e"
                    />
                  </View>
                )}
            </View>
          ) : pendingAttachment.type === 'video' ? (
            <View style={styles.mediaPreviewBox}>
              <Ionicons name="videocam" size={28} color="#60a5fa" />
              <View style={styles.mediaPreviewInfo}>
                <Text style={styles.mediaPreviewTitle}>Video attached</Text>
                {pendingAttachment.uploading ? (
                  <Text style={styles.mediaPreviewSub}>Uploading…</Text>
                ) : (
                  <Text style={[styles.mediaPreviewSub, {color: '#22c55e'}]}>
                    Ready to send
                  </Text>
                )}
              </View>
              {pendingAttachment.uploading && (
                <ActivityIndicator size="small" color="#60a5fa" />
              )}
            </View>
          ) : pendingAttachment.type === 'audio' ? (
            <View style={styles.mediaPreviewBox}>
              <MaterialCommunityIcons
                name="music-note"
                size={28}
                color="#a78bfa"
              />
              <View style={styles.mediaPreviewInfo}>
                <Text style={styles.mediaPreviewTitle}>Audio attached</Text>
                {pendingAttachment.uploading ? (
                  <Text style={styles.mediaPreviewSub}>Uploading…</Text>
                ) : (
                  <Text style={[styles.mediaPreviewSub, {color: '#22c55e'}]}>
                    Ready to send
                  </Text>
                )}
              </View>
              {pendingAttachment.uploading && (
                <ActivityIndicator size="small" color="#a78bfa" />
              )}
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={onClearAttachment}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            editingMessageId && styles.actionBtnDisabled,
          ]}
          onPress={onAttachPress}
          disabled={!!editingMessageId}
          hitSlop={6}>
          <Ionicons
            name="add-circle"
            size={30}
            color={editingMessageId ? '#374151' : '#6b7280'}
          />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder={`Message #${activeChannel}`}
          placeholderTextColor="#4b5563"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={2000}
          textAlignVertical="center"
          keyboardType="default"
        />

        <TouchableOpacity
          onPress={onSendOrEdit}
          disabled={!canSend}
          style={[
            styles.sendBtn,
            canSend ? styles.sendBtnActive : styles.sendBtnInactive,
          ]}>
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name={editingMessageId ? 'checkmark' : 'send'}
              size={18}
              color={canSend ? '#fff' : '#374151'}
              style={editingMessageId ? undefined : {marginLeft: 2}}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#1e2530',
    backgroundColor: '#111318',
    paddingTop: 8,
    paddingHorizontal: 10,
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e2d4a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  editBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editBannerText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '500',
  },
  attachmentPreview: {
    backgroundColor: '#1a1f28',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e2530',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imagePreviewWrapper: {
    position: 'relative',
    width: 72,
    height: 72,
  },
  imagePreview: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#1e2530',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  uploadingText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  uploadedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#0d0f12',
    borderRadius: 12,
  },
  mediaPreviewBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e2530',
    borderRadius: 10,
    padding: 10,
  },
  mediaPreviewInfo: {
    flex: 1,
  },
  mediaPreviewTitle: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '600',
  },
  mediaPreviewSub: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 2,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e2530',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  actionBtn: {
    paddingBottom: 8,
    paddingHorizontal: 2,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1a1f28',
    color: '#f3f4f6',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    minHeight: 44,
    maxHeight: 130,
    borderWidth: 1,
    borderColor: '#1e2530',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  sendBtnActive: {
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  sendBtnInactive: {
    backgroundColor: '#1e2530',
  },
});

export default ChatInput;
