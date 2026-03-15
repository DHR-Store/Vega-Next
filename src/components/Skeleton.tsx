import React from 'react';
import {View, StyleSheet} from 'react-native';

type SkeletonLoaderProps = {
  width: number | string;
  height: number;
  style?: any;
  darkMode?: boolean;
  marginVertical?: number;
};

const SkeletonLoader = ({
  width,
  height,
  style,
  darkMode = true,
  marginVertical = 8,
}: SkeletonLoaderProps) => {
  // Use a solid color instead of an animated gradient for maximum performance
  const backgroundColor = darkMode ? '#333333' : '#E0E0E0';

  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          marginVertical,
          backgroundColor,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: 8,
    opacity: 0.7, // Slight opacity to distinguish it from actual content
  },
});

export default SkeletonLoader;
