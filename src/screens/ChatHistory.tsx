import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  DeviceEventEmitter,
  SafeAreaView,
} from 'react-native';
import {MaterialCommunityIcons, Ionicons, Feather} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import useThemeStore from '../lib/zustand/themeStore';
import {MMKV} from '../lib/Mmkv'; // Use your local wrapper!
import {ChatSession, formatTime} from '../components/AI'; // Import types and helper

const CHAT_SESSIONS_KEY = 'vega_ai_chat_sessions';

const ChatHistory = () => {
  const navigation = useNavigation();
  const {primary} = useThemeStore(state => state);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const loadSessions = () => {
    const saved = MMKV.getString(CHAT_SESSIONS_KEY);
    if (saved) {
      try {
        const parsed: ChatSession[] = JSON.parse(saved);
        setSessions(parsed);
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    } else {
      setSessions([]);
    }
  };

  useEffect(() => {
    loadSessions();
    const subscription = DeviceEventEmitter.addListener(
      'aiChatHistoryUpdated',
      loadSessions,
    );
    return () => subscription.remove();
  }, []);

  const deleteSession = (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    MMKV.setString(CHAT_SESSIONS_KEY, JSON.stringify(updated));
    DeviceEventEmitter.emit('aiChatHistoryUpdated');
  };

  const loadSessionIntoChat = (id: string) => {
    // Notify the AI component to open this specific session
    DeviceEventEmitter.emit('loadChatSession', id);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat Sessions</Text>
        <View style={{width: 28}} />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}>
        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="robot-dead-outline"
              size={64}
              color="#333"
            />
            <Text style={styles.emptyText}>No chat history found.</Text>
          </View>
        ) : (
          sessions.map(session => {
            // Get the last user/assistant message to show as a preview snippet
            const displayMessages = session.messages.filter(
              m => m.role === 'user' || m.role === 'assistant',
            );
            const lastMessage = displayMessages[displayMessages.length - 1];

            return (
              <TouchableOpacity
                key={session.id}
                onPress={() => loadSessionIntoChat(session.id)}
                activeOpacity={0.8}
                style={styles.sessionCard}>
                <View style={styles.sessionIconContainer}>
                  <MaterialCommunityIcons
                    name="robot"
                    size={24}
                    color={primary}
                  />
                </View>

                <View style={styles.sessionInfo}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                    <Text style={styles.sessionTitle} numberOfLines={1}>
                      {session.title}
                    </Text>
                    <Text style={styles.sessionDate}>
                      {formatTime(session.updatedAt)}
                    </Text>
                  </View>
                  <Text style={styles.sessionPreview} numberOfLines={2}>
                    {lastMessage ? lastMessage.content : 'Empty Chat'}
                  </Text>
                </View>

                {/* Delete specific session */}
                <TouchableOpacity
                  onPress={() => deleteSession(session.id)}
                  style={styles.deleteBtn}>
                  <Feather name="trash-2" size={18} color="#EF4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ChatHistory;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#141414'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  backButton: {padding: 4},
  headerTitle: {color: 'white', fontSize: 18, fontWeight: 'bold'},
  list: {flex: 1},
  listContent: {padding: 16},
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {color: '#6B7280', fontSize: 16, marginTop: 16},
  sessionCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
  },
  sessionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  sessionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  sessionDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  sessionPreview: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 8,
  },
});
