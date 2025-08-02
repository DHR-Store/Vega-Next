import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Platform,
  Modal,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import useAppModeStore from '../lib/zustand/appModeStore';

// Custom colors to match the app theme
const primaryColor = '#00c3ff';
const secondaryColor = '#b3b3b3';
const primaryBg = '#121212';
const secondaryBg = '#1e1e1e';
const tertiaryBg = '#282828';
const accentColor = '#1DB954'; // Spotify Green, as in suzam19.html

/**
 * A new component for the Vega Music Player's settings screen.
 * It's based on the UI and functionality described in the suzam19.html file.
 */
const VegaMusicSetting = () => {
  const navigation = useNavigation();
  const setAppMode = useAppModeStore(state => state.setAppMode);

  // State for settings
  const [selectedAudioQuality, setSelectedAudioQuality] = useState('high');
  const [isEqualizerModalVisible, setIsEqualizerModalVisible] = useState(false);
  const [disableRightClick, setDisableRightClick] = useState(true);
  const [disableTextSelection, setDisableTextSelection] = useState(true);
  const [showHomeScreenOnStart, setShowHomeScreenOnStart] = useState(false); // NEW: State for home screen setting

  // Function to navigate back to the previous screen
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Function to exit music mode and return to the main app
  const handleExitMusicMode = useCallback(() => {
    console.log('Exiting music mode from settings.');
    setAppMode('video');
  }, [setAppMode]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Audio Quality Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Audio Quality</Text>
          <Text style={styles.sectionSubtitle}>
            Adjust the quality of your audio streams.
          </Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedAudioQuality}
              onValueChange={(itemValue) => setSelectedAudioQuality(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              dropdownIconColor={primaryColor}
            >
              <Picker.Item label="High" value="high" />
              <Picker.Item label="Medium" value="medium" />
              <Picker.Item label="Low" value="low" />
            </Picker>
          </View>
        </View>

        {/* Equalizer Setting Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equalizer</Text>
          <Text style={styles.sectionSubtitle}>
            Customize your audio sound profile.
          </Text>
          <TouchableOpacity
            style={styles.equalizerButton}
            onPress={() => setIsEqualizerModalVisible(true)}
          >
            <Text style={styles.equalizerButtonText}>Open Equalizer</Text>
            <Feather name="chevron-right" size={20} color={secondaryColor} />
          </TouchableOpacity>
        </View>

        {/* General App Behavior Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>

          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Disable right-click</Text>
            <Switch
              trackColor={{ false: secondaryBg, true: primaryColor }}
              thumbColor={'#fff'}
              ios_backgroundColor={secondaryBg}
              onValueChange={setDisableRightClick}
              value={disableRightClick}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Disable text selection</Text>
            <Switch
              trackColor={{ false: secondaryBg, true: primaryColor }}
              thumbColor={'#fff'}
              ios_backgroundColor={secondaryBg}
              onValueChange={setDisableTextSelection}
              value={disableTextSelection}
            />
          </View>

          {/* NEW: Show Home Screen on Start */}
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Show Home Screen on Start</Text>
            <Switch
              trackColor={{ false: secondaryBg, true: primaryColor }}
              thumbColor={'#fff'}
              ios_backgroundColor={secondaryBg}
              onValueChange={setShowHomeScreenOnStart}
              value={showHomeScreenOnStart}
            />
          </View>
        </View>
        
        {/* Exit Button */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={handleExitMusicMode}
            style={styles.exitButton}
          >
            <Feather name="x-circle" size={24} color="#f44336" style={{ marginRight: 10 }} />
            <Text style={styles.exitButtonText}>Exit VegaMusic Mode</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Equalizer Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEqualizerModalVisible}
        onRequestClose={() => {
          setIsEqualizerModalVisible(!isEqualizerModalVisible);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Equalizer Settings</Text>
              <TouchableOpacity onPress={() => setIsEqualizerModalVisible(false)}>
                <Feather name="x" size={24} color={secondaryColor} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalText}>
              This is a placeholder for a future equalizer functionality.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: primaryBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: secondaryBg,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  scrollView: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  section: {
    marginBottom: 24,
    backgroundColor: secondaryBg,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: secondaryColor,
    marginBottom: 16,
  },
  pickerContainer: {
    backgroundColor: tertiaryBg,
    borderRadius: 8,
    overflow: 'hidden',
    height: 50,
    justifyContent: 'center',
  },
  picker: {
    color: '#ffffff',
  },
  pickerItem: {
    color: '#ffffff',
  },
  equalizerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tertiaryBg,
    padding: 16,
    borderRadius: 8,
  },
  equalizerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tertiaryBg,
  },
  settingText: {
    color: '#ffffff',
    fontSize: 16,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tertiaryBg,
    padding: 16,
    borderRadius: 8,
  },
  exitButtonText: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: secondaryBg,
    borderRadius: 12,
    padding: 20,
    width: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalText: {
    fontSize: 16,
    color: secondaryColor,
  },
});

export default VegaMusicSetting;