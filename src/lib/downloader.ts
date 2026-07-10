import * as RNFS from '@dr.pogodin/react-native-fs';
// 👈 FIX: Import the legacy API directly to fix the SDK 54+ deprecation crash
import * as FileSystem from 'expo-file-system/legacy'; 
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { downloadFolder } from './constants';
import requestStoragePermission from './file/getStoragePermission';
import { hlsDownloader2, cancelHlsDownload } from './hlsDownloader2';
import { ifExists } from './file/ifExists';

interface DownloadTask {
  jobId: number | string;
  fileName: string;
  url: string;
  path: string;
  headers?: any;
  downloadedBytes: number;
  totalBytes: number;
  paused: boolean;
  canceled?: boolean;
  type: 'normal' | 'hls';
  resumeData?: string; // 👈 Stores exact byte state for resuming
}

const activeDownloads = new Map<number | string, DownloadTask>();
const activeResumables = new Map<string, FileSystem.DownloadResumable>(); 
let nextHlsId = 1000;

// 🧠 Persist Download State
async function saveTaskState(task: DownloadTask) {
  await AsyncStorage.setItem(`download_${task.fileName}`, JSON.stringify(task));
}

async function removeTaskState(fileName: string) {
  await AsyncStorage.removeItem(`download_${fileName}`);
}

// 🧩 Load previous state (for future resume support)
export async function loadPreviousDownloads() {
  const keys = await AsyncStorage.getAllKeys();
  const downloads = keys.filter(k => k.startsWith('download_'));
  for (const key of downloads) {
    const data = await AsyncStorage.getItem(key);
    if (data) {
      const task: DownloadTask = JSON.parse(data);
      if (!task.canceled && !task.paused) {
        showDownloadNotification(task);
      }
    }
  }
}

// 📱 Notification setup
async function initDownloadChannel() {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: 'download',
      name: 'Downloads',
      importance: AndroidImportance.HIGH,
    });
  }
}

