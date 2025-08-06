import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import VegaMusicHome from '../screens/music/VegaMusicHome';
import VegaMusicSearch from '../screens/music/VegaMusicSearch';
import {VegaMusicStackParamList} from '../App';

// Define the stack navigator for the music app mode
const Stack = createNativeStackNavigator<VegaMusicStackParamList>();

/**
 * A stack navigator for the music-related screens.
 * This component defines the navigation flow for the music home, search, and player screens.
 * It's used within the main App.tsx file when the appMode is set to 'music'.
 * The VegaMusicStackParamList type is imported from App.tsx to ensure type safety.
 */
function VegaMusicStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 200,
        freezeOnBlur: true,
        contentStyle: {backgroundColor: 'transparent'},
      }}>
      <Stack.Screen name="VegaMusicHome" component={VegaMusicHome} />
      <Stack.Screen name="VegaMusicSearch" component={VegaMusicSearch} />
    </Stack.Navigator>
  );
}

export default VegaMusicStack;
