// components/FloatingCommunityButton.tsx
import React, {useRef} from 'react';
import {
  Animated,
  PanResponder,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import useThemeStore from '../lib/zustand/themeStore';

const {width, height} = Dimensions.get('window');
const BUTTON_SIZE = 60;

// 🟢 CHANGED: Replaced navigation with an onOpen prop
interface Props {
  visible: boolean;
  onOpen: () => void;
}

const FloatingCommunityButton: React.FC<Props> = ({visible, onOpen}) => {
  const {primary} = useThemeStore(state => state);
  const pan = useRef(
    new Animated.ValueXY({x: width - 80, y: height - 150}),
  ).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, {dx: pan.x, dy: pan.y}], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        const finalX =
          gesture.moveX < width / 2 ? 20 : width - BUTTON_SIZE - 20;
        const finalY = Math.min(
          Math.max(gesture.moveY, 80),
          height - BUTTON_SIZE - 40,
        );
        Animated.spring(pan, {
          toValue: {x: finalX, y: finalY},
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.button,
        {transform: [{translateX: pan.x}, {translateY: pan.y}]},
      ]}
      {...panResponder.panHandlers}>
      <TouchableOpacity
        onPress={onOpen} // 🟢 CHANGED: Calls the prop instead of navigation
        activeOpacity={0.8}
        className="w-full h-full rounded-full items-center justify-center shadow-lg"
        style={{backgroundColor: primary, elevation: 5}}>
        <Ionicons name="chatbubbles" size={28} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    zIndex: 999,
  },
});

export default FloatingCommunityButton;
