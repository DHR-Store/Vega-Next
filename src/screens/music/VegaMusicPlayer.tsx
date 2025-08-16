import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import useThemeStore from '../../lib/zustand/themeStore'; // Correct path to your Zustand store
import useMusicStore from '../../lib/zustand/musicStore'; // Import the new music store

// Get screen dimensions for responsive design
const {width} = Dimensions.get('window');

// Mock SVG icons as React Native components
const ChevronDown = ({color}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" /> {' '}
  </svg>
);

const MoreVertical = ({color}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" /> {' '}
  </svg>
);

const Heart = ({color}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
       {' '}
    <path d="M19 14c1.49-1.46 3-3.23 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.27 1.5 4.04 3 5.5l7 7Z" />
     {' '}
  </svg>
);

const Shuffle = ({color}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
        <path d="M16 3h5v5" />
        <path d="M4 20L21 3" />
        <path d="M21 16v5h-5" />
        <path d="M15 15l6 6" />
        <path d="M4 4l5 5" /> {' '}
  </svg>
);

const SkipBack = ({color}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
        <polygon points="19 20 9 12 19 4 19 20" />
        <line x1="5" x2="5" y1="19" y2="5" /> {' '}
  </svg>
);

const SkipForward = ({color}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
        <polygon points="5 4 15 12 5 20 5 4" />
        <line x1="19" x2="19" y1="5" y2="19" /> {' '}
  </svg>
);

const Repeat = ({color}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
        <path d="M17 1v4H3" />
        <path d="m3 20v-4h18" />
        <path d="m21 16-3 3 3 3" />
        <path d="m3 5 3-3-3-3" /> {' '}
  </svg>
);

const Play = ({color}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" /> {' '}
  </svg>
);

const Pause = ({color}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" /> {' '}
  </svg>
);

// The search screen component
export const VegaMusicSearchScreen = () => {
  const {primary} = useThemeStore();
  const navigation = useNavigation();

  return (
    <View style={styles.searchContainer}>
           {' '}
      <Text style={[styles.searchText, {color: primary}]}>
                Music Search Screen      {' '}
      </Text>
           {' '}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.searchButton, {backgroundColor: primary}]}>
                <Text style={styles.searchButtonText}>Go Back to Player</Text> 
           {' '}
      </TouchableOpacity>
         {' '}
    </View>
  );
};

// The main music player screen
export const VegaMusicPlayerScreen = () => {
  const {primary} = useThemeStore();
  const navigation = useNavigation(); // Get the current song and playback state from the Zustand store

  const {currentSong, isPlaying, play, pause} = useMusicStore();
  const [currentProgress, setCurrentProgress] = useState(0); // Function to handle play/pause

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const formatTime = seconds => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  useEffect(() => {
    let interval; // Update progress only if a song is playing
    if (isPlaying && currentSong) {
      interval = setInterval(() => {
        setCurrentProgress(prev =>
          prev < currentSong.duration ? prev + 1 : prev,
        );
      }, 1000);
    } else {
      // If song is paused or null, clear the interval
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentSong]); // Depend on both `isPlaying` and `currentSong`
  // If no song is selected, display a message

  if (!currentSong) {
    return (
      <View style={styles.playerContainer}>
               {' '}
        <View style={styles.noSongContainer}>
                   {' '}
          <Text style={styles.noSongText}>
            No song selected. Go back and choose one!
          </Text>
                 {' '}
        </View>
             {' '}
      </View>
    );
  }

  return (
    <View style={styles.playerContainer}>
            {/* Top Controls */}     {' '}
      <View style={styles.topControls}>
               {' '}
        <TouchableOpacity style={styles.iconButton}>
                    <ChevronDown color="#B3B3B3" />       {' '}
        </TouchableOpacity>
               {' '}
        <View style={styles.albumInfo}>
                    <Text style={styles.playingFromText}>NOW PLAYING</Text>     
              <Text style={styles.albumTitleText}>{currentSong.name}</Text>     
           {' '}
        </View>
               {' '}
        {/* Corrected navigation call to use the screen name 'Search' */}       {' '}
        <TouchableOpacity
          onPress={() => navigation.navigate('Search')}
          style={styles.iconButton}>
                    <MoreVertical color="#B3B3B3" />       {' '}
        </TouchableOpacity>
             {' '}
      </View>
            {/* Album Art */}     {' '}
      <View style={styles.albumArtContainer}>
               {' '}
        <Image source={{uri: currentSong.image}} style={styles.albumArt} />     {' '}
      </View>
            {/* Song Info & Controls */}     {' '}
      <View style={styles.bottomSection}>
               {' '}
        <View style={styles.songInfoContainer}>
                   {' '}
          <View>
                       {' '}
            <Text style={styles.songTitleText}>{currentSong.name}</Text>       
                <Text style={styles.songArtistText}>{currentSong.artist}</Text> 
                   {' '}
          </View>
                   {' '}
          <TouchableOpacity style={styles.iconButton}>
                        <Heart color={primary} />         {' '}
          </TouchableOpacity>
                 {' '}
        </View>
                {/* Progress Bar */}       {' '}
        <View style={styles.progressBarContainer}>
                   {' '}
          <View style={styles.progressBarBackground}>
                       {' '}
            <View
              style={[
                styles.progressBar,
                {
                  width: `${(currentProgress / currentSong.duration) * 100}%`,
                  backgroundColor: primary,
                },
              ]}
            />
                     {' '}
          </View>
                   {' '}
          <View style={styles.timeStamps}>
                       {' '}
            <Text style={styles.timeStampText}>
              {formatTime(currentProgress)}
            </Text>
                       {' '}
            <Text style={styles.timeStampText}>
              {formatTime(currentSong.duration)}
            </Text>
                     {' '}
          </View>
                 {' '}
        </View>
                {/* Playback Controls */}       {' '}
        <View style={styles.playbackControls}>
                   {' '}
          <TouchableOpacity style={styles.iconButton}>
                        <Shuffle color="#B3B3B3" />         {' '}
          </TouchableOpacity>
                   {' '}
          <TouchableOpacity style={styles.iconButton}>
                        <SkipBack color="#B3B3B3" />         {' '}
          </TouchableOpacity>
                   {' '}
          <TouchableOpacity
            onPress={handlePlayPause}
            style={[styles.playButton, {backgroundColor: primary}]}>
                       {' '}
            {isPlaying ? <Pause color="white" /> : <Play color="white" />}     
               {' '}
          </TouchableOpacity>
                   {' '}
          <TouchableOpacity style={styles.iconButton}>
                        <SkipForward color="#B3B3B3" />         {' '}
          </TouchableOpacity>
                   {' '}
          <TouchableOpacity style={styles.iconButton}>
                        <Repeat color="#B3B3B3" />         {' '}
          </TouchableOpacity>
                 {' '}
        </View>
             {' '}
      </View>
         {' '}
    </View>
  );
};

// Stylesheet for the React Native components
const styles = StyleSheet.create({
  playerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 24,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  albumInfo: {
    alignItems: 'center',
  },
  playingFromText: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '500',
  },
  albumTitleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconButton: {
    padding: 8,
  },
  albumArtContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumArt: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  bottomSection: {
    flex: 0.5,
    justifyContent: 'flex-end',
  },
  songInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  songTitleText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  songArtistText: {
    color: '#B3B3B3',
    fontSize: 16,
  },
  progressBarContainer: {
    marginTop: 24,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  timeStamps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeStampText: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 24,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  searchContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  searchText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  searchButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  noSongContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noSongText: {
    color: '#B3B3B3',
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
export default VegaMusicPlayerScreen;
