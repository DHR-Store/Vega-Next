// lib/services/uploadService.ts
import {supabaseClient} from './login';
// ✅ FIX: Import from legacy path for Expo SDK 54+ compatibility
import * as FileSystem from 'expo-file-system/legacy';
import {Platform} from 'react-native';

const getMimeFromPath = (uri: string, folder: string, hint?: string): string => {
  if (hint && hint !== 'application/octet-stream') return hint;
  const lower = uri.toLowerCase();
  if (folder === 'images' || lower.match(/\.(jpg|jpeg)$/)) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (folder === 'videos' || lower.match(/\.(mp4|m4v)$/)) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/m4a';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  return 'application/octet-stream';
};

const getExtension = (mimeType: string): string => {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
  };
  return map[mimeType] ?? 'bin';
};

// ── Helper: Decode Base64 to ArrayBuffer for React Native ──────────────
// Replaces standard `atob` which is not globally available in React Native.
const decodeBase64 = (base64: string): ArrayBuffer => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  const base64Str = base64.replace(/\s/g, ''); // strip any formatting whitespace
  let bufferLength = base64Str.length * 0.75;
  if (base64Str[base64Str.length - 1] === '=') bufferLength--;
  if (base64Str[base64Str.length - 2] === '=') bufferLength--;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);
  let p = 0;

  for (let i = 0; i < base64Str.length; i += 4) {
    const enc1 = lookup[base64Str.charCodeAt(i)];
    const enc2 = lookup[base64Str.charCodeAt(i + 1)];
    const enc3 = lookup[base64Str.charCodeAt(i + 2)];
    const enc4 = lookup[base64Str.charCodeAt(i + 3)];

    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (base64Str.charCodeAt(i + 2) !== 61) {
      bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    }
    if (base64Str.charCodeAt(i + 3) !== 61) {
      bytes[p++] = ((enc3 & 3) << 6) | (enc4 & 63);
    }
  }
  return arrayBuffer;
};

export const uploadToSupabase = async (
  uri: string,
  folder: string,
  mimeTypeHint?: string,
): Promise<string> => {
  const contentType = getMimeFromPath(uri, folder, mimeTypeHint);
  const ext = getExtension(contentType);
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
  const filePath = `${folder}/${fileName}`;

  let uploadError: any = null;

  // Ensure Android local paths have file:// prefix for fetch
  const formattedUri = Platform.OS === 'android' && !uri.startsWith('file://') && !uri.startsWith('content://') 
    ? `file://${uri}` 
    : uri;

  // ── Strategy 1: Fetch → Blob (best quality, but flaky on Android content:// URIs) ─────────────────
  try {
    const response = await fetch(formattedUri);
    const blob = await response.blob();

    const {error} = await supabaseClient.storage
      .from('community-attachments')
      .upload(filePath, blob, {contentType, upsert: false});

    uploadError = error;
    if (!error) {
      return getPublicUrl(filePath);
    }
  } catch (_) {
    // Fall through to base64 strategy
  }

  // ── Strategy 2: Base64 to ArrayBuffer (Rock-Solid Fallback via Legacy API) ─────────────────────
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const arrayBuffer = decodeBase64(base64);

    const {error} = await supabaseClient.storage
      .from('community-attachments')
      .upload(filePath, arrayBuffer, {contentType, upsert: false});

    if (error) throw error;
    return getPublicUrl(filePath);
  } catch (e) {
    console.error('Upload failed (both strategies):', e, 'Original error:', uploadError);
    throw new Error('Upload failed. Please try a smaller file or check your connection.');
  }
};

const getPublicUrl = (filePath: string): string => {
  const {data} = supabaseClient.storage
    .from('community-attachments')
    .getPublicUrl(filePath);
  if (!data?.publicUrl) throw new Error('Could not get public URL');
  return data.publicUrl;
};