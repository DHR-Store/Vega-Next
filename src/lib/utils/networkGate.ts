// lib/utils/networkGate.ts
//
// Two small helpers to keep app startup fast and quiet on a slow/low network:
//
//  - runThrottledNetworkTask: a non-essential network task (ping, update
//    check, etc.) only actually runs once per `minIntervalMs`. Re-opening the
//    app on a bad connection won't re-trigger it over and over.
//  - isNetworkFast: a cheap reachability probe with a hard timeout, so a
//    task can bail out immediately on a low network instead of hanging on a
//    slow fetch.

import {cacheStorageService} from '../storage/CacheStorage';

/**
 * Runs `task` at most once per `minIntervalMs`, persisted across app
 * restarts via CacheStorage. The "last attempted" timestamp is written
 * BEFORE the task runs, so a slow/failing network call can't cause a burst
 * of retries if the user force-closes and reopens the app repeatedly.
 */
export async function runThrottledNetworkTask(
  taskKey: string,
  minIntervalMs: number,
  task: () => Promise<void> | void,
): Promise<void> {
  const storageKey = `net_gate:${taskKey}`;
  const lastRun = cacheStorageService.getObject<number>(storageKey) ?? 0;
  const now = Date.now();

  if (now - lastRun < minIntervalMs) {
    return; // Ran recently enough — skip, no network touched.
  }

  cacheStorageService.setObject<number>(storageKey, now);

  try {
    await task();
  } catch (err) {
    console.warn(`runThrottledNetworkTask: "${taskKey}" failed`, err);
  }
}

/**
 * Quick reachability probe with a hard timeout. Returns false fast on a
 * low/flaky/offline connection instead of letting callers hang on a slow
 * fetch for many seconds.
 */
export async function isNetworkFast(timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch('https://www.gstatic.com/generate_204', {
      method: 'GET',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}