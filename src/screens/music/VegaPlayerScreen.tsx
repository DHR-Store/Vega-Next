import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

// --- MOCK DEPENDENCIES START ---
const useThemeStore = () => ({
  primary: '#1DB954', // Spotify green
  text: '#FFFFFF',
  secondaryText: '#B3B3B3',
  background: '#000000',
  cardBackground: '#1A1A1A',
});

// Mock for navigation in a single-file component
const useNavigation = () => {
  const [screen, setScreen] = useState('Home');
  const [params, setParams] = useState({});

  const navigate = (screenName, newParams = {}) => {
    setScreen(screenName);
    setParams(newParams);
  };

  const goBack = () => {
    setScreen('Home');
    setParams({});
  };

  return {
    navigate,
    goBack,
    currentScreen: screen,
    params,
  };
};

const useRoute = () => {
  const { params } = useNavigation();
  return { params };
};

// --- MOCK DEPENDENCIES END ---

interface SongInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  image: string;
}

const { width } = Dimensions.get('window');

const MainPlayerScreen = ({ navigation }) => {
  const { params } = useNavigation();
  const song: SongInfo = params.song;
  const { primary, text, secondaryText, background } = useThemeStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  // Animated progress bar
  const progress = useSharedValue(0);
  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  // Simulate playback progress
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        progress.value = withTiming(progress.value + 0.01, { duration: 1000 });
        if (progress.value >= 1) {
          progress.value = 0;
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  if (!song) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <Text style={[styles.placeholderText, { color: text }]}>No song selected.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.playerContainer, { backgroundColor: background }]}>
      <View style={styles.playerHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="chevron-down" size={28} color={text} />
        </TouchableOpacity>
        <Text style={[styles.playerHeaderTitle, { color: text }]}>Playing from Album</Text>
        <TouchableOpacity>
          <Feather name="more-horizontal" size={28} color={text} />
        </TouchableOpacity>
      </View>

      <View style={styles.playerContent}>
        <Animated.Image
          source={{ uri: song.image }}
          style={styles.albumArt}
          entering={FadeInUp.springify()}
        />
        <View style={styles.songInfo}>
          <Text style={[styles.songTitle, { color: text }]} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={[styles.songArtist, { color: secondaryText }]} numberOfLines={1}>
            {song.artist}
          </Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarBase, { backgroundColor: secondaryText + '30' }]}>
            <Animated.View style={[styles.progressBar, { backgroundColor: primary }, animatedProgressStyle]} />
          </View>
          <View style={styles.progressTime}>
            <Text style={{ color: secondaryText }}>0:38</Text>
            <Text style={{ color: secondaryText }}>4:43</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity onPress={() => setIsLiked(!isLiked)}>
            <FontAwesome name={isLiked ? "heart" : "heart-o"} size={28} color={isLiked ? primary : secondaryText} />
          </TouchableOpacity>
          <TouchableOpacity>
            <Feather name="skip-back" size={32} color={text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsPlaying(!isPlaying)} style={styles.playButton}>
            <Feather name={isPlaying ? "pause-circle" : "play-circle"} size={80} color={text} />
          </TouchableOpacity>
          <TouchableOpacity>
            <Feather name="skip-forward" size={32} color={text} />
          </TouchableOpacity>
          <TouchableOpacity>
            <MaterialCommunityIcons name="repeat-once" size={28} color={secondaryText} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomControls}>
          <TouchableOpacity>
            <Feather name="cast" size={24} color={text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.songQueueButton}>
            <MaterialCommunityIcons name="playlist-music" size={24} color={text} />
            <Text style={[styles.queueCount, { color: text }]}>1</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// Local styles for this component
const styles = StyleSheet.create({
    playerContainer: {
      flex: 1,
      padding: 20,
      paddingTop: 50,
      backgroundColor: '#000',
    },
    playerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 30,
    },
    playerHeaderTitle: {
      fontSize: 16,
      fontWeight: '600',
    },
    playerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-evenly',
    },
    albumArt: {
      width: width * 0.8,
      height: width * 0.8,
      borderRadius: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 15,
      elevation: 20,
    },
    songInfo: {
      alignItems: 'center',
      marginTop: 30,
      marginBottom: 20,
    },
    songTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    songArtist: {
      fontSize: 18,
      marginTop: 5,
      textAlign: 'center',
    },
    progressBarContainer: {
      width: '100%',
      paddingHorizontal: 20,
    },
    progressBarBase: {
      height: 4,
      borderRadius: 2,
      width: '100%',
    },
    progressBar: {
      height: '100%',
      borderRadius: 2,
    },
    progressTime: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 5,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      width: '100%',
      paddingHorizontal: 10,
      marginVertical: 30,
    },
    playButton: {
      transform: [{ scale: 1.3 }],
    },
    bottomControls: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      paddingHorizontal: 20,
    },
    songQueueButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    queueCount: {
      fontSize: 16,
      marginLeft: 5,
    },
  });

export default MainPlayerScreen;
