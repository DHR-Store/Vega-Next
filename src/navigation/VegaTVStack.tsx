import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import LiveTVScreen from '../screens/tv/LiveTVScreen';
import TVPlayerScreen from '../screens/tv/TVPlayerScreen';
import {VegaTVStackParamList} from '../App';

// Define the stack navigator for the VegaTV app mode
const Stack = createNativeStackNavigator<VegaTVStackParamList>();

/**
 * A stack navigator for the TV-related screens.
 * This component defines the navigation flow for the live TV channels and the TV player.
 * It's used within the main App.tsx file when the appMode is set to 'vegaTv'.
 */
function VegaTVStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 200,
        freezeOnBlur: true,
        contentStyle: {backgroundColor: 'transparent'},
      }}>
      <Stack.Screen name="LiveTVScreen" component={LiveTVScreen} />
      <Stack.Screen name="TVPlayerScreen" component={TVPlayerScreen} />
    </Stack.Navigator>
  );
}

export default VegaTVStack;
