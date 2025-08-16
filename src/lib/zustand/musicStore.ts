import { create } from 'zustand';

// Define the interface for a single song object
export interface Song {
  id: string;
  name: string;
  artist: string;
  image: string;
  duration: number;
}

// Define the state and actions for the music store
interface MusicState {
  currentSong: Song | null;
  isPlaying: boolean;
  
  // Actions
  play: () => void;
  pause: () => void;
  playSong: (song: Song) => void;
  clearSong: () => void;
}

// Create the Zustand store
const useMusicStore = create<MusicState>((set) => ({
  currentSong: null,
  isPlaying: false,

  // Action to set playing state to true
  play: () => set({ isPlaying: true }),

  // Action to set playing state to false
  pause: () => set({ isPlaying: false }),

  // Action to set a new song and start playing it
  playSong: (song: Song) => set({
    currentSong: song,
    isPlaying: true,
  }),

  // Action to clear the current song
  clearSong: () => set({
    currentSong: null,
    isPlaying: false,
  }),
}));

export default useMusicStore;