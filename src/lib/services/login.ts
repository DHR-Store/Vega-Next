/**
 * login.ts — Supabase email/password auth.
 * Syncs watchHistory and watchList only. Providers are NOT synced.
 * Supports local profile photo stored in user's MMKV partition.
 */

import 'react-native-url-polyfill/auto';
import {createClient, SupabaseClient, User as SupabaseUser} from '@supabase/supabase-js';
import {MMKV} from 'react-native-mmkv';
import {DeviceEventEmitter} from 'react-native'; // ✅ added
import {storageService} from '../storage/StorageService';
import {cloudSyncService} from '../services/CloudSyncService';

import useWatchHistoryStore from '../zustand/watchHistrory';
import useWatchListStore from '../zustand/watchListStore';
import {watchHistoryStorage} from '../storage/WatchHistoryStorage';
import {watchListStorage} from '../storage/WatchListStorage';

const SUPABASE_URL = 'https://YOUR_SUPABASE_URL.supabase.co';
const SUPABASE_ANON_KEY =
  'YOUR_SUPABASE_ANON_KEY';

// MMKV key used to store the user's custom profile photo (base64 data URI)
const PROFILE_PHOTO_KEY = 'user_profile_photo';

export interface User {
  id: string;
  email: string;
  name: string;
  /** URL from OAuth provider (Google etc.) — may be null for email accounts */
  photo?: string;
}

function rehydrateAllStores(): void {
  try {
    useWatchHistoryStore.getState().rehydrate();
    useWatchListStore.getState().rehydrate();
    console.log('[UserSession] Stores rehydrated ✅');
  } catch (e) {
    console.warn('[UserSession] Store rehydration failed (non-fatal):', e);
  }
}

class UserSession {
  private static instance: UserSession;
  private readonly supabase: SupabaseClient;
  private readonly sessionStorage = new MMKV({id: 'user-session'});
  private currentUser: User | null = null;

