import {downloadFolder} from '../constants';
import {downloadsStorage} from '../storage';
import {DownloadPayload} from '../storage/DownloadsStorage';
import * as RNFS from '@dr.pogodin/react-native-fs';

export class DownloadManager {
  private static instance: DownloadManager;

  private downloads: Map<string, DownloadPayload> =
    downloadsStorage.getDownloads();

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  /**
   * FIX: Reload the in-memory downloads map from persistent MMKV storage.
   *
   * Why needed: The in-memory Map is set once at construction. If downloads
   * are updated by a background/foreground service while the app was closed,
   * the in-memory state becomes stale. Call this when the app comes back to
   * the foreground (AppState 'active') to get the latest persisted state.
   */
  refreshFromStorage(): void {
    this.downloads = downloadsStorage.getDownloads();
  }

  /**
   * FIX: Reset any downloads stuck in 'downloading' status back to 'paused'.
   *
   * Why needed: When the app is killed from the task manager while a download
   * is active, the download status in MMKV stays as 'downloading' forever
   * (the JS thread died mid-download). On next app launch, those downloads
   * would falsely show as "in progress" but nothing is actually downloading.
   *
   * This method must be called once on app startup (in App.tsx useEffect).
   * After calling this, the user can see which downloads are paused/incomplete
   * and can manually resume them.
   */
  resetStaleDownloads(): void {
    let hasChanges = false;
    this.downloads.forEach((download, id) => {
      if (download.status === 'downloading') {
        download.status = 'paused';
        this.downloads.set(id, download);
        hasChanges = true;
      }
    });
    if (hasChanges) {
      downloadsStorage.saveDownloads(this.downloads);
    }
  }

  updateDownloadStatus(
    id: string,
    status: 'downloading' | 'paused' | 'downloaded',
  ): void {
    const download = this.downloads.get(id);
    if (download) {
      download.status = status;
      this.downloads.set(id, download);
      downloadsStorage.saveDownloads(this.downloads);
    }
  }

  updateDownload(id: string, payload: Partial<DownloadPayload>): void {
    const download = this.downloads.get(id);
    if (download) {
      Object.assign(download, payload);
      this.downloads.set(id, download);
      downloadsStorage.saveDownloads(this.downloads);
    }
  }

  addDownload(id: string, payload: DownloadPayload): void {
    this.downloads.set(id, payload);
    downloadsStorage.saveDownloads(this.downloads);
  }

  async removeDownloadAsync(id: string): Promise<void> {
    const download = this.downloads.get(id);
    if (!download) {
      return;
    }
    try {
      await RNFS.unlink(this.generateDownloadLocation(download));
    } catch (error) {
      console.error('Failed to remove download:', error);
      console.log('path:', this.generateDownloadLocation(download));
    }
    const downloadExists = await RNFS.exists(
      this.generateDownloadLocation(download),
    );
    console.log('Download exists after removal attempt:', downloadExists);

    if (!downloadExists) {
      this.downloads.delete(id);
      downloadsStorage.saveDownloads(this.downloads);
    }
  }

  removeDownload(id: string): void {
    this.downloads.delete(id);
    downloadsStorage.saveDownloads(this.downloads);
  }

  getDownload(id: string): DownloadPayload | undefined {
    return this.downloads.get(id);
  }

  isDownloaded(id: string): boolean {
    return (
      this.downloads.has(id) && this.downloads.get(id)?.status === 'downloaded'
    );
  }

  getAllDownloads(): Map<string, DownloadPayload> {
    return this.downloads;
  }

  generateDownloadId({
    folderName,
    fileName,
  }: {
    folderName: string;
    fileName: string;
  }): string {
    return `${folderName}${fileName}`;
  }

  generateDownloadLocation(downloadPayload: DownloadPayload): string {
    return `${downloadFolder}/${downloadPayload.provider}/${downloadPayload.folderName}/${downloadPayload.fileName}.${downloadPayload.fileType}`;
  }
}

export const downloadManager = DownloadManager.getInstance();

