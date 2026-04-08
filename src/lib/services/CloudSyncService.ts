/**
 * CloudSyncService.ts
 * Cloud backup / restore using Supabase (pure-JS, no native modules).
 * Syncs: watchHistory, watchList, settings.
 * Does NOT sync providers — users install those manually.
 */

import 'react-native-url-polyfill/auto';

import {createClient, SupabaseClient} from '@supabase/supabase-js';
import {watchHistoryStorage, WatchHistoryItem} from '../storage/WatchHistoryStorage';
import {watchListStorage, WatchListItem} from '../storage/WatchListStorage';
import {settingsStorage} from '../storage/SettingsStorage';

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY =
  'YOUR_SUPABASE_ANON_KEY';

export interface CloudUserData {
  watchHistory: WatchHistoryItem[];
  watchList: WatchListItem[];
  settings: {primaryColor: string; isCustomTheme: boolean};
  profile?: {email: string; name: string; photo?: string};
  lastSyncedAt: number;
}

function sanitise<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

class CloudSyncService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  private async fetchCloudData(userId: string): Promise<CloudUserData | null> {
    const {data, error} = await this.client
      .from('user_data')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return (data?.data as CloudUserData) ?? null;
  }

  private async upsertCloudData(
    userId: string,
    partial: Partial<CloudUserData>,
  ): Promise<void> {
    let current: CloudUserData | null = null;
    try {
      current = await this.fetchCloudData(userId);
    } catch (_) {}

    const merged: CloudUserData = sanitise({
      ...(current ?? {}),
      ...partial,
      lastSyncedAt: Date.now(),
    });

    const {error} = await this.client.from('user_data').upsert(
      {user_id: userId, data: merged, updated_at: new Date().toISOString()},
      {onConflict: 'user_id'},
    );
    if (error) throw error;
  }

  async pullUserData(userId: string): Promise<void> {
    try {
      const cloud = await this.fetchCloudData(userId);
      if (!cloud) {
        console.log('[CloudSync] No cloud data — fresh account.');
        return;
      }

      // Watch History
      if (cloud.watchHistory?.length) {
        const local = watchHistoryStorage.getWatchHistory();
        const localIds = new Set(local.map(i => i.id));
        const merged = [
          ...local,
          ...cloud.watchHistory.filter(i => !localIds.has(i.id)),
        ].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
        merged.slice(0, 100).forEach(item =>
          watchHistoryStorage.addToWatchHistory(item),
        );
        console.log(`[CloudSync] Restored ${cloud.watchHistory.length} watch history items.`);
      }

      // Watch List
      if (cloud.watchList?.length) {
        const local = watchListStorage.getWatchList();
        const localLinks = new Set(local.map(i => i.link));
        cloud.watchList
          .filter(ci => !localLinks.has(ci.link))
          .forEach(item => watchListStorage.addToWatchList(item));
        console.log(`[CloudSync] Restored ${cloud.watchList.length} watchlist items.`);
      }

      // Settings
      if (cloud.settings) {
        if (cloud.settings.primaryColor)
          settingsStorage.setPrimaryColor(cloud.settings.primaryColor);
        if (typeof cloud.settings.isCustomTheme === 'boolean')
          settingsStorage.setCustomTheme(cloud.settings.isCustomTheme);
      }

      console.log('[CloudSync] Pull complete ✅');
    } catch (error) {
      console.error('[CloudSync] pullUserData failed (non-fatal):', error);
    }
  }

  async pushUserData(userId: string): Promise<void> {
    try {
      await this.upsertCloudData(userId, {
        watchHistory: watchHistoryStorage.getWatchHistory(),
        watchList: watchListStorage.getWatchList(),
        settings: {
          primaryColor: settingsStorage.getPrimaryColor(),
          isCustomTheme: settingsStorage.isCustomTheme(),
        },
      });
      console.log('[CloudSync] Full push complete ✅');
    } catch (error) {
      console.error('[CloudSync] pushUserData failed:', error);
    }
  }

  async pushCategory(
    userId: string,
    category: 'watchHistory' | 'watchList' | 'settings',
  ): Promise<void> {
    try {
      let partial: Partial<CloudUserData>;
      switch (category) {
        case 'watchHistory':
          partial = {watchHistory: watchHistoryStorage.getWatchHistory()};
          break;
        case 'watchList':
          partial = {watchList: watchListStorage.getWatchList()};
          break;
        case 'settings':
          partial = {
            settings: {
              primaryColor: settingsStorage.getPrimaryColor(),
              isCustomTheme: settingsStorage.isCustomTheme(),
            },
          };
          break;
        default:
          return;
      }
      await this.upsertCloudData(userId, partial);
    } catch (error) {
      console.error(`[CloudSync] pushCategory(${category}) failed:`, error);
    }
  }

  async saveUserProfile(
    userId: string,
    profile: {email: string; name: string; photo?: string},
  ): Promise<void> {
    try {
      await this.upsertCloudData(userId, {profile});
    } catch (error) {
      console.error('[CloudSync] saveUserProfile failed:', error);
    }
  }
}

export const cloudSyncService = new CloudSyncService();