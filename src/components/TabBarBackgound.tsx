import {StyleSheet, View} from 'react-native';
import React from 'react';
import LinearGradient from 'react-native-linear-gradient';

const TabBarBackgound = () => {
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* 🟢 REPLACE BlurView with a high-performance semi-transparent background color overlay */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {backgroundColor: 'rgba(15, 15, 15, 0.85)'}, // Smooth dark backing
        ]}
      />
      <LinearGradient
        colors={[
          'rgba(0, 0, 0, 0.0)',
          'rgba(0, 0, 0, 0.3)',
          'rgba(0, 0, 0, 0.6)',
          'rgba(0, 0, 0, 0.9)',
          'rgba(0, 0, 0, 1)',
        ]}
        style={StyleSheet.absoluteFill}
        start={{x: 0, y: 0}}
        end={{x: 0, y: 1}}
      />
    </View>
  );
};

export default TabBarBackgound;