// 🎯 Notification with actions
async function showDownloadNotification(task: DownloadTask) {
  const progress = task.totalBytes ? (task.downloadedBytes / task.totalBytes) * 100 : 0;

  await notifee.displayNotification({
    id: task.fileName,
    title: task.fileName,
    body: `${Math.floor(progress)}% - ${formatBytes(task.downloadedBytes)} / ${formatBytes(task.totalBytes)}`,
    android: {
      channelId: 'download',
      smallIcon: 'ic_notification',
      color: task.paused ? '#FFA000' : '#FF6347',
      progress: { max: 100, current: Math.floor(progress), indeterminate: false },
      actions: [
        { title: task.paused ? 'Resume' : 'Pause', pressAction: { id: `toggle_${task.fileName}` } },
        { title: 'Cancel', pressAction: { id: `cancel_${task.fileName}` } },
      ],
      onlyAlertOnce: true,
      asForegroundService: true, 
    },
  });
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 🧠 Notification button handler
export async function handleDownloadAction(type: EventType, detail: any) {
  if (type === EventType.ACTION_PRESS) {
    if (!detail.pressAction) return;
    const actionId = detail.pressAction.id;
    if (actionId.startsWith('toggle_')) {
      const fileName = actionId.replace('toggle_', '');
      await togglePauseResume(fileName);
    } else if (actionId.startsWith('cancel_')) {
      const fileName = actionId.replace('cancel_', '');
      await cancelDownload(fileName);
    }
  }
}

notifee.onForegroundEvent(async ({ type, detail }) => {
  await handleDownloadAction(type, detail);
});

// 🟡 Pause / Resume Logic
async function togglePauseResume(fileName: string) {
  let task = Array.from(activeDownloads.values()).find(d => d.fileName === fileName);

  if (!task) {
    const savedState = await AsyncStorage.getItem(`download_${fileName}`);
    if (savedState) {
      task = JSON.parse(savedState);
      activeDownloads.set(task.jobId, task); 
    }
  }

  if (!task) return;

  if (task.type === 'hls') {
    if (task.paused) {
      hlsDownloader2({
        videoUrl: task.url,
        path: task.path,
        fileName: task.fileName,
        setDownloadActive: () => {},
        setAlreadyDownloaded: () => {},
        setDownloadId: () => {},
        headers: task.headers,
      });
      task.paused = false;
    } else {
      cancelHlsDownload(task.jobId);
      task.paused = true;
    }
  } else {
    // Normal Downloads (YouTube-like logic via Expo)
    task.paused = !task.paused;
    let resumable = activeResumables.get(task.fileName);

    if (!resumable) {
      // FIX: Ensure correct file:// URI format
      const fileUri = task.path.startsWith('file://') ? task.path : `file://${task.path}`;
      
      resumable = FileSystem.createDownloadResumable(
        task.url,
        fileUri,
        { headers: task.headers || {} },
        (res) => handleProgress(task!, res),
        task.resumeData
      );
      activeResumables.set(task.fileName, resumable);
    }

    if (task.paused) {
      try {
        const pauseResult = await resumable.pauseAsync();
        task.resumeData = pauseResult.resumeData; // Native byte memory logic saved
      } catch (e) {
        console.error('Pause Error:', e);
      }
    } else {
      resumable.resumeAsync()
        .then(res => handleComplete(task!, res))
        .catch(err => handleError(task!, err));
    }
  }

  await saveTaskState(task);
  showDownloadNotification(task);
}

// ❌ Cancel Logic
async function cancelDownload(fileName: string) {
  let task = Array.from(activeDownloads.values()).find(d => d.fileName === fileName);

  if (!task) {
    const savedState = await AsyncStorage.getItem(`download_${fileName}`);
    if (savedState) task = JSON.parse(savedState);
  }

  if (!task) return;

  if (task.type === 'hls') {
    cancelHlsDownload(task.jobId);
  } else {
    let resumable = activeResumables.get(task.fileName);
    if (resumable && !task.paused) {
      try { await resumable.pauseAsync(); } catch (e) {}
    }
    activeResumables.delete(task.fileName);
  }

  task.canceled = true;
  await saveTaskState(task);

  activeDownloads.delete(task.jobId);
  await notifee.cancelNotification(fileName);
  await notifee.stopForegroundService();

  if (task.path && await RNFS.exists(task.path)) {
    try {
      await RNFS.unlink(task.path);
    } catch {}
  }

  await removeTaskState(fileName); 
}

// 🚀 Helper: Progress Handler
async function handleProgress(task: DownloadTask, res: FileSystem.DownloadProgressData) {
  task.downloadedBytes = res.totalBytesWritten;
  task.totalBytes = res.totalBytesExpectedToWrite;
  await saveTaskState(task);
  showDownloadNotification(task);
}

// 🚀 Helper: Completion Handler
async function handleComplete(task: DownloadTask, res: FileSystem.FileSystemDownloadResult | undefined) {
  if (!res) return; 
  
  activeDownloads.delete(task.jobId);
  activeResumables.delete(task.fileName);
  await removeTaskState(task.fileName);

  notifee.displayNotification({
    id: `complete_${task.fileName}`,
    title: 'Download Complete',
    body: task.fileName,
    android: { channelId: 'download', smallIcon: 'ic_notification', color: '#00C853' },
  });
}

// 🚀 Helper: Error Handler
async function handleError(task: DownloadTask, err: any) {
  if (task.canceled) return;
  activeDownloads.delete(task.jobId);
  activeResumables.delete(task.fileName);
  await saveTaskState(task);
  
  Alert.alert('Download failed', err.message || 'Failed to download');
  notifee.displayNotification({
    id: `failed_${task.fileName}`,
    title: 'Download Failed',
    body: task.fileName,
    android: { channelId: 'download', smallIcon: 'ic_notification', color: '#D50000' },
  });
}

// 🚀 Download manager entry point
export async function downloadManager({
  url,
  fileName,
  fileType,
  title,
  setDownloadActive,
  setAlreadyDownloaded,
  setDownloadId,
  headers,
}: {
  url: string;
  fileName: string;
  fileType: string;
  title: string;
  setDownloadActive: (val: boolean) => void;
  setAlreadyDownloaded: (val: boolean) => void;
  setDownloadId: (val: number) => void;
  headers?: any;
}) {
  await requestStoragePermission();
  await initDownloadChannel();

  const oldState = await AsyncStorage.getItem(`download_${fileName}`);
  if (oldState) {
    const prev: DownloadTask = JSON.parse(oldState);
    if (prev.canceled === true) await AsyncStorage.removeItem(`download_${fileName}`);
  }

  if (await ifExists(fileName)) {
    setAlreadyDownloaded(true);
    setDownloadActive(false);
    return;
  }

  // 👇 Start loading here
  setDownloadActive(true);
  
  if (!(await RNFS.exists(downloadFolder))) {
    await RNFS.mkdir(downloadFolder);
  }

  const downloadPath = `${downloadFolder}/${fileName}.${fileType}`;

  if (fileType === 'm3u8') {
    const hlsId = nextHlsId++;
    hlsDownloader2({
      videoUrl: url,
      path: downloadPath,
      fileName,
      title,
      setDownloadActive,
      setAlreadyDownloaded,
      setDownloadId,
      headers,
    });
    const task: DownloadTask = { jobId: hlsId, fileName, url, path: downloadPath, downloadedBytes: 0, totalBytes: 0, paused: false, type: 'hls' };
    activeDownloads.set(hlsId, task);
    await saveTaskState(task);
    return hlsId;
  }

  const task: DownloadTask = {
    jobId: Date.now(), 
    fileName,
    url,
    path: downloadPath,
    downloadedBytes: 0,
    totalBytes: 0,
    paused: false,
    canceled: false,
    type: 'normal',
    headers,
  };
  
  setDownloadId(task.jobId as number);
  activeDownloads.set(task.jobId, task);

  // FIX: Properly format string so FileSystem API doesn't crash on Android
  const fileUri = downloadPath.startsWith('file://') ? downloadPath : `file://${downloadPath}`;

  const resumable = FileSystem.createDownloadResumable(
    url,
    fileUri,
    { headers: headers || {} },
    (res) => handleProgress(task, res)
  );

  activeResumables.set(fileName, resumable);
  await saveTaskState(task);
  showDownloadNotification(task);

  // Trigger download asynchronously
  resumable.downloadAsync()
    .then(res => handleComplete(task, res))
    .catch(err => {
      setDownloadActive(false); // Stop loading indicator if it fails instantly
      handleError(task, err);
    });

  return task.jobId;
}