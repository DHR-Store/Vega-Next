// components/Community/ChannelDrawer.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';

const CHANNEL_ICONS: Record<string, string> = {
  General: 'pound',
  Anime: 'television-play',
  Movie: 'film',
  'TV Show': 'monitor',
  'Off-Topic': 'coffee-outline',
  Suggestions: 'lightbulb-outline',
  Help: 'help-circle-outline',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  channels: string[];
  activeChannel: string;
  onSelectChannel: (channel: string) => void;
  unreadChannels?: string[]; // 👈 NEW: Accepts unread channels list
}

const ChannelDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  channels,
  activeChannel,
  onSelectChannel,
  unreadChannels = [],
}) => {
  if (!isOpen) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <MaterialCommunityIcons
            name="chat-outline"
            size={20}
            color="#3b82f6"
          />
          <Text style={styles.sidebarTitle}>Channels</Text>
        </View>

        <Text style={styles.sectionLabel}>COMMUNITY</Text>

        <FlatList
          data={channels}
          keyExtractor={item => item}
          renderItem={({item}) => {
            const isActive = item === activeChannel;
            const hasUnread = unreadChannels.includes(item); // 👈 Check if unread
            const iconName = (CHANNEL_ICONS[item] ?? 'pound') as any;

            return (
              <TouchableOpacity
                style={[
                  styles.channelItem,
                  isActive && styles.channelItemActive,
                ]}
                onPress={() => onSelectChannel(item)}>
                <MaterialCommunityIcons
                  name={iconName}
                  size={20}
                  color={isActive ? '#60a5fa' : '#6b7280'}
                />
                <Text
                  style={[
                    styles.channelText,
                    isActive && styles.channelTextActive,
                    hasUnread && styles.channelTextUnread, // 👈 Bright white text if unread
                  ]}>
                  {item}
                </Text>

                {/* 👈 Render the Red Dot */}
                {hasUnread && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      </View>
      <Pressable style={styles.backdrop} onPress={onClose} />
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    height: '100%',
    backgroundColor: '#0d0f12',
    borderRightWidth: 1,
    borderRightColor: '#1e2530',
    zIndex: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2530',
  },
  sidebarTitle: {
    color: '#f3f4f6',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  sectionLabel: {
    color: '#374151',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  drawerRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginLeft: 'auto', // Pushes it to the right edge of the drawer
    marginRight: 16,
    zIndex: 99,
  },
  channelItemActive: {
    backgroundColor: '#1a1f28',
    borderRightWidth: 3,
    borderRightColor: '#3b82f6',
  },
  channelText: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  channelTextActive: {
    color: '#f3f4f6',
    fontWeight: '700',
  },
  channelTextUnread: {
    color: '#f3f4f6',
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444', // Red alert dot
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },
});

export default ChannelDrawer;
