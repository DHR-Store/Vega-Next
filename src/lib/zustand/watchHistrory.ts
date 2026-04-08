import {create} from 'zustand';
import {WatchHistoryItem, watchHistoryStorage} from '../storage';
import {cloudSyncService} from '../services/CloudSyncService';
import {storageService} from '../storage/StorageService';

export interface History {
  history: WatchHistoryItem[];
  addItem: (item: WatchHistoryItem) => void;
  updatePlaybackInfo: (link: string, playbackInfo: Partial<WatchHistoryItem>) => void;
  clearHistory: () => void;
  updateItemWithInfo: (link: string, infoData: any) => void;
  removeItem: (item: WatchHistoryItem) => void;
  rehydrate: () => void;
}

const convertStorageToZustand = (items: any[]): WatchHistoryItem[] =>
  items.map(item => ({
    ...item,
    lastPlayed: item.timestamp,
    currentTime: item.progress ?? 0,
  }));

function syncHistory(): void {
  const userId = storageService.getCurrentUserId();
  if (userId) {
    cloudSyncService
      .pushCategory(userId, 'watchHistory')
      .catch(e => console.warn('[watchHistoryStore] cloud push failed:', e));
  }
}

const useWatchHistoryStore = create<History>(set => ({
  history: convertStorageToZustand(watchHistoryStorage.getWatchHistory()),

  rehydrate: () => {
    set({history: convertStorageToZustand(watchHistoryStorage.getWatchHistory())});
  },

  addItem: item => {
    try {
      const storageItem: WatchHistoryItem = {
        id: item.link || item.title,
        title: item.title,
        poster: item.poster,
        provider: item.provider,
        link: item.link,
        timestamp: Date.now(),
        duration: item.duration,
        progress: item.currentTime,
        episodeTitle: item.episodeTitle,
        cachedInfoData: item.cachedInfoData,
      };
      watchHistoryStorage.addToWatchHistory(storageItem);
      set({history: convertStorageToZustand(watchHistoryStorage.getWatchHistory())});
      syncHistory();
    } catch (error) {
      console.error('❌ [watchHistoryStore] addItem error:', error);
    }
  },

  updatePlaybackInfo: (link, playbackInfo) => {
    try {
      const history = watchHistoryStorage.getWatchHistory();
      const existingItem = history.find(item => item.link === link);
      if (existingItem) {
        watchHistoryStorage.addToWatchHistory({
          ...existingItem,
          progress: playbackInfo.currentTime,
          duration: playbackInfo.duration ?? existingItem.duration,
          timestamp: Date.now(),
        });
      }
      set({history: convertStorageToZustand(watchHistoryStorage.getWatchHistory())});
      syncHistory();
    } catch (error) {
      console.error('❌ [watchHistoryStore] updatePlaybackInfo error:', error);
    }
  },

  removeItem: item => {
    watchHistoryStorage.removeFromWatchHistory(item.link);
    set({history: convertStorageToZustand(watchHistoryStorage.getWatchHistory())});
    syncHistory();
  },

  clearHistory: () => {
    watchHistoryStorage.clearWatchHistory();
    set({history: []});
    syncHistory();
  },

  updateItemWithInfo: (link, infoData) => {
    try {
      const history = watchHistoryStorage.getWatchHistory();
      const existingItem = history.find(item => item.link === link);
      if (existingItem) {
        watchHistoryStorage.addToWatchHistory({
          ...existingItem,
          cachedInfoData: infoData,
        });
      }
      set({history: convertStorageToZustand(watchHistoryStorage.getWatchHistory())});
      syncHistory();
    } catch (error) {
      console.error('❌ [watchHistoryStore] updateItemWithInfo error:', error);
    }
  },
}));

export default useWatchHistoryStore;