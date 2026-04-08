import {create} from 'zustand';
import {watchListStorage, WatchListItem} from '../storage';
import {cloudSyncService} from '../services/CloudSyncService';
import {storageService} from '../storage/StorageService';

export type WatchList = WatchListItem;

interface WatchListStore {
  watchList: WatchList[];
  removeItem: (link: string) => void;
  addToWatchList: (item: WatchList) => void;
  addItem: (item: WatchList) => void;
  rehydrate: () => void;
}

function syncWatchList(): void {
  const userId = storageService.getCurrentUserId();
  if (userId) {
    cloudSyncService
      .pushCategory(userId, 'watchList')
      .catch(e => console.warn('[watchListStore] cloud push failed:', e));
  }
}

const useWatchListStore = create<WatchListStore>()((set, get) => ({
  watchList: watchListStorage.getWatchList() ?? [],

  rehydrate: () => {
    set({watchList: watchListStorage.getWatchList() ?? []});
  },

  removeItem: (link: string) => {
    const updated = watchListStorage.removeFromWatchList(link);
    set({watchList: [...updated]});
    syncWatchList();
  },

  addToWatchList: (item: WatchList) => {
    const current = watchListStorage.getWatchList() ?? [];
    const filtered = current.filter(i => i.link !== item.link);
    const newList = [item, ...filtered];
    watchListStorage.addToWatchList(item);
    set({watchList: [...newList]});
    syncWatchList();
  },

  addItem: (item: WatchList) => get().addToWatchList(item),
}));

export default useWatchListStore;