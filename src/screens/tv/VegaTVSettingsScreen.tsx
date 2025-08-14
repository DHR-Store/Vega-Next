// File: src/screens/tv/VegaTVSettingsScreen.tsx

import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useAppModeStore from '../../lib/zustand/appModeStore';

const VegaTVSettingsScreen: React.FC = () => {
  const {setAppMode} = useAppModeStore();

  const handleExitTVMode = () => {
    setAppMode('video'); // Set the app mode back to 'video' to open the main app
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Settings</Text>
      <TouchableOpacity style={styles.settingItem} onPress={handleExitTVMode}>
        <MaterialCommunityIcons name="exit-to-app" size={24} color="white" />
        <Text style={styles.settingText}>Exit VegaTV Mode</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 30,
    textAlign: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  settingText: {
    color: 'white',
    fontSize: 18,
    marginLeft: 15,
  },
});

export default VegaTVSettingsScreen;
