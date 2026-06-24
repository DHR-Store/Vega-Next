// components/AppLock.tsx
import React, {useState, useEffect} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {MaterialIcons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';

// USE YOUR LOCAL WRAPPER
import {MMKV} from '../lib/Mmkv';

interface AppLockProps {
  onUnlock: () => void;
}

const AppLock = ({onUnlock}: AppLockProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const savedPin = MMKV.getString('appLockPin');
  const useBiometric = MMKV.getBool('biometricEnabled');

  useEffect(() => {
    if (useBiometric) {
      handleBiometric();
    }
  }, []);

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === savedPin) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    }
  }, [pin]);

  const handleBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock App',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) {
        onUnlock();
      }
    }
  };

  const handlePress = (num: string) => {
    if (pin.length < 4) {
      setPin(pin + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <SafeAreaView className="flex-1 bg-black absolute top-0 bottom-0 left-0 right-0 z-50 justify-center items-center">
      <MaterialIcons
        name="lock-outline"
        size={48}
        color="white"
        className="mb-8"
      />
      <Text className="text-white text-xl mb-6">Enter PIN to Unlock</Text>

      {/* PIN Dots */}
      <View className="flex-row gap-4 mb-12">
        {[1, 2, 3, 4].map((_, i) => (
          <View
            key={i}
            className={`w-4 h-4 rounded-full border-2 ${
              error
                ? 'border-red-500 bg-red-500'
                : i < pin.length
                  ? 'bg-white border-white'
                  : 'border-gray-500'
            }`}
          />
        ))}
      </View>

      {/* Keypad */}
      <View className="w-64 flex-row flex-wrap justify-between">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <TouchableOpacity
            key={num}
            onPress={() => handlePress(num)}
            className="w-20 h-20 justify-center items-center rounded-full bg-[#1A1A1A] mb-4">
            <Text className="text-white text-3xl">{num}</Text>
          </TouchableOpacity>
        ))}
        {useBiometric ? (
          <TouchableOpacity
            onPress={handleBiometric}
            className="w-20 h-20 justify-center items-center rounded-full mb-4">
            <MaterialIcons name="fingerprint" size={36} color="white" />
          </TouchableOpacity>
        ) : (
          <View className="w-20 h-20" />
        )}
        <TouchableOpacity
          onPress={() => handlePress('0')}
          className="w-20 h-20 justify-center items-center rounded-full bg-[#1A1A1A] mb-4">
          <Text className="text-white text-3xl">0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDelete}
          className="w-20 h-20 justify-center items-center rounded-full mb-4">
          <MaterialIcons name="backspace" size={28} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AppLock;
