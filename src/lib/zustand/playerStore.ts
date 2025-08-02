// src/lib/zustand/playerStore.ts
// This file defines the Zustand store for managing the music player's state.

import create from 'zustand';

// Define the data types for the song information
interface SongInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  image: string;
  duration: number;
}

// Define the state and actions for the player store.
interface PlayerState {
  currentSong: SongInfo | null;
  isPlaying: boolean;
  isMiniPlayerVisible: boolean;
  progress: number;
  elapsedTime: number;
  playSong: (song: SongInfo) => void;
  togglePlayPause: () => void;
  toggleMiniPlayer: (visible: boolean) => void;
  updatePlaybackProgress: (elapsedTime: number) => void;
}

const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  isMiniPlayerVisible: false,
  progress: 0,
  elapsedTime: 0,
  // Action to start playing a new song.
  playSong: (song) => set({ currentSong: song, isPlaying: true, isMiniPlayerVisible: true, elapsedTime: 0, progress: 0 }),
  // Action to toggle play/pause state.
  togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),
  // Action to show or hide the mini-player.
  toggleMiniPlayer: (visible) => set({ isMiniPlayerVisible: visible }),
  // Action to update the playback progress.
  updatePlaybackProgress: (elapsedTime) => {
    const { currentSong } = get();
    if (currentSong) {
      set({
        elapsedTime,
        progress: elapsedTime / currentSong.duration,
      });
    }
  },
}));

export default usePlayerStore;