/**
 * Zustand store for reactive downloads state management.
 *
 * This store wraps DownloadManager so any screen/component using
 * useDownloadsStore() re-renders automatically when download state changes.
 *
 * FIX: refreshDownloads() reloads state from MMKV — call this when:
 *   - App comes back to foreground (AppState → 'active')
 *   - After a foreground service finishes a background download
 */
import {create} from 'zustand';
import {downloadManager} from '../services/DownloadManager';
import {DownloadPayload} from '../storage/DownloadsStorage';

interface DownloadsState {
  downloads: Map<string, DownloadPayload>;

  /** Reload state from MMKV storage (call after coming from background) */
  refreshDownloads: () => void;

  /** Add a new download entry */
  addDownload: (id: string, payload: DownloadPayload) => void;

  /** Remove a download entry from state and storage */
  removeDownload: (id: string) => void;

  /** Async remove — also deletes the file from disk */
  removeDownloadAsync: (id: string) => Promise<void>;

  /** Update status of a download */
  updateDownloadStatus: (
    id: string,
    status: 'downloading' | 'paused' | 'downloaded',
  ) => void;

  /** Update any fields of a download payload */
  updateDownload: (id: string, payload: Partial<DownloadPayload>) => void;

  /**
   * Reset all 'downloading' entries to 'paused'.
   * Call on app startup to fix state left by an app kill mid-download.
   */
  resetStaleDownloads: () => void;
}

const useDownloadsStore = create<DownloadsState>((set, get) => ({
  // Initialize from persisted MMKV state on first load
  downloads: downloadManager.getAllDownloads(),

  refreshDownloads: () => {
    downloadManager.refreshFromStorage();
    set({downloads: new Map(downloadManager.getAllDownloads())});
  },

  addDownload: (id: string, payload: DownloadPayload) => {
    downloadManager.addDownload(id, payload);
    set({downloads: new Map(downloadManager.getAllDownloads())});
  },

  removeDownload: (id: string) => {
    downloadManager.removeDownload(id);
    set({downloads: new Map(downloadManager.getAllDownloads())});
  },

  removeDownloadAsync: async (id: string) => {
    await downloadManager.removeDownloadAsync(id);
    set({downloads: new Map(downloadManager.getAllDownloads())});
  },

  updateDownloadStatus: (
    id: string,
    status: 'downloading' | 'paused' | 'downloaded',
  ) => {
    downloadManager.updateDownloadStatus(id, status);
    set({downloads: new Map(downloadManager.getAllDownloads())});
  },

  updateDownload: (id: string, payload: Partial<DownloadPayload>) => {
    downloadManager.updateDownload(id, payload);
    set({downloads: new Map(downloadManager.getAllDownloads())});
  },

  resetStaleDownloads: () => {
    downloadManager.resetStaleDownloads();
    set({downloads: new Map(downloadManager.getAllDownloads())});
  },
}));

export default useDownloadsStore;

