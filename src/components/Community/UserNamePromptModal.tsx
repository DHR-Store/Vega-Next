// components/Community/UserNamePromptModal.tsx
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';

interface Props {
  visible: boolean;
  tempName: string;
  setTempName: (name: string) => void;
  onSave: () => void;
  onCloseChat: () => void;
}

const UserNamePromptModal: React.FC<Props> = ({
  visible,
  tempName,
  setTempName,
  onSave,
  onCloseChat,
}) => {
  const isValid = tempName.trim().length >= 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCloseChat}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}>
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons
              name="chat-processing"
              size={36}
              color="#3b82f6"
            />
          </View>

          <Text style={styles.title}>Join the Community</Text>
          <Text style={styles.subtitle}>
            Choose a display name to start chatting with others.
          </Text>

          <TextInput
            style={[styles.input, isValid && styles.inputValid]}
            placeholder="Your display name…"
            placeholderTextColor="#4b5563"
            value={tempName}
            onChangeText={setTempName}
            autoFocus
            maxLength={25}
            returnKeyType="done"
            onSubmitEditing={isValid ? onSave : undefined}
          />

          {tempName.trim().length > 0 && tempName.trim().length < 2 && (
            <Text style={styles.hint}>Name must be at least 2 characters</Text>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
            onPress={onSave}
            disabled={!isValid}>
            <Text style={styles.saveBtnText}>Save & Join Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.leaveBtn} onPress={onCloseChat}>
            <Text style={styles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#111318',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e2530',
    alignItems: 'center',
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1e2d4a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#f3f4f6',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  input: {
    width: '100%',
    backgroundColor: '#1a1f28',
    color: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: '#1e2530',
    marginBottom: 4,
  },
  inputValid: {
    borderColor: '#2563eb',
  },
  hint: {
    color: '#ef4444',
    fontSize: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 4,
  },
  saveBtn: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#2563eb',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnDisabled: {
    backgroundColor: '#1e2530',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  leaveBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  leaveBtnText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default UserNamePromptModal;
