// components/CachedImage.tsx
//
// Drop-in replacement for RN's <Image> that persists remote images to disk
// the first time they're loaded and reuses that local file forever after —
// including across app restarts. On a slow/low network this means:
//   - the same icon/photo is only ever downloaded ONCE, not on every mount
//   - if the download fails (no/slow network), it fails fast and does NOT
//     keep retrying on every re-render, so the UI stays smooth
//   - once cached, the image renders instantly from disk with zero network
//
// Usage:
//   <CachedImage uri={photoUri} cacheKey={`avatar_${userId}`} style={{...}} />

import React, {useEffect, useRef, useState} from 'react';
import {Image, ImageProps, ImageStyle, StyleProp, View} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {cacheStorageService} from '../lib/storage/CacheStorage';

interface CachedImageProps extends Omit<ImageProps, 'source' | 'style'> {
  uri: string | undefined | null;
  /** Stable key identifying this image (e.g. a user id). Falls back to `uri`. */
  cacheKey?: string;
  /** Rendered while the (one-time) download is in flight or if it fails. */
  fallback?: React.ReactNode;
  style?: StyleProp<ImageStyle>;
}

const CACHE_DIR = `${RNFS.CachesDirectoryPath}/vega_image_cache`;

// De-dupes concurrent downloads of the same key (e.g. same avatar rendered
// in two places at once) so we never fire two network requests for one image.
const inFlightDownloads = new Map<string, Promise<string | null>>();
let cacheDirReady: Promise<void> | null = null;

function keyToFileName(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9]/g, '_').slice(-120);
  return `${safe || 'img'}.cache`;
}

function ensureCacheDir(): Promise<void> {
  if (!cacheDirReady) {
    cacheDirReady = (async () => {
      try {
        const exists = await RNFS.exists(CACHE_DIR);
        if (!exists) await RNFS.mkdir(CACHE_DIR);
      } catch (err) {
        console.warn('CachedImage: failed to create cache dir', err);
      }
    })();
  }
  return cacheDirReady;
}

/**
 * Resolves to a local file path for `uri`, downloading it at most once.
 * Subsequent calls (this session or a future app launch) resolve instantly
 * from CacheStorage + disk, without touching the network at all.
 */
async function getOrDownload(
  uri: string,
  cacheKey: string,
): Promise<string | null> {
  const storageKey = `img_cache:${cacheKey}`;
  const cachedPath = cacheStorageService.getString(storageKey);

  if (cachedPath) {
    try {
      if (await RNFS.exists(cachedPath)) {
        return cachedPath;
      }
    } catch {
      // fall through to re-download
    }
    // The OS wiped the caches dir (or the file was removed) — the stale
    // pointer is useless, drop it and re-download exactly once.
    cacheStorageService.delete(storageKey);
  }

  const existingDownload = inFlightDownloads.get(storageKey);
  if (existingDownload) return existingDownload;

  const downloadPromise = (async (): Promise<string | null> => {
    try {
      await ensureCacheDir();
      const destPath = `${CACHE_DIR}/${keyToFileName(cacheKey)}`;
      const {promise} = RNFS.downloadFile({
        fromUrl: uri,
        toFile: destPath,
      });
      const result = await promise;

      if (result.statusCode >= 200 && result.statusCode < 300) {
        cacheStorageService.setString(storageKey, destPath);
        return destPath;
      }
      return null;
    } catch (err) {
      // No/slow network, timeout, etc. — fail quietly. We deliberately do
      // NOT retry here; the caller simply shows the fallback until the next
      // time this component mounts fresh (e.g. next app open).
      console.warn('CachedImage: download failed for', cacheKey, err);
      return null;
    } finally {
      inFlightDownloads.delete(storageKey);
    }
  })();

  inFlightDownloads.set(storageKey, downloadPromise);
  return downloadPromise;
}

export default function CachedImage({
  uri,
  cacheKey,
  fallback,
  style,
  ...rest
}: CachedImageProps) {
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setLocalPath(null);
    setFailed(false);
    if (!uri) return;

    const key = cacheKey || uri;
    getOrDownload(uri, key).then(path => {
      if (!mountedRef.current) return;
      if (path) setLocalPath(path);
      else setFailed(true);
    });
  }, [uri, cacheKey]);

  if (!uri || failed || !localPath) {
    return fallback ? <>{fallback}</> : <View style={style} />;
  }

  return (
    <Image source={{uri: `file://${localPath}`}} style={style} {...rest} />
  );
}
