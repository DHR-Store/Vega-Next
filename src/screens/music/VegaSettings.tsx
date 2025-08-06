import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert} from 'react-native';
// Corrected import path
import useAppModeStore from '../../lib/zustand/appModeStore';

const VegaSettings = () => {
  // Use the zustand store to get the function to change the app mode
  const setAppMode = useAppModeStore(state => state.setAppMode);

  const handleExitMusicMode = () => {
    // Call the function from the store to switch the mode back to 'video'
    setAppMode('video');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vega Music Settings</Text>

      {/* Button to switch back to video mode */}
      <TouchableOpacity style={styles.button} onPress={handleExitMusicMode}>
        <Text style={styles.buttonText}>Exit Vega Music Mode</Text>
      </TouchableOpacity>

      {/* Other settings can go here */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#ff3b30', // Use a distinctive color for the exit button
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default VegaSettings;