  private constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,      // ✅ changed to true
        autoRefreshToken: true,    // ✅ changed to true
        detectSessionInUrl: false,
      },
    });
    this._restoreSession();
  }

  static getInstance(): UserSession {
    if (!UserSession.instance) {
      UserSession.instance = new UserSession();
    }
    return UserSession.instance;
  }

  // ✅ Expose the authenticated Supabase client
  public getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }

  private _mapSupabaseUser(su: SupabaseUser): User {
    return {
      id: su.id,
      email: su.email ?? '',
      name:
        su.user_metadata?.full_name ??
        su.user_metadata?.name ??
        (su.email ?? '').split('@')[0],
      photo: su.user_metadata?.avatar_url ?? undefined,
    };
  }

  private _restoreSession(): void {
    try {
      const userJson = this.sessionStorage.getString('currentUser');
      if (userJson) {
        this.currentUser = JSON.parse(userJson) as User;
        storageService.setCurrentUser(this.currentUser.id);
        rehydrateAllStores();
        console.log('[UserSession] Session restored for:', this.currentUser.email);
      }
    } catch (e) {
      console.error('[UserSession] Failed to restore session:', e);
      this.currentUser = null;
    }
  }

  private async _finaliseLogin(user: User): Promise<User> {
    this.currentUser = user;
    this.sessionStorage.set('currentUser', JSON.stringify(user));
    DeviceEventEmitter.emit('userLoggedIn', user);

    // 1. CAPTURE GUEST/OFFLINE DATA BEFORE SWITCHING PARTITIONS
    const guestHistory = watchHistoryStorage.getWatchHistory() || [];
    const guestWatchList = watchListStorage.getWatchList() || [];

    // 2. SWITCH STORAGE TO LOGGED-IN USER PARTITION
    storageService.setCurrentUser(user.id);

    // 3. PULL EXISTING USER DATA FROM CLOUD
    await cloudSyncService.pullUserData(user.id).catch(e => console.log('Offline/Sync error', e));

    // 4. MERGE GUEST DATA INTO USER PARTITION
    if (guestHistory.length > 0) {
      const userHistory = watchHistoryStorage.getWatchHistory() || [];
      const userHistoryIds = new Set(userHistory.map(i => i.id));
      guestHistory.forEach(item => {
        if (!userHistoryIds.has(item.id)) {
          watchHistoryStorage.addToWatchHistory(item);
        }
      });
    }

    if (guestWatchList.length > 0) {
      const userList = watchListStorage.getWatchList() || [];
      const userListLinks = new Set(userList.map(i => i.link));
      guestWatchList.forEach(item => {
        if (!userListLinks.has(item.link)) {
          watchListStorage.addToWatchList(item);
        }
      });
    }

    // 5. PUSH THE FULLY MERGED DATA BACK TO THE CLOUD
    await cloudSyncService.pushUserData(user.id).catch(() => {});

    // 6. FINALIZE STORES
    rehydrateAllStores();
    cloudSyncService
      .saveUserProfile(user.id, {email: user.email, name: user.name, photo: user.photo})
      .catch(() => {});

    return user;
  }

  // ── Profile Updates ────────────────────────────────────────────────────────

  async updateName(newName: string): Promise<void> {
    if (!this.currentUser) return;
    
    // Update local state
    this.currentUser.name = newName;
    this.sessionStorage.set('currentUser', JSON.stringify(this.currentUser));
    
    try {
      // Update Supabase auth metadata
      await this.supabase.auth.updateUser({
        data: { full_name: newName, name: newName }
      });
      
      // Update cloud sync profile
      await cloudSyncService.saveUserProfile(this.currentUser.id, {
        email: this.currentUser.email,
        name: newName,
        photo: this.currentUser.photo
      });
    } catch (error) {
      console.warn('[UserSession] Failed to sync name to cloud:', error);
    }
  }

  updateProfilePhoto(base64DataUri: string): void {
    if (!this.currentUser) return;
    storageService.main.setString(PROFILE_PHOTO_KEY, base64DataUri);
    console.log('[UserSession] Profile photo updated ✅');
  }

  getProfilePhoto(): string | null {
    if (!this.currentUser) return null;
    return storageService.main.getString(PROFILE_PHOTO_KEY) ?? null;
  }

  clearProfilePhoto(): void {
    if (!this.currentUser) return;
    storageService.main.delete(PROFILE_PHOTO_KEY);
  }

  getBestPhotoUri(): string | null {
    return this.getProfilePhoto() ?? this.currentUser?.photo ?? null;
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  async signUp(email: string, password: string): Promise<User> {
    const {data, error} = await this.supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message);
    if (!data.session && data.user) {
      try {
        return await this.signInWithEmail(email, password);
      } catch (_) {
        throw new Error(
          'Account created! Please check your email to confirm your account, then sign in.',
        );
      }
    }
    if (!data.user) throw new Error('Sign up failed. Please try again.');
    return this._finaliseLogin(this._mapSupabaseUser(data.user));
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const {data, error} = await this.supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      if (
        error.message.toLowerCase().includes('email not confirmed') ||
        error.message.toLowerCase().includes('not confirmed')
      ) {
        await this.supabase.auth
          .resend({type: 'signup', email: email.trim().toLowerCase()})
          .catch(() => {});
        throw new Error(
          'Your email is not confirmed yet.\n\nWe just resent the confirmation email — please check your inbox, then try again.\n\nOR: Go to Supabase → Authentication → Settings and turn off "Enable email confirmations".',
        );
      }
      if (
        error.message.toLowerCase().includes('invalid login') ||
        error.message.toLowerCase().includes('invalid credentials')
      ) {
        throw new Error('Incorrect email or password. Please try again.');
      }
      throw new Error(error.message);
    }
    if (!data.user) throw new Error('Sign in failed. Please try again.');
    return this._finaliseLogin(this._mapSupabaseUser(data.user));
  }

  async sendPasswordReset(email: string): Promise<void> {
    const {error} = await this.supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
    );
    if (error) throw new Error(error.message);
  }

  async signOut(): Promise<void> {
    if (this.currentUser) {
      await cloudSyncService.pushUserData(this.currentUser.id).catch(() => {});
    }
    await this.supabase.auth.signOut().catch(() => {});
    this.currentUser = null;
    this.sessionStorage.delete('currentUser');
    storageService.setCurrentUser(null);
    rehydrateAllStores();
    // ✅ Emit logout event
    DeviceEventEmitter.emit('userLoggedOut');
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }
}

export const userSession = UserSession.getInstance();
// ✅ Export the authenticated Supabase client for use in other services
export const supabaseClient = userSession.getSupabaseClient();