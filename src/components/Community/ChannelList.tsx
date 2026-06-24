// components/Community/ChannelList.tsx
import React from 'react';
import {FlatList, TouchableOpacity, Text, View, StyleSheet} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';

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
  channels: string[];
  activeChannel: string;
  onSelectChannel: (channel: string) => void;
  unreadChannels: string[]; // 👈 ADD THIS PROP
}

const ChannelList: React.FC<Props> = ({
  channels,
  activeChannel,
  onSelectChannel,
  unreadChannels = [], // 👈 ADD THIS
}) => {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={channels}
      keyExtractor={item => item}
      contentContainerStyle={styles.list}
      renderItem={({item}) => {
        const isActive = item === activeChannel;
        // 👇 Check if this specific channel has unread messages
        const isUnread = unreadChannels.includes(item) && !isActive;
        const iconName = (CHANNEL_ICONS[item] ?? 'pound') as any;

        return (
          <TouchableOpacity
            onPress={() => onSelectChannel(item)}
            style={[
              styles.pill,
              isActive ? styles.pillActive : styles.pillInactive,
            ]}
            activeOpacity={0.75}>
            <MaterialCommunityIcons
              name={iconName}
              size={13}
              color={isActive ? '#fff' : '#6b7280'}
            />
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {item}
            </Text>

            {/* 👇 ADD THIS: The actual Red Dot */}
            {isUnread && <View style={styles.redDot} />}
          </TouchableOpacity>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  // ... keep your existing styles ...
  list: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
    position: 'relative', // 👈 ADD THIS so the absolute red dot positions correctly inside the pill
  },
  pillActive: {
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  pillInactive: {
    backgroundColor: '#1f2937',
  },
  pillText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  // 👇 ADD THIS NEW STYLE
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444', // Red color
    position: 'absolute',
    top: -2,
    right: 0,
    borderWidth: 1.5,
    borderColor: '#0d0f12', // Matches dark background
  },
});

export default ChannelList;
