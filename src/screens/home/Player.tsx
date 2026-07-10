// Player.tsx – fully optimised for fast JS rendering, zero lag, smooth animations

import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {
  ScrollView,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  Image,
  Platform,
  TouchableNativeFeedback,
  StatusBar,
  AppState,
  AppStateStatus,
  TextInput,
  KeyboardAvoidingView,
  Alert,
  Share,
  FlatList,
  StyleSheet,
} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
// NOTE: Clipboard was removed from react-native core. Use @react-native-clipboard/clipboard
let ClipboardModule: {setString: (s: string) => void} | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ClipboardModule = require('@react-native-clipboard/clipboard').default;
} catch (_) {}
const setClipboard = (text: string) => {
  if (ClipboardModule) {
    ClipboardModule.setString(text);
  } else {
    Share.share({message: text}).catch(() => {});
  }
};
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../App';
import {cacheStorage, settingsStorage} from '../../lib/storage';
import Orientation, {
  OrientationLocker,
  LANDSCAPE,
} from 'react-native-orientation-locker';
import VideoPlayer from '@vega-next/react-native-media-console';
import {useNavigation, StackActions} from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  VideoRef,
  SelectedVideoTrack,
  SelectedVideoTrackType,
  ResizeMode,
  SelectedTrack,
  SelectedTrackType,
} from 'react-native-video';
import useContentStore from '../../lib/zustand/contentStore';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import useThemeStore from '../../lib/zustand/themeStore';
import SearchSubtitles from '../../components/SearchSubtitles';
import useWatchHistoryStore from '../../lib/zustand/watchHistrory';
import {useStream, useVideoSettings} from '../../lib/hooks/useStream';
import {
  usePlayerProgress,
  usePlayerSettings,
} from '../../lib/hooks/usePlayerSettings';
// ── Re-export types for activeTab expanded union (general / fastForward / hdr)
type PlayerActiveTab =
  | 'audio'
  | 'subtitle'
  | 'server'
  | 'quality'
  | 'speed'
  | 'general'
  | 'fastForward'
  | 'hdr';
import FullScreenChz from 'react-native-fullscreen-chz';
import {DiscordRPC} from '../../lib/services/DiscordRPC';
import {MMKV} from '../../lib/Mmkv';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

// --- CONFIG INTERFACE ---
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  [key: string]: any;
}

// --- FALLBACK CONFIGURATION ---
const FALLBACK_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_FIREBASE_AUTH_DOMAIN',
  databaseURL: 'YOUR_FIREBASE_DATABASE_URL',
  projectId: 'YOUR_FIREBASE_PROJECT_ID',
  storageBucket: 'YOUR_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'YOUR_FIREBASE_APP_ID',
  measurementId: 'YO',
};

const sanitizeFirebaseKey = (key: string): string => {
  if (!key) return '';
  return key
    .replace(/\./g, '(DOT)')
    .replace(/#/g, '(HASH)')
    .replace(/\$/g, '(DOLLAR)')
    .replace(/\[/g, '(LBRACKET)')
    .replace(/\]/g, '(RBRACKET)')
    .replace(/\//g, '(SLASH)')
    .trim();
};

const generateRandomId = (length: number = 6) => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const toUTF8BinaryString = (str: string): string => {
  return encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) =>
    String.fromCharCode(parseInt(p1, 16)),
  );
};

const fromUTF8BinaryString = (str: string): string => {
  try {
    return decodeURIComponent(
      str
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(''),
    );
  } catch (e) {
    return str;
  }
};

const chars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

const base64Encode = (input: string): string => {
  try {
    if (typeof global.btoa === 'function') {
      return global.btoa(toUTF8BinaryString(input));
    }
  } catch (e) {}

  let str = input;
  let output = '';
  for (
    let block = 0, charCode, i = 0, map = chars;
    str.charAt(i | 0) || ((map = '='), i % 1);
    output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
  ) {
    charCode = str.charCodeAt((i += 3 / 4));
    block = (block << 8) | charCode;
  }
  return output;
};

const base64Decode = (input: string): string | null => {
  try {
    if (typeof global.atob === 'function') {
      const decodedBinary = global.atob(input);
      return fromUTF8BinaryString(decodedBinary);
    }
  } catch (e) {}

  try {
    let str = input.replace(/=+$/, '');
    let output = '';
    if (str.length % 4 === 1) {
      return null;
    }
    for (
      let bc = 0, bs = 0, buffer, i = 0;
      (buffer = str.charAt(i++));
      // @ts-ignore
      ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
        ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      // @ts-ignore
      buffer = chars.indexOf(buffer);
    }
    return output;
  } catch (e) {
    return null;
  }
};

// --- HDR TYPES ---
type HDRMode = 'auto' | 'sdr' | 'hdr10' | 'hlg' | 'dolby_vision';

interface HDRCapabilities {
  isHDR10Supported: boolean;
  isDolbyVisionSupported: boolean;
  isHLGSupported: boolean;
  maxLuminance: number | null;
  isAnyHDRSupported: boolean;
}

// --- STORAGE KEYS ---
const KEY_FF_RATE = 'fastForwardRate';
const KEY_SKIP_INTRO = 'autoSkipIntro';
const KEY_SKIP_DURATION = 'skipIntroDuration';
const KEY_WATCH_TOGETHER = 'watchTogetherMode';
const KEY_USER_NICKNAME = 'userNickname';
const KEY_USER_PASSWORD = 'userPassword';
const KEY_HDR_MODE = 'hdrPlaybackMode';

// --- INITIAL SETTINGS CONSTANTS ---
const DEFAULT_FF_RATE = 2.0;
const DEFAULT_SKIP_INTRO = false;
const DEFAULT_SKIP_DURATION = 85;
const FAST_FORWARD_DELAY_MS = 800;
const MOCK_FAST_FORWARD_RATES = [1.5, 2.0, 3.0, 4.0];

const getFastForwardRate = () => {
  const rateStr = cacheStorage.getString(KEY_FF_RATE);
  const rate = rateStr ? Number(rateStr) : DEFAULT_FF_RATE;
  return isNaN(rate) ? DEFAULT_FF_RATE : rate;
};

const getAutoSkipIntro = () => {
  const skipStr = cacheStorage.getString(KEY_SKIP_INTRO);
  return skipStr === 'true' ? true : DEFAULT_SKIP_INTRO;
};

const getSkipIntroDuration = () => {
  const durationStr = cacheStorage.getString(KEY_SKIP_DURATION);
  const duration = durationStr ? Number(durationStr) : DEFAULT_SKIP_DURATION;
  return isNaN(duration) ? DEFAULT_SKIP_DURATION : duration;
};

const getWatchTogetherMode = () => {
  const modeStr = cacheStorage.getString(KEY_WATCH_TOGETHER);
  return modeStr === 'true' ? true : false;
};

const getUserNickname = (): string => {
  return cacheStorage.getString(KEY_USER_NICKNAME) || '';
};

const getUserPassword = (): string => {
  return cacheStorage.getString(KEY_USER_PASSWORD) || '';
};

const getHDRMode = (): HDRMode => {
  const mode = cacheStorage.getString(KEY_HDR_MODE);
  const valid: HDRMode[] = ['auto', 'sdr', 'hdr10', 'hlg', 'dolby_vision'];
  return valid.includes(mode as HDRMode) ? (mode as HDRMode) : 'auto';
};

// --- REALTIME SYNC HOOK (unchanged) ---
interface ChatMessage {
  userId: string;
  message: string;
  timestamp: number;
}

interface SyncData {
  time: number;
  lastUpdated: number;
  userId: string;
  isPlaying: boolean;
}

const useRealtimeSync = (
  sessionId: string,
  isEnabled: boolean,
  isLeader: boolean,
  localNickname: string,
  otherUserNicknameHint: string,
  isSyncingVideo: boolean,
) => {
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig | null>(
    null,
  );
  const [configLoading, setConfigLoading] = useState(true);

  const safeSessionId = useMemo(
    () => sanitizeFirebaseKey(sessionId),
    [sessionId],
  );

  useEffect(() => {
    const loadFirebaseConfig = async () => {
      const CACHE_TTL = 3600 * 1000;
      const cachedCfg = cacheStorage.getString('_fb_cfg_data');
      const cachedAt = cacheStorage.getString('_fb_cfg_ts');
      if (cachedCfg && cachedAt && Date.now() - Number(cachedAt) < CACHE_TTL) {
        try {
          setFirebaseConfig(JSON.parse(cachedCfg));
          setConfigLoading(false);
          return;
        } catch (_) {}
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch('YOUR FIRE BASE SERVER URL', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`Server status: ${res.status}`);
        const cfg = await res.json();
        cacheStorage.setString('_fb_cfg_data', JSON.stringify(cfg));
        cacheStorage.setString('_fb_cfg_ts', String(Date.now()));
        setFirebaseConfig(cfg);
      } catch (error) {
        if (cachedCfg) {
          try {
            setFirebaseConfig(JSON.parse(cachedCfg));
            return;
          } catch (_) {}
        }
        console.warn('Using fallback config:', error);
        setFirebaseConfig(FALLBACK_FIREBASE_CONFIG);
      } finally {
        setConfigLoading(false);
      }
    };
    loadFirebaseConfig();
  }, []);

  const syncRef = useMemo(() => {
    if (!firebaseConfig?.databaseURL || !safeSessionId) return null;
    return `${firebaseConfig.databaseURL}/sessions/${safeSessionId}.json`;
  }, [firebaseConfig, safeSessionId]);

  const chatRef = useMemo(() => {
    if (!firebaseConfig?.databaseURL || !safeSessionId) return null;
    return `${firebaseConfig.databaseURL}/chats/${safeSessionId}.json`;
  }, [firebaseConfig, safeSessionId]);

  const [chatLog, setChatLog] = useState<string[]>([]);
  const [rawChatData, setRawChatData] = useState<any>(null);
  const [remoteTime, setRemoteTime] = useState<number | null>(null);
  const [remoteIsPlaying, setRemoteIsPlaying] = useState<boolean>(true);
  const [isReceivingUpdates, setIsReceivingUpdates] = useState(false);

  const [syncedOtherUser, setSyncedOtherUser] = useState(otherUserNicknameHint);
  const userNickname = useRef(localNickname);

  useEffect(() => {
    userNickname.current = localNickname;
  }, [localNickname]);

  useEffect(() => {
    if (otherUserNicknameHint) {
      setSyncedOtherUser(otherUserNicknameHint);
    }
  }, [otherUserNicknameHint]);

  const processChatData = useCallback(
    (data: any) => {
      if (!data) return;

      const messages: ChatMessage[] = Object.keys(data)
        .map(key => {
          let finalMessage = data[key].message;
          const decoded = base64Decode(data[key].message);
          if (decoded !== null && decoded.length > 0) {
            finalMessage = decoded;
          }
          return {...data[key], message: finalMessage};
        })
        .filter(msg => msg !== null) as ChatMessage[];

      const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);

      if (!syncedOtherUser) {
        const possiblePartner = sortedMessages.find(
          m => m.userId !== localNickname,
        );
        if (possiblePartner) {
          setSyncedOtherUser(possiblePartner.userId);
        }
      }

      setChatLog(
        sortedMessages.map(msg =>
          msg.userId === localNickname
            ? `You: ${msg.message}`
            : `${msg.userId}: ${msg.message}`,
        ),
      );
    },
    [localNickname, syncedOtherUser],
  );

  useEffect(() => {
    if (rawChatData) {
      processChatData(rawChatData);
    }
  }, [syncedOtherUser, processChatData, rawChatData]);

  const fetchChat = useCallback(async () => {
    if (!chatRef) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(chatRef, {signal: controller.signal});
      clearTimeout(timeoutId);
      if (!response.ok) return;
      const data = await response.json();
      setRawChatData(data);
      processChatData(data);
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e?.name !== 'AbortError') console.error('Error fetching chat:', e);
    }
  }, [chatRef, processChatData]);

  const snapToLeader = useCallback(async () => {
    if (!syncRef) return false;
    try {
      const response = await fetch(syncRef);
      const data: SyncData = await response.json();
      if (
        data &&
        data.time !== undefined &&
        data.userId !== userNickname.current
      ) {
        return {time: data.time, isPlaying: data.isPlaying};
      }
      return false;
    } catch (e) {
      console.error('Error fetching time for snap:', e);
      return false;
    }
  }, [syncRef]);

  useEffect(() => {
    if (
      !isEnabled ||
      !sessionId ||
      sessionId.length === 0 ||
      !syncRef ||
      !chatRef
    )
      return;

    fetchChat();

    const fetchSyncTime = async () => {
      try {
        const response = await fetch(syncRef);
        const data: SyncData = await response.json();
        if (data && data.time !== undefined) {
          if (data.userId !== userNickname.current) {
            setRemoteTime(data.time);
            setRemoteIsPlaying(data.isPlaying);
            setIsReceivingUpdates(true);
            if (!syncedOtherUser) {
              setSyncedOtherUser(data.userId);
            }
          } else {
            setIsReceivingUpdates(false);
          }
        }
      } catch (e) {
        console.error('Error fetching sync time:', e);
      }
    };

    const chatIntervalId = setInterval(() => {
      fetchChat();
    }, 1500);

    const syncIntervalId = setInterval(() => {
      fetchSyncTime();
    }, 3000);

    return () => {
      clearInterval(chatIntervalId);
      clearInterval(syncIntervalId);
    };
  }, [
    sessionId,
    isEnabled,
    chatRef,
    syncRef,
    isLeader,
    fetchChat,
    syncedOtherUser,
    isSyncingVideo,
  ]);

  const sendChat = useCallback(
    async (message: string) => {
      if (!chatRef) return;
      setChatLog(prev => [...prev, `You: ${message}`]);
      const encodedMessage = base64Encode(message);
      const chatMessage: ChatMessage = {
        userId: userNickname.current,
        message: encodedMessage,
        timestamp: Date.now(),
      };
      try {
        const response = await fetch(chatRef, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(chatMessage),
        });
        if (response.ok) {
          fetch(chatRef)
            .then(res => res.json())
            .then(data => {
              setRawChatData(data);
            });
        }
      } catch (e) {
        console.error('Error sending chat:', e);
        ToastAndroid.show('Failed to send message', ToastAndroid.SHORT);
      }
    },
    [chatRef, userNickname],
  );

  const sendTimeUpdate = useCallback(
    async (time: number, isPlaying: boolean) => {
      if (!isLeader || !syncRef) return;
      const syncData: SyncData = {
        time: Math.floor(time),
        isPlaying: isPlaying,
        lastUpdated: Date.now(),
        userId: userNickname.current,
      };
      try {
        await fetch(syncRef, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(syncData),
        });
      } catch (e) {
        console.error('Error sending sync time:', e);
      }
    },
    [syncRef, isLeader, userNickname],
  );

  return {
    chatLog,
    remoteTime,
    remoteIsPlaying,
    sendChat,
    sendTimeUpdate,
    isReceivingUpdates,
    userNickname: userNickname.current,
    syncedOtherUser,
    safeSessionId,
    configLoading,
    firebaseConfig,
    snapToLeader,
  };
};

// --- HDR SUPPORT HOOK (unchanged) ---
const useHDRSupport = (): HDRCapabilities => {
  return useMemo(() => {
    if (Platform.OS === 'ios') {
      return {
        isHDR10Supported: true,
        isDolbyVisionSupported: true,
        isHLGSupported: true,
        maxLuminance: null,
        isAnyHDRSupported: true,
      };
    }
    try {
      const constants = Platform.constants as any;
      const isHDR10 = Boolean(constants?.isHDR10Supported);
      const isDolbyVision = Boolean(constants?.isDolbyVisionSupported);
      const isHLG = Boolean(constants?.isHLGSupported);
      const maxLuminance: number | null =
        typeof constants?.maxLuminance === 'number'
          ? constants.maxLuminance
          : null;
      return {
        isHDR10Supported: isHDR10,
        isDolbyVisionSupported: isDolbyVision,
        isHLGSupported: isHLG,
        maxLuminance,
        isAnyHDRSupported: isHDR10 || isDolbyVision || isHLG,
      };
    } catch {
      return {
        isHDR10Supported: false,
        isDolbyVisionSupported: false,
        isHLGSupported: false,
        maxLuminance: null,
        isAnyHDRSupported: false,
      };
    }
  }, []);
};

const detectHDRTracks = (tracks: any[]): boolean => {
  if (!tracks || tracks.length === 0) return false;
  return tracks.some((track: any) => {
    const codec = (track?.codecs || '').toLowerCase();
    const transfer = (
      track?.transferCharacteristics ||
      track?.colorTransfer ||
      track?.hdrFormat ||
      ''
    ).toLowerCase();
    const primaries = (
      track?.colorPrimaries ||
      track?.colorSpace ||
      ''
    ).toLowerCase();

    const isDolbyVision =
      codec.includes('dvh1') ||
      codec.includes('dvhe') ||
      codec.includes('dovi') ||
      codec.includes('dvav') ||
      codec.includes('dav1');
    if (isDolbyVision) return true;

    const isPQ =
      transfer.includes('smpte2084') ||
      transfer.includes('2084') ||
      transfer.includes('pq') ||
      transfer.includes('hdr10');
    if (isPQ) return true;

    const isHLG =
      transfer.includes('arib-std-b67') ||
      transfer.includes('hlg') ||
      transfer.includes('b67');
    if (isHLG) return true;

    const isBT2020 = primaries.includes('bt2020') || primaries.includes('2020');
    const isHEVC =
      codec.includes('hvc1') ||
      codec.includes('hev1') ||
      codec.includes('hevc');
    const isAV1 = codec.includes('av01') || codec.includes('av1');
    if (isBT2020 && (isHEVC || isAV1)) return true;

    return isHEVC || isAV1;
  });
};

// --- NICKNAME OVERLAY (unchanged) ---
interface NicknameOverlayProps {
  primary: string;
  currentNickname: string;
  setNickname: (name: string) => void;
  currentPassword: string;
  setPassword: (pass: string) => void;
  onConfirm: () => void;
  isAuthenticating: boolean;
}

const NicknameInputOverlay = ({
  primary,
  currentNickname,
  setNickname,
  currentPassword,
  setPassword,
  onConfirm,
  isAuthenticating,
}: NicknameOverlayProps) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="absolute top-0 left-0 right-0 bottom-0 z-[100] bg-black/80 justify-center items-center">
      <View className="bg-zinc-800 p-6 rounded-xl w-[80%] max-w-[400px]">
        <Text className="text-white text-xl font-bold mb-2 text-center">
          Watch Together Profile
        </Text>
        <Text className="text-gray-300 text-sm mb-4 text-center">
          Secure your nickname with a password to prevent others from using it.
        </Text>

        <Text className="text-gray-400 text-xs ml-1 mb-1">Nickname</Text>
        <TextInput
          className="w-full bg-zinc-700 text-white rounded-lg p-3 text-base mb-3"
          placeholder="Enter nickname (e.g., 'Neo')"
          placeholderTextColor="#A1A1AA"
          value={currentNickname}
          onChangeText={setNickname}
          maxLength={20}
          editable={!isAuthenticating}
        />

        <Text className="text-gray-400 text-xs ml-1 mb-1">Password</Text>
        <TextInput
          className="w-full bg-zinc-700 text-white rounded-lg p-3 text-base mb-6"
          placeholder="Enter password"
          placeholderTextColor="#A1A1AA"
          value={currentPassword}
          onChangeText={setPassword}
          secureTextEntry={true}
          editable={!isAuthenticating}
        />

        <TouchableOpacity
          onPress={onConfirm}
          disabled={
            currentNickname.trim().length < 3 ||
            currentPassword.length < 1 ||
            isAuthenticating
          }
          className="w-full rounded-lg p-3 items-center"
          style={{
            backgroundColor:
              currentNickname.trim().length >= 3 && currentPassword.length >= 1
                ? primary
                : '#3F3F46',
          }}>
          <Text className="text-white text-lg font-semibold">
            {isAuthenticating ? 'Verifying...' : 'Confirm Identity'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// --- EPISODE PANEL OVERLAY (unchanged) ---
interface EpisodePanelProps {
  visible: boolean;
  onClose: () => void;
  episodeList: any[];
  activeEpisode: any;
  onSelectEpisode: (episode: any) => void;
  primary: string;
}

const EpisodePanelOverlay = ({
  visible,
  onClose,
  episodeList,
  activeEpisode,
  onSelectEpisode,
  primary,
}: EpisodePanelProps) => {
  if (!visible) return null;

  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.45)',
          zIndex: 60,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 320,
          backgroundColor: '#0d0d0d',
          zIndex: 61,
          borderLeftWidth: 1,
          borderLeftColor: `${primary}44`,
          shadowColor: '#000',
          shadowOffset: {width: -8, height: 0},
          shadowOpacity: 0.7,
          shadowRadius: 20,
          elevation: 20,
        }}
        onTouchEnd={e => e.stopPropagation()}>
        <LinearGradient
          colors={[`${primary}33`, 'transparent']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 14,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.08)',
          }}>
          <View>
            <Text style={{color: 'white', fontSize: 16, fontWeight: 'bold'}}>
              Episodes
            </Text>
            <Text style={{color: 'rgba(255,255,255,0.5)', fontSize: 12}}>
              {episodeList.length} available
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 20,
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <MaterialIcons name="close" size={18} color="white" />
          </TouchableOpacity>
        </LinearGradient>
        <FlatList
          data={episodeList}
          keyExtractor={(item, index) => `ep-panel-${item.link}-${index}`}
          initialScrollIndex={(() => {
            const idx = episodeList.findIndex(
              e => e.link === activeEpisode?.link,
            );
            return idx > 0 && idx < episodeList.length ? idx : 0;
          })()}
          getItemLayout={(_, index) => ({
            length: 64,
            offset: 64 * index,
            index,
          })}
          windowSize={5}
          maxToRenderPerBatch={8}
          initialNumToRender={6}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
          renderItem={({item, index}) => {
            const isActive = item.link === activeEpisode?.link;
            return (
              <TouchableOpacity
                onPress={() => {
                  onSelectEpisode(item);
                  onClose();
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 10,
                  paddingHorizontal: 14,
                  height: 64,
                  backgroundColor: isActive ? `${primary}22` : 'transparent',
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.05)',
                  borderLeftWidth: isActive ? 3 : 0,
                  borderLeftColor: isActive ? primary : 'transparent',
                }}>
                {isActive ? (
                  <MaterialIcons
                    name="play-arrow"
                    size={22}
                    color={primary}
                    style={{marginRight: 8}}
                  />
                ) : (
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: 'rgba(255,255,255,0.07)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                    }}>
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.45)',
                        fontSize: 11,
                        fontWeight: '600',
                      }}>
                      {index + 1}
                    </Text>
                  </View>
                )}
                <Text
                  numberOfLines={2}
                  style={{
                    flex: 1,
                    color: isActive ? primary : 'white',
                    fontSize: 13,
                    fontWeight: isActive ? '700' : '400',
                    lineHeight: 18,
                  }}>
                  {item.title}
                </Text>
                {isActive && (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: primary,
                      marginLeft: 6,
                    }}
                  />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </>
  );
};

// ==================== MAIN PLAYER COMPONENT ====================
const Player = ({route}: Props): React.JSX.Element => {
  const {primary} = useThemeStore(state => state);
  const {provider} = useContentStore();
  const navigation = useNavigation();
  const {addItem, updatePlaybackInfo, updateItemWithInfo} =
    useWatchHistoryStore();

  const playerRef: React.RefObject<VideoRef> = useRef(null);
  const hasSetInitialTracksRef = useRef(false);
  const [keyForPlayer, setKeyForPlayer] = useState(0);
  const [showPlayer, setShowPlayer] = useState(true);
  const isPipActiveRef = useRef(false);
  const wasPlayingBeforePipRef = useRef(true);
  const chatScrollRef = useRef<ScrollView>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartTimeRef = useRef<number>(0);
  const isMovingRef = useRef(false);
  const wasShowingControlsBeforeFFRef = useRef<boolean>(false);
  const showChatOverlayRef = useRef(false);

  // ── FIX: Restored missing state and refs ────────────────────────
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [showEpisodePanel, setShowEpisodePanel] = useState(false);

  const loadingOpacity = useSharedValue(0);
  const loadingScale = useSharedValue(0.8);
  const loadingRotation = useSharedValue(0);

  // Pinch-to-zoom
  const videoScaleValue = useSharedValue(1.0);
  const videoScaleRef = useRef(1.0);
  const videoScaleStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{scale: videoScaleValue.value}],
  }));
  const lastPinchDistanceRef = useRef<number | null>(null);
  const isPinchingRef = useRef(false);

  // External subtitle auto-select
  const pendingAutoSelectUriRef = useRef<string | null>(null);
  const [selectedExternalSubUri, setSelectedExternalSubUri] = useState<
    string | null
  >(null);

  // ── FIX: Critical refs for performance – restored ──────────────
  const videoCurrentTimeRef = useRef(0);
  const isPlayingRef = useRef(true);

  const toggleFullScreen = useCallback(() => {
    if (isFullScreen) {
      StatusBar.setHidden(false);
      FullScreenChz.disable();
      setIsFullScreen(false);
    } else {
      StatusBar.setHidden(true);
      FullScreenChz.enable();
      setIsFullScreen(true);
    }
  }, [isFullScreen]);

  const loadingContainerStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
    transform: [{scale: loadingScale.value}],
  }));
  const loadingIconStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${loadingRotation.value}deg`}],
  }));

  // ========== Include magnetLink in initialActiveEpisode ==========
  const initialActiveEpisode = useMemo(() => {
    const fromList = route.params?.episodeList?.[route.params.linkIndex];
    if (fromList) return fromList;
    const link = route.params?.link || route.params?.video_id;
    if (link || route.params?.magnetLink) {
      const titleFromLink = route.params?.primaryTitle
        ? decodeURIComponent(route.params.primaryTitle)
        : route.params?.title || 'Shared Video';
      return {
        title: titleFromLink,
        link: link || null,
        poster: route.params?.poster?.poster || null,
        magnetLink: route.params?.magnetLink || null,
      };
    }
    return null;
  }, [
    route.params?.episodeList,
    route.params?.linkIndex,
    route.params?.link,
    route.params?.video_id,
    route.params?.primaryTitle,
    route.params?.title,
    route.params?.magnetLink,
  ]);

  const [activeEpisode, setActiveEpisode] = useState(initialActiveEpisode);

  const [searchQuery, setSearchQuery] = useState('');

  const streamProvider = useMemo(() => {
    return route.params?.providerValue
      ? decodeURIComponent(route.params.providerValue)
      : provider.value;
  }, [route.params?.providerValue, provider.value]);

  const {
    streamData,
    selectedStream,
    setSelectedStream,
    externalSubs,
    setExternalSubs,
    addExternalSub,
    removeExternalSub,
    clearExternalSubs,
    isLoading: streamLoading,
    error: streamError,
    refetch,
    switchToNextStream,
    torrentStreamUrl,
    torrentMetrics,
  } = useStream({
    activeEpisode,
    routeParams: route.params,
    provider: streamProvider,
  });

  // ★ Debug: Log torrent URL changes
  useEffect(() => {
    if (torrentStreamUrl) {
      console.log('[Player] torrentStreamUrl changed to:', torrentStreamUrl);
    } else {
      console.log('[Player] torrentStreamUrl is null (waiting or not torrent)');
    }
  }, [torrentStreamUrl]);

  const currentSourceUriRef = useRef('');
  useEffect(() => {
    currentSourceUriRef.current =
      torrentStreamUrl || selectedStream?.link || '';
  }, [torrentStreamUrl, selectedStream?.link]);

  const {
    audioTracks,
    textTracks,
    videoTracks,
    selectedAudioTrackIndex,
    selectedTextTrackIndex,
    selectedQualityIndex,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setSelectedQualityIndex,
    setTextTracks,
    processAudioTracks,
    processVideoTracks,
  } = useVideoSettings();

  const {
    showControls,
    setShowControls,
    showControlsRef,
    showControlsWithAutoHide,
    controlsHideTimerRef,
    showSettings,
    setShowSettings,
    activeTab,
    setActiveTab,
    resizeMode,
    setResizeMode,
    playbackRate: basePlaybackRate,
    setPlaybackRate: setBasePlaybackRate,
    isPlayerLocked,
    showUnlockButton,
    toastMessage,
    showToast,
    setToast,
    isTextVisible,
    setIsTextVisible,
    handleResizeMode,
    togglePlayerLock,
    handleLockedScreenTap,
    unlockButtonTimerRef,
    toastTimerRef,
    subtitleDelay,
    setSubtitleDelay,
    isBuffering,
    setIsBuffering,
    handleBufferChange,
  } = usePlayerSettings();

  // --- Paused controls lock handling ---

  const [autoSkipIntro, setAutoSkipIntroState] = useState(getAutoSkipIntro());
  const [skipDuration, setSkipDurationState] = useState(getSkipIntroDuration());
  const hasSkippedIntroRef = useRef(false);
  const lastActiveEpisodeRef = useRef(activeEpisode?.link);

  const videoId =
    route.params?.link || route.params?.video_id || activeEpisode?.link || '';

  const [watchTogetherMode, setWatchTogetherModeState] = useState(
    getWatchTogetherMode(),
  );
  const [showChatOverlay, setShowChatOverlay] = useState(false);
  useEffect(() => {
    showChatOverlayRef.current = showChatOverlay;
  }, [showChatOverlay]);
  const [isSessionLeader, setIsSessionLeader] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  const [userNickname, setUserNickname] = useState(getUserNickname());
  const [userPassword, setUserPassword] = useState(getUserPassword());
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [chatMessage, setChatMessage] = useState('');
  const [isSyncingVideo, setIsSyncingVideo] = useState(false);

  const roomStorageKey = `room_session_${sanitizeFirebaseKey(videoId)}`;

  const [roomId, setRoomId] = useState<string | null>(() => {
    if (route.params?.roomId) {
      return decodeURIComponent(route.params.roomId);
    }
    const savedRoomId = cacheStorage.getString(roomStorageKey);
    return savedRoomId || null;
  });

  useEffect(() => {
    if (watchTogetherMode && !roomId && videoId) {
      const savedRoomId = cacheStorage.getString(roomStorageKey);
      if (savedRoomId) {
        setRoomId(savedRoomId);
      } else {
        const newRoomId = `${sanitizeFirebaseKey(
          videoId,
        )}_${generateRandomId()}`;
        setRoomId(newRoomId);
        cacheStorage.setString(roomStorageKey, newRoomId);
      }
    }
  }, [watchTogetherMode, roomId, videoId, roomStorageKey]);

  const otherUserNicknameFromLink = useMemo(() => {
    const leaderNickname = route.params?.leader;
    if (route.params?.syncLink && leaderNickname) {
      return decodeURIComponent(leaderNickname);
    }
    return '';
  }, [route.params?.syncLink, route.params?.leader]);

  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);

  const lastCalculatedStart = useRef<number>(0);
  const wasPlaying = useRef<boolean>(false);

  useEffect(() => {
    const savedToken = cacheStorage.getString('discord_token');
    if (savedToken) {
      DiscordRPC.connect(savedToken);
    }
    return () => {
      DiscordRPC.disconnect();
    };
  }, [route.params?.id, activeEpisode?.id]);

  useEffect(() => {
    const mainTitle = route.params?.primaryTitle
      ? decodeURIComponent(route.params.primaryTitle)
      : route.params?.title || activeEpisode?.title || 'Unknown Video';

    const subState =
      activeEpisode?.title && activeEpisode.title !== mainTitle
        ? activeEpisode.title
        : 'Watching Now';

    const rawPoster =
      route.params?.poster ||
      route.params?.episodeList?.poster ||
      activeEpisode?.image ||
      route.params?.image ||
      route.params?.cover ||
      undefined;

    const providerName =
      route.params?.providerValue ||
      route.params?.providerName ||
      route.params?.provider ||
      undefined;

    if (isPlaying && videoDuration > 0) {
      const currentEpochMs = Date.now();
      const startTime = Math.floor(currentEpochMs - videoCurrentTime * 1000);
      const endTime = Math.floor(startTime + videoDuration * 1000);

      if (
        Math.abs(startTime - lastCalculatedStart.current) > 2000 ||
        !wasPlaying.current
      ) {
        lastCalculatedStart.current = startTime;
        wasPlaying.current = true;

        DiscordRPC.updatePresence(
          mainTitle,
          subState,
          startTime,
          endTime,
          rawPoster,
          providerName,
        );
      }
    } else if (!isPlaying) {
      if (wasPlaying.current || lastCalculatedStart.current !== 0) {
        wasPlaying.current = false;
        lastCalculatedStart.current = 0;

        DiscordRPC.updatePresence(
          mainTitle,
          `Paused - ${subState}`,
          undefined,
          undefined,
          rawPoster,
          providerName,
        );
      }
    }
  }, [isPlaying, activeEpisode, route.params, videoDuration]);

  const currentSyncKey = watchTogetherMode && roomId ? roomId : '';

  const {
    chatLog,
    remoteTime,
    remoteIsPlaying,
    sendChat,
    sendTimeUpdate,
    isReceivingUpdates,
    userNickname: syncedUserNickname,
    syncedOtherUser,
    firebaseConfig,
    snapToLeader,
    configLoading,
  } = useRealtimeSync(
    currentSyncKey,
    watchTogetherMode,
    isSessionLeader,
    userNickname,
    otherUserNicknameFromLink,
    isSyncingVideo,
  );

  const setWatchTogetherMode = useCallback(
    (mode: boolean) => {
      if (mode) {
        if (!userNickname || !userPassword) {
          setShowNicknameModal(true);
          return;
        }

        if (!roomId) {
          let idToUse = cacheStorage.getString(roomStorageKey);
          if (!idToUse) {
            idToUse = `${sanitizeFirebaseKey(videoId)}_${generateRandomId()}`;
            cacheStorage.setString(roomStorageKey, idToUse);
          }
          setRoomId(idToUse);
        }
      }
      setWatchTogetherModeState(mode);
      cacheStorage.setString(KEY_WATCH_TOGETHER, String(mode));
      if (mode) setIsSessionLeader(true);
      if (!mode) setIsSyncingVideo(false);
    },
    [userNickname, userPassword, roomId, videoId, roomStorageKey],
  );

  const handleSetIdentity = useCallback(
    async (
      nick: string,
      pass: string,
      isJoining: boolean = false,
      forcedRoomId: string | null = null,
    ) => {
      if (!firebaseConfig?.databaseURL) {
        ToastAndroid.show(
          'Sync server not ready. Try again.',
          ToastAndroid.SHORT,
        );
        return false;
      }
      setIsAuthenticating(true);
      const safeNick = sanitizeFirebaseKey(nick.trim());
      const userRef = `${firebaseConfig.databaseURL}/users/${safeNick}.json`;

      try {
        const response = await fetch(userRef);
        const userData = await response.json();

        let authSuccess = false;

        if (userData && userData.password) {
          if (userData.password === pass.trim()) {
            authSuccess = true;
          } else {
            Alert.alert(
              'Authentication Failed',
              'Nickname is already taken and password does not match.',
            );
          }
        } else {
          await fetch(userRef, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              password: pass.trim(),
              createdAt: Date.now(),
            }),
          });
          authSuccess = true;
          ToastAndroid.show('Profile Created!', ToastAndroid.SHORT);
        }

        if (authSuccess) {
          setUserNickname(nick.trim());
          setUserPassword(pass.trim());
          cacheStorage.setString(KEY_USER_NICKNAME, nick.trim());
          cacheStorage.setString(KEY_USER_PASSWORD, pass.trim());
          setShowNicknameModal(false);

          if (isJoining && forcedRoomId) {
            setRoomId(forcedRoomId);
            cacheStorage.setString(roomStorageKey, forcedRoomId);
            setWatchTogetherModeState(true);
            setIsSessionLeader(false);
            setIsSyncingVideo(true);
            ToastAndroid.show('Joined Private Room!', ToastAndroid.SHORT);
          } else if (!isJoining && !roomId) {
            let newId = cacheStorage.getString(roomStorageKey);
            if (!newId) {
              newId = `${sanitizeFirebaseKey(videoId)}_${generateRandomId()}`;
              cacheStorage.setString(roomStorageKey, newId);
            }
            setRoomId(newId);
            setWatchTogetherModeState(true);
          }
        }
        return authSuccess;
      } catch (e) {
        console.error('Auth Error', e);
        Alert.alert('Error', 'Could not verify identity. Check internet.');
        return false;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [firebaseConfig, videoId, roomId, roomStorageKey],
  );

  const isFastForwardingRef = useRef(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [fastForwardRate, setLocalFastForwardRateState] =
    useState(getFastForwardRate());

  const setSkipDuration = useCallback((duration: number) => {
    setSkipDurationState(duration);
    cacheStorage.setString(KEY_SKIP_DURATION, String(duration));
  }, []);

  const setAutoSkipIntro = useCallback((skip: boolean) => {
    setAutoSkipIntroState(skip);
    cacheStorage.setString(KEY_SKIP_INTRO, String(skip));
  }, []);

  const setLocalFastForwardRate = useCallback((rate: number) => {
    setLocalFastForwardRateState(rate);
    cacheStorage.setString(KEY_FF_RATE, String(rate));
  }, []);

  const hdrCapabilities = useHDRSupport();
  const [hdrMode, setHDRModeState] = useState<HDRMode>(getHDRMode());

  const setHDRMode = useCallback((mode: HDRMode) => {
    setHDRModeState(mode);
    cacheStorage.setString(KEY_HDR_MODE, mode);
    const label =
      mode === 'auto'
        ? 'HDR: Auto (device decides)'
        : mode === 'sdr'
          ? 'SDR mode – HDR disabled'
          : `${mode.toUpperCase()} mode enabled`;
    ToastAndroid.show(label, ToastAndroid.SHORT);
  }, []);

  const isHDRMountRef = useRef(true);
  useEffect(() => {
    if (isHDRMountRef.current) {
      isHDRMountRef.current = false;
      return;
    }
    setKeyForPlayer(k => k + 1);
  }, [hdrMode]);

  const isHDRActive = useMemo(() => hdrMode !== 'sdr', [hdrMode]);
  const hasHDRTracks = useMemo(
    () => detectHDRTracks(videoTracks),
    [videoTracks],
  );

  const hdrAwareVideoTrack = useMemo<SelectedVideoTrack>(() => {
    if (
      hdrMode === 'auto' ||
      hdrMode === 'sdr' ||
      !videoTracks ||
      videoTracks.length === 0
    ) {
      return selectedVideoTrack;
    }

    const codecPrefixMap: Record<string, string[]> = {
      dolby_vision: ['dvh1', 'dvhe', 'dvav', 'dav1'],
      hdr10: ['hvc1', 'hev1'],
      hlg: ['hvc1', 'hev1', 'av01'],
    };
    const prefixes = codecPrefixMap[hdrMode] ?? [];

    const matching = (videoTracks as any[]).filter((t: any) =>
      prefixes.some(p => (t?.codecs || '').toLowerCase().startsWith(p)),
    );

    if (matching.length > 0) {
      const best = matching.reduce((a: any, b: any) =>
        (b.bitrate || 0) > (a.bitrate || 0) ? b : a,
      );
      return {type: SelectedVideoTrackType.INDEX, value: best.index};
    }

    return selectedVideoTrack;
  }, [hdrMode, videoTracks, selectedVideoTrack]);

  useEffect(() => {
    isFastForwardingRef.current = isFastForwarding;
  }, [isFastForwarding]);

  const finalPlaybackRate = useMemo(() => {
    return isFastForwarding ? fastForwardRate : basePlaybackRate;
  }, [isFastForwarding, fastForwardRate, basePlaybackRate]);

  // Pinch gesture helpers
  const getPinchDistance = useCallback((touches: any[]) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // --- Stabilised touch handlers to prevent re-creation on every render
  const handleTouchStart = useCallback(
    (e: any) => {
      if (e.nativeEvent.touches.length === 2) {
        isPinchingRef.current = true;
        lastPinchDistanceRef.current = getPinchDistance(e.nativeEvent.touches);
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        return;
      }

      touchStartXRef.current = e.nativeEvent.pageX;
      touchStartYRef.current = e.nativeEvent.pageY;
      touchStartTimeRef.current = Date.now();
      isMovingRef.current = false;

      if (
        !isPlayerLocked &&
        !showSettings &&
        !showChatOverlay &&
        playerRef.current
      ) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
          if (!isMovingRef.current) {
            wasShowingControlsBeforeFFRef.current = showControlsRef.current;
            setShowControls(false);
            isFastForwardingRef.current = true;
            setIsFastForwarding(true);
            setToast(`⚡ ${fastForwardRate.toFixed(1)}x`, 60000);
            longPressTimerRef.current = null;
          } else {
            longPressTimerRef.current = null;
          }
        }, FAST_FORWARD_DELAY_MS);
      }
    },
    [
      isPlayerLocked,
      showSettings,
      showChatOverlay,
      fastForwardRate,
      setShowControls,
      setToast,
      getPinchDistance,
      showControlsRef,
    ],
  );

  const handleTouchMove = useCallback(
    (e: any) => {
      if (e.nativeEvent.touches.length === 2 && isPinchingRef.current) {
        const newDist = getPinchDistance(e.nativeEvent.touches);
        if (
          lastPinchDistanceRef.current !== null &&
          lastPinchDistanceRef.current > 0
        ) {
          const ratio = newDist / lastPinchDistanceRef.current;
          const newScale = Math.min(
            Math.max(videoScaleRef.current * ratio, 0.5),
            4.0,
          );
          videoScaleRef.current = newScale;
          videoScaleValue.value = newScale;
        }
        lastPinchDistanceRef.current = newDist;
        return;
      }

      const deltaX = Math.abs(e.nativeEvent.pageX - touchStartXRef.current);
      const deltaY = Math.abs(e.nativeEvent.pageY - touchStartYRef.current);
      const MIN_MOVE_DISTANCE = 10;
      if (deltaX > MIN_MOVE_DISTANCE || deltaY > MIN_MOVE_DISTANCE) {
        isMovingRef.current = true;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (isFastForwardingRef.current) {
          setIsFastForwarding(false);
          isFastForwardingRef.current = false;
          setToast('', 1);
          if (wasShowingControlsBeforeFFRef.current) {
            showControlsWithAutoHide(4000);
          } else {
            setShowControls(false);
          }
        }
      }
    },
    [
      setToast,
      setShowControls,
      showControlsWithAutoHide,
      getPinchDistance,
      videoScaleValue,
    ],
  );

  const handleTouchEnd = useCallback(
    (e: any) => {
      if ((e.nativeEvent.touches?.length ?? 0) < 2) {
        isPinchingRef.current = false;
        lastPinchDistanceRef.current = null;
      }

      const touchDuration = Date.now() - touchStartTimeRef.current;
      const wasFastForwarding = isFastForwardingRef.current;

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (wasFastForwarding) {
        setIsFastForwarding(false);
        isFastForwardingRef.current = false;
        setToast('', 1);
        if (wasShowingControlsBeforeFFRef.current) {
          setShowControls(true);
        }
      }
      isMovingRef.current = false;
    },
    [
      setToast,
      setShowControls,
      showControlsWithAutoHide,
      showControlsRef,
      isPlayerLocked,
      showSettings,
      setIsPlaying,
    ],
  );

  const {videoPositionRef, handleProgress: baseHandleProgress} =
    usePlayerProgress({
      activeEpisode,
      routeParams: route.params,
      playbackRate: finalPlaybackRate,
      updatePlaybackInfo,
    });

  const lastSyncSendRef = useRef<number>(0);

  // --- Stabilise progress callback
  const handleProgress = useCallback(
    (data: any) => {
      baseHandleProgress(data);
      if (data && data.currentTime !== undefined) {
        videoCurrentTimeRef.current = data.currentTime;
      }
      const now = Date.now();
      if (
        watchTogetherMode &&
        isSessionLeader &&
        now - lastSyncSendRef.current > 10000
      ) {
        sendTimeUpdate(data.currentTime, isPlayingRef.current);
        lastSyncSendRef.current = now;
      }
    },
    [baseHandleProgress, watchTogetherMode, isSessionLeader, sendTimeUpdate],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setVideoCurrentTime(videoCurrentTimeRef.current);
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Auto-skip intro using ref
  useEffect(() => {
    if (autoSkipIntro && !hasSkippedIntroRef.current) {
      if (activeEpisode?.link !== lastActiveEpisodeRef.current) {
        hasSkippedIntroRef.current = false;
        lastActiveEpisodeRef.current = activeEpisode?.link;
      }
      const currentT = videoCurrentTimeRef.current;
      if (currentT > 1 && currentT <= skipDuration) {
        if (playerRef.current) {
          playerRef.current.seek(skipDuration);
          ToastAndroid.show(
            `Skipping intro to ${skipDuration}s`,
            ToastAndroid.SHORT,
          );
          hasSkippedIntroRef.current = true;
        }
      }
    }
  }, [videoCurrentTime, autoSkipIntro, skipDuration, activeEpisode?.link]);

  // Sync follower
  useEffect(() => {
    if (
      watchTogetherMode &&
      !isSessionLeader &&
      remoteTime !== null &&
      playerRef.current
    ) {
      if (isSyncingVideo) {
        const timeDifference = Math.abs(
          videoCurrentTimeRef.current - remoteTime,
        );
        if (timeDifference > 1.5) {
          playerRef.current.seek(remoteTime);
        }
        if (remoteIsPlaying !== isPlaying) {
          if (remoteIsPlaying) {
            playerRef.current.resume();
            setIsPlaying(true);
          } else {
            playerRef.current.pause();
            setIsPlaying(false);
          }
        }
      }
    }
  }, [
    watchTogetherMode,
    isSessionLeader,
    remoteTime,
    remoteIsPlaying,
    isPlaying,
    isSyncingVideo,
  ]);

  const playbacks = useMemo(
    () => [0.25, 0.5, 1.0, 1.25, 1.35, 1.5, 1.75, 2],
    [],
  );

  const contentInfoUrl = route.params?.infoUrl || '';
  const contentProviderValue = route.params?.providerValue || provider.value;
  const contentPrimaryTitle =
    route.params?.primaryTitle || activeEpisode?.title || 'Shared Video';
  const currentTime = Math.floor(videoPositionRef.current.position);

  const urlSafeTitle = encodeURIComponent(contentPrimaryTitle);
  const urlSafeInfoUrl = encodeURIComponent(contentInfoUrl);
  const urlSafeProvider = encodeURIComponent(contentProviderValue);
  const urlSafeRoomId = encodeURIComponent(roomId || '');

  const shareLink = `vegaNext://watch/video_id=${videoId}&time=${currentTime}&syncLink=true&roomId=${urlSafeRoomId}&leader=${encodeURIComponent(
    userNickname,
  )}&infoUrl=${urlSafeInfoUrl}&providerValue=${urlSafeProvider}&primaryTitle=${urlSafeTitle}`;

  const initialSeekTime = useMemo(() => {
    const syncTime = route.params?.time;
    const isSyncLink = !!route.params?.syncLink;

    if (isSyncLink && syncTime !== undefined && syncTime !== null) {
      return Number(syncTime);
    }

    const episodeLink = activeEpisode?.link;
    if (!episodeLink) return 0;

    const cached = cacheStorage.getString(episodeLink);
    try {
      const cachedData = cached ? JSON.parse(cached) : null;
      if (cachedData && cachedData.position < cachedData.duration - 300) {
        return cachedData.position;
      }
    } catch (e) {
      console.error('Error parsing cached data:', e);
    }
    return 0;
  }, [activeEpisode?.link, route.params?.time, route.params?.syncLink]);

  const hideSeekButtons = useMemo(
    () => settingsStorage.hideSeekButtons() || false,
    [],
  );
  const enableSwipeGesture = useMemo(
    () => settingsStorage.isSwipeGestureEnabled(),
    [],
  );
  const showMediaControls = useMemo(
    () => settingsStorage.showMediaControls() || false,
    [],
  );

  const [selectedAudioTrack, setSelectedAudioTrack] = useState<SelectedTrack>({
    type: SelectedTrackType.INDEX,
    value: 0,
  });
  const [selectedTextTrack, setSelectedTextTrack] = useState<SelectedTrack>({
    type: SelectedTrackType.DISABLED,
  });
  const [selectedVideoTrack, setSelectedVideoTrack] =
    useState<SelectedVideoTrack>({type: SelectedVideoTrackType.AUTO});

  const formatQuality = useCallback((quality: string) => {
    if (quality === 'auto') return quality;
    const num = Number(quality);
    if (num > 1080) return '4K';
    if (num > 720) return '1080p';
    if (num > 480) return '720p';
    if (num > 360) return '480p';
    if (num > 240) return '360p';
    if (num > 144) return '240p';
    return quality;
  }, []);

  const handleNextEpisode = useCallback(() => {
    if (!route.params?.episodeList || !activeEpisode) {
      ToastAndroid.show('Episode list not available.', ToastAndroid.SHORT);
      return;
    }
    const currentIndex = route.params.episodeList.findIndex(
      e => e.link === activeEpisode.link,
    );
    if (
      currentIndex !== -1 &&
      currentIndex < route.params.episodeList.length - 1
    ) {
      const nextEpisode = route.params.episodeList[currentIndex + 1];
      setActiveEpisode(nextEpisode);
      hasSetInitialTracksRef.current = false;
      hasSkippedIntroRef.current = false;
      ToastAndroid.show(
        `Starting next episode: ${nextEpisode.title}`,
        ToastAndroid.SHORT,
      );
    } else {
      ToastAndroid.show('No more episodes', ToastAndroid.SHORT);
    }
  }, [activeEpisode, route.params?.episodeList]);

  // ★ Enhanced error logging for torrent
  const handleVideoError = useCallback(
    (e: any) => {
      console.log('[Video] PlayerError:', JSON.stringify(e));
      console.log('[Video] Error source URI:', currentSourceUriRef.current);
      if (torrentStreamUrl) {
        console.warn(
          '[Video] ⚠️ Torrent stream failed. URL:',
          torrentStreamUrl,
        );
      }
      if (!switchToNextStream()) {
        ToastAndroid.show(
          'Video could not be played, trying next stream...',
          ToastAndroid.SHORT,
        );
        setTimeout(() => {
          if (!streamLoading && !selectedStream?.link) {
            ToastAndroid.show(
              'No working streams found. Returning.',
              ToastAndroid.LONG,
            );
            navigation.goBack();
          }
        }, 3000);
      }
      setShowControls(true);
    },
    [
      switchToNextStream,
      navigation,
      setShowControls,
      streamLoading,
      selectedStream,
      torrentStreamUrl,
    ],
  );

  const handleRestorePIP = useCallback(() => {
    isPipActiveRef.current = false;
    StatusBar.setHidden(true);
    FullScreenChz.enable();
    if (wasPlayingBeforePipRef.current) {
      setIsPlaying(true);
      setTimeout(() => {
        playerRef?.current?.resume();
      }, 200);
    }
  }, []);

  useEffect(() => {
    return () => {
      playerRef?.current?.pause();
      isFastForwardingRef.current = false;
      if (unlockButtonTimerRef.current)
        clearTimeout(unlockButtonTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (controlsHideTimerRef.current)
        clearTimeout(controlsHideTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [unlockButtonTimerRef, controlsHideTimerRef, toastTimerRef]);

  // --------------- FIXED BACK NAVIGATION – NO MORE STUCK SCREEN ---------------
  useEffect(() => {
    // Lock to landscape and enable fullscreen on mount
    Orientation.lockToLandscape();
    FullScreenChz.enable();
    StatusBar.setHidden(true);

    const beforeRemoveUnsubscribe = navigation.addListener(
      'beforeRemove',
      () => {
        // Release orientation lock and clean up immediately before the pop
        Orientation.unlockAllOrientations();
        FullScreenChz.disable();
        StatusBar.setHidden(false);
        playerRef?.current?.pause();
        // Do NOT prevent default – navigation will proceed naturally
      },
    );

    return () => {
      // Cleanup on unmount (just in case)
      Orientation.unlockAllOrientations();
      FullScreenChz.disable();
      StatusBar.setHidden(false);
      beforeRemoveUnsubscribe();
    };
  }, [navigation]);
  // ---------------------------------------------------------------

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        const isAutoPipEnabled = MMKV.getBool ? MMKV.getBool('AutoPip') : false;
        if (isAutoPipEnabled) {
          try {
            if (typeof enterPictureInPictureMode === 'function') {
              enterPictureInPictureMode();
            } else {
              console.log('Triggering PiP Mode...');
            }
          } catch (error) {
            console.error('Failed to enter PiP mode automatically: ', error);
          }
        } else {
          if (typeof setIsPlaying === 'function') {
            setIsPlaying(false);
          }
          ToastAndroid.show('App minimized (PiP disabled)', ToastAndroid.SHORT);
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    setSelectedAudioTrackIndex(0);
    setSelectedTextTrackIndex(1000);
    setSelectedQualityIndex(1000);
    hasSetInitialTracksRef.current = false;
  }, [
    selectedStream,
    activeEpisode,
    torrentStreamUrl,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setSelectedQualityIndex,
  ]);

  useEffect(() => {
    setSearchQuery(route.params?.primaryTitle || '');
  }, [route.params?.primaryTitle]);

  useEffect(() => {
    if (route.params?.primaryTitle && activeEpisode) {
      addItem({
        id:
          route.params.infoUrl ||
          activeEpisode.link ||
          route.params.link ||
          'unknown_id',
        title: route.params.primaryTitle,
        poster:
          route.params.poster?.poster || route.params.poster?.background || '',
        link:
          route.params.infoUrl || activeEpisode.link || route.params.link || '',
        provider: route.params?.providerValue || provider.value,
        lastPlayed: Date.now(),
        duration: 0,
        currentTime: 0,
        playbackRate: 1,
        episodeTitle: activeEpisode.title || 'Unknown Episode',
      });
      if (activeEpisode.link) {
        updateItemWithInfo(activeEpisode.link, {
          ...route.params,
          cachedAt: Date.now(),
        });
      }
    }
  }, [
    route.params,
    activeEpisode,
    addItem,
    updateItemWithInfo,
    provider.value,
  ]);

  useEffect(() => {
    if (
      hasSetInitialTracksRef.current ||
      audioTracks.length === 0 ||
      textTracks.length === 0
    )
      return;
    const lastAudioTrack = cacheStorage.getString('lastAudioTrack') || 'auto';
    const lastTextTrack = cacheStorage.getString('lastTextTrack') || 'auto';
    const audioTrackIndex = audioTracks.findIndex(
      track => track.language === lastAudioTrack,
    );
    const textTrackIndex = textTracks.findIndex(
      track => track.language === lastTextTrack,
    );

    if (audioTrackIndex !== -1) {
      setSelectedAudioTrack({
        type: SelectedTrackType.LANGUAGE,
        value: audioTracks[audioTrackIndex].language,
      });
      setSelectedAudioTrackIndex(audioTrackIndex);
    } else {
      setSelectedAudioTrack({type: SelectedTrackType.INDEX, value: 0});
      setSelectedAudioTrackIndex(0);
    }

    if (textTrackIndex !== -1) {
      setSelectedTextTrack({
        type: SelectedTrackType.LANGUAGE,
        value: textTracks[textTrackIndex].language,
      });
      setSelectedTextTrackIndex(textTrackIndex);
    } else {
      setSelectedTextTrack({type: SelectedTrackType.DISABLED});
      setSelectedTextTrackIndex(1000);
    }
    if (audioTracks.length > 0 && textTracks.length > 0)
      hasSetInitialTracksRef.current = true;
  }, [
    textTracks,
    audioTracks,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
  ]);

  // ── ⭐ NEW: Auto-select external subtitles when they become available in textTracks ──
  useEffect(() => {
    const pendingUri = pendingAutoSelectUriRef.current;
    if (!pendingUri) return;

    // Check if any track in textTracks matches the pending URI
    const found = textTracks.find(
      (t: any) => t.uri === pendingUri || t.url === pendingUri,
    );
    if (found) {
      setSelectedTextTrack({
        type: SelectedTrackType.INDEX,
        value: found.index,
      });
      setSelectedTextTrackIndex(found.index);
      setSelectedExternalSubUri(pendingUri);
      pendingAutoSelectUriRef.current = null;
      ToastAndroid.show('Subtitle activated ✓', ToastAndroid.SHORT);
    }
  }, [textTracks, setSelectedTextTrack, setSelectedTextTrackIndex]);

  // Spinner animation – runs on UI thread
  useEffect(() => {
    if (streamLoading) {
      loadingOpacity.value = withTiming(1, {duration: 300});
      loadingScale.value = withTiming(1, {duration: 300});
      loadingRotation.value = withRepeat(
        withSequence(
          withDelay(200, withTiming(180, {duration: 700})),
          withTiming(180, {duration: 400}),
          withTiming(360, {duration: 700}),
          withTiming(360, {duration: 400}),
        ),
        -1,
      );
    } else {
      cancelAnimation(loadingRotation);
      loadingOpacity.value = withTiming(0, {duration: 200});
      loadingScale.value = withTiming(0.8, {duration: 200});
    }
  }, [streamLoading]);

  // Join sync room from params
  useEffect(() => {
    const paramsRoomId = route.params?.roomId
      ? decodeURIComponent(route.params.roomId)
      : null;
    if (route.params?.syncLink && paramsRoomId) {
      if (!userNickname || !userPassword) {
        setShowNicknameModal(true);
      } else {
        setRoomId(paramsRoomId);
        cacheStorage.setString(roomStorageKey, paramsRoomId);
        setWatchTogetherModeState(true);
        setIsSessionLeader(false);
        setIsSyncingVideo(true);
        ToastAndroid.show('Joined Private Watch Party!', ToastAndroid.SHORT);
      }
    }
  }, [
    route.params?.syncLink,
    route.params?.roomId,
    userNickname,
    userPassword,
    roomStorageKey,
  ]);

  const handleSyncVideo = useCallback(async () => {
    if (isSyncingVideo) {
      setIsSyncingVideo(false);
      ToastAndroid.show(
        'Video sync disabled. Playing freely.',
        ToastAndroid.SHORT,
      );
    } else {
      const remoteState = await snapToLeader();
      if (remoteState) {
        if (playerRef.current) {
          playerRef.current.seek(remoteState.time);
          if (remoteState.isPlaying !== isPlaying) {
            remoteState.isPlaying
              ? playerRef.current.resume()
              : playerRef.current.pause();
            setIsPlaying(remoteState.isPlaying);
          }
        }
        setIsSyncingVideo(true);
        ToastAndroid.show(
          'Synced to leader. Continuous sync enabled.',
          ToastAndroid.SHORT,
        );
      } else {
        ToastAndroid.show(
          'Could not sync. Leader is not sending updates or is paused.',
          ToastAndroid.SHORT,
        );
      }
    }
  }, [isSyncingVideo, snapToLeader, isPlaying, setIsPlaying]);

  // --- Stable callbacks for VideoPlayer, preventing unnecessary prop changes
  const onProgressStable = useCallback(
    (data: any) => handleProgress(data),
    [handleProgress],
  );

  const onBufferStable = useCallback(
    (e: {isBuffering: boolean}) => {
      if (torrentStreamUrl && e.isBuffering) {
        console.log('[Video] Buffering torrent stream...');
      }
      handleBufferChange(e.isBuffering);
    },
    [handleBufferChange, torrentStreamUrl],
  );

  const onLoadStable = useCallback(
    (data: any) => {
      console.log('[Video] onLoad – source URI:', currentSourceUriRef.current);
      if (data && data.duration) {
        setVideoDuration(data.duration);
        console.log('[Video] Duration:', data.duration);
      } else {
        console.warn('[Video] onLoad missing duration data');
      }
      if (initialSeekTime > 0) {
        setTimeout(() => {
          playerRef?.current?.seek(initialSeekTime);
        }, 50);
        if (route.params?.syncLink) {
          ToastAndroid.show(
            `Syncing playback to ${initialSeekTime}s`,
            ToastAndroid.SHORT,
          );
        } else if (initialSeekTime > 120) {
          ToastAndroid.show(
            `Resuming from history at ${initialSeekTime}s`,
            ToastAndroid.SHORT,
          );
        }
      }
      isPlayingRef.current = true;
      playerRef?.current?.resume();
    },
    [initialSeekTime, route.params],
  );

  const onTextTracksStable = useCallback(
    (e: any) => {
      const tracks: any[] = e.textTracks || [];
      setTextTracks(tracks);

      // If there is a pending external sub, try to find it in the tracks
      if (pendingAutoSelectUriRef.current) {
        const uri = pendingAutoSelectUriRef.current;
        const found = tracks.find((t: any) => t.uri === uri || t.url === uri);
        if (found) {
          setSelectedTextTrack({
            type: SelectedTrackType.INDEX,
            value: found.index,
          });
          setSelectedTextTrackIndex(found.index);
          pendingAutoSelectUriRef.current = null;
          ToastAndroid.show('Subtitle activated ✓', ToastAndroid.SHORT);
        }
      }
    },
    [setTextTracks, setSelectedTextTrack, setSelectedTextTrackIndex],
  );

  const onPlaybackStateChangedStable = useCallback(
    (e: any) => {
      const playing = e.isPlaying;
      isPlayingRef.current = playing;
      setIsPlaying(playing);
      wasPlayingBeforePipRef.current = playing;
      if (watchTogetherMode && isSessionLeader) {
        sendTimeUpdate(videoCurrentTimeRef.current, playing);
      }
    },
    [watchTogetherMode, isSessionLeader, sendTimeUpdate],
  );

  // --- videoPlayerProps with minimal stable dependencies
  const videoPlayerProps = useMemo(
    () => ({
      disableGesture: isPlayerLocked || !enableSwipeGesture,
      doubleTapTime: 200,
      disableSeekButtons: isPlayerLocked || hideSeekButtons,
      showOnStart: !isPlayerLocked,
      volume: 1,
      textTracks: externalSubs,
      source: {
        uri: torrentStreamUrl ? torrentStreamUrl : selectedStream?.link || '',
        bufferConfig: {
          minBufferMs: 2500,
          maxBufferMs: 50000,
          bufferForPlaybackMs: 800,
          bufferForPlaybackAfterRebufferMs: 2000,
          backBufferDurationMs: 7000,
        },
        shouldCache: true,
        ...(selectedStream?.type === 'm3u8' && {type: 'm3u8'}),
        headers: selectedStream?.headers,
        ...(hdrMode === 'sdr'
          ? {maxBitRate: 8_000_000}
          : {
              maxBitRate: 100_000_000,
              ...(hdrMode !== 'auto' && {minBitRate: 2_000_000}),
            }),
        metadata: {
          title: route.params?.primaryTitle || activeEpisode?.title || '',
          subtitle: activeEpisode?.title || '',
          artist: activeEpisode?.title || '',
          description: activeEpisode?.title || '',
          imageUri: route.params?.poster?.poster,
        },
      },
      onProgress: onProgressStable,
      onBuffer: onBufferStable,
      paused: !isPlayingRef.current,
      onLoad: onLoadStable,
      onRestoreUserInterfaceForPictureInPicture: handleRestorePIP,
      videoRef: playerRef,
      rate: finalPlaybackRate,
      poster: route.params?.poster?.logo || '',
      subtitleStyle: {
        fontSize: settingsStorage.getSubtitleFontSize() || 16,
        opacity: settingsStorage.getSubtitleOpacity() || 1,
        paddingBottom: settingsStorage.getSubtitleBottomPadding() || 10,
        subtitlesFollowVideo: false,
      },
      title: {
        primary:
          route.params?.primaryTitle?.length > 70
            ? route.params?.primaryTitle.slice(0, 70) + '...'
            : route.params?.primaryTitle || '',
        secondary: activeEpisode?.title,
      },
      navigator: navigation,
      seekColor: primary,
      showDuration: true,
      toggleResizeModeOnFullscreen: false,
      fullscreenOrientation: 'landscape' as const,
      fullscreenAutorotate: true,
      onShowControls: () => {
        setShowControls(true);
        if (showChatOverlayRef.current) setShowChatOverlay(false);
      },
      onHideControls: () => setShowControls(false),
      rewindTime: 10,
      isFullscreen: true,
      disableFullscreen: true,
      disableVolume: true,
      showHours: true,
      progressUpdateInterval: 500,
      showNotificationControls: showMediaControls,
      onError: handleVideoError,
      resizeMode,
      selectedAudioTrack,
      onAudioTracks: (e: any) => processAudioTracks(e.audioTracks),
      selectedTextTrack,
      onTextTracks: onTextTracksStable,
      onVideoTracks: (e: any) => processVideoTracks(e.videoTracks),
      selectedVideoTrack: hdrAwareVideoTrack,
      style: {flex: 1, zIndex: 100},
      controlAnimationTiming: 357,
      controlTimeoutDelay: 10000,
      hideAllControlls: isPlayerLocked && !isSyncingVideo,
      onPlaybackStateChanged: onPlaybackStateChangedStable,
    }),
    [
      isPlayerLocked,
      enableSwipeGesture,
      hideSeekButtons,
      externalSubs,
      selectedStream,
      route.params,
      activeEpisode,
      onProgressStable,
      onBufferStable,
      onLoadStable,
      handleRestorePIP,
      finalPlaybackRate,
      primary,
      navigation,
      setShowControls,
      showMediaControls,
      handleVideoError,
      resizeMode,
      selectedAudioTrack,
      selectedTextTrack,
      selectedVideoTrack,
      processAudioTracks,
      processVideoTracks,
      watchTogetherMode,
      isSessionLeader,
      sendTimeUpdate,
      isSyncingVideo,
      hdrMode,
      isHDRActive,
      hdrAwareVideoTrack,
      onTextTracksStable,
      onPlaybackStateChangedStable,
    ],
  );

  const handleSendChat = () => {
    if (chatMessage.trim()) {
      sendChat(chatMessage.trim());
      setChatMessage('');
    }
  };

  // --- LOADING SCREEN (unchanged) ---
  if (streamLoading) {
    return (
      <SafeAreaView
        edges={{right: 'off', top: 'off', left: 'off', bottom: 'off'}}
        className="bg-black flex-1 justify-center items-center">
        <StatusBar
          hidden={true}
          translucent={true}
          backgroundColor="transparent"
        />
        <OrientationLocker orientation={LANDSCAPE} />
        <TouchableNativeFeedback
          background={TouchableNativeFeedback.Ripple(
            'rgba(255,255,255,0.15)',
            false,
          )}>
          <View className="w-full h-full justify-center items-center">
            <Animated.View
              style={[loadingContainerStyle]}
              className="justify-center items-center">
              <Animated.View style={[loadingIconStyle]} className="mb-2">
                <MaterialIcons name="hourglass-empty" size={60} color="white" />
              </Animated.View>
              <Text className="text-white text-lg mt-4">Loading stream...</Text>
            </Animated.View>
          </View>
        </TouchableNativeFeedback>
      </SafeAreaView>
    );
  }

  if (streamError) {
    return (
      <SafeAreaView className="bg-black flex-1 justify-center items-center">
        <StatusBar
          hidden={true}
          translucent={true}
          backgroundColor="transparent"
        />
        <OrientationLocker orientation={LANDSCAPE} />
        <Text className="text-red-500 text-lg text-center mb-4">
          Failed to load stream. Please try again.
        </Text>
        <TouchableOpacity
          className="bg-red-600 px-4 py-2 rounded-md"
          onPress={() => navigation.goBack()}>
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ★ Allow playback when magnetLink is available
  if (!activeEpisode?.link && !activeEpisode?.magnetLink) {
    return (
      <SafeAreaView className="bg-black flex-1 justify-center items-center">
        <StatusBar
          hidden={true}
          translucent={true}
          backgroundColor="transparent"
        />
        <OrientationLocker orientation={LANDSCAPE} />
        <Text className="text-red-500 text-lg text-center mb-4">
          Critical Error: Video link is missing. Cannot play content.
        </Text>
        <TouchableOpacity
          className="bg-red-600 px-4 py-2 rounded-md"
          onPress={() => navigation.goBack()}>
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={{right: 'off', top: 'off', left: 'off', bottom: 'off'}}
      className="bg-black flex-1 relative">
      <StatusBar
        hidden={isFullScreen}
        translucent={true}
        backgroundColor="transparent"
      />
      <OrientationLocker orientation={LANDSCAPE} />

      <View
        className="flex-1"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}>
        <View style={{flex: 1, overflow: 'hidden'}}>
          <Animated.View style={videoScaleStyle}>
            {showPlayer && (
              // ★ Key remounts on torrent URL change
              <VideoPlayer
                key={`${activeEpisode?.link || 'torrent'}_${torrentStreamUrl ? 'ready' : 'loading'}_${keyForPlayer}`}
                {...videoPlayerProps}
              />
            )}
          </Animated.View>
        </View>

        {/* Torrent UI (shown when magnet link exists but no stream URL yet) */}
        {activeEpisode?.magnetLink && !torrentStreamUrl && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.85)',
              zIndex: 45,
            }}>
            <Text
              style={{
                color: '#fff',
                fontSize: 18,
                fontWeight: 'bold',
                marginBottom: 12,
              }}>
              Connecting to Torrent Peers...
            </Text>
            <View style={{flexDirection: 'row', gap: 20, marginBottom: 12}}>
              <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 14}}>
                Seeds: {torrentMetrics.seeds}
              </Text>
              <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 14}}>
                Speed: {(torrentMetrics.speed / 1024).toFixed(0)} KB/s
              </Text>
            </View>
            <View
              style={{
                width: 200,
                height: 6,
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
              <View
                style={{
                  width: `${Math.min(100, torrentMetrics.buffer)}%`,
                  height: '100%',
                  backgroundColor: primary,
                }}
              />
            </View>
            <Text
              style={{
                color: primary,
                fontSize: 14,
                marginTop: 8,
                fontWeight: '600',
              }}>
              Buffer: {torrentMetrics.buffer.toFixed(1)}%
            </Text>
          </View>
        )}

        {/* Lock overlay */}
        {isPlayerLocked && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleLockedScreenTap}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              backgroundColor: 'transparent',
            }}
          />
        )}

        {/* Chat backdrop */}
        {watchTogetherMode && showChatOverlay && !isPlayerLocked && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowChatOverlay(false)}
            className="absolute top-0 left-0 right-0 bottom-0 bg-transparent"
            style={{zIndex: 49}}
          />
        )}

        {/* Chat panel */}
        {watchTogetherMode && showChatOverlay && !isPlayerLocked && (
          <View
            className="absolute top-0 left-0 h-full w-[300px] z-50 bg-black/70 p-3"
            onTouchEnd={e => e.stopPropagation()}>
            <Text className="text-white font-bold text-lg mb-2 border-b border-white/20 pb-1">
              Watch Together ({userNickname} vs {syncedOtherUser || 'Waiting'})
            </Text>

            {!isSessionLeader && (
              <TouchableOpacity
                onPress={handleSyncVideo}
                className="flex-row items-center justify-center p-2 rounded-lg my-2"
                style={{
                  backgroundColor: isSyncingVideo ? primary : '#4B5563',
                }}>
                <MaterialIcons
                  name={isSyncingVideo ? 'sync-disabled' : 'sync'}
                  size={20}
                  color="white"
                  style={{marginRight: 8}}
                />
                <Text className="text-white font-semibold">
                  {isSyncingVideo
                    ? 'Playing in Sync Mode'
                    : 'Play Freely (Tap to Sync)'}
                </Text>
              </TouchableOpacity>
            )}

            <View className="mb-4 p-2 border border-blue-500/50 rounded-lg">
              {configLoading ? (
                <Text className="text-yellow-300 text-sm font-semibold mb-1">
                  Connecting to Sync Server...
                </Text>
              ) : (
                <Text className="text-blue-300 text-sm font-semibold mb-1">
                  Share this link to sync playback:
                </Text>
              )}
              <View className="flex-row items-center">
                <Text
                  className="flex-1 text-white text-xs mr-2"
                  numberOfLines={1}>
                  {shareLink}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setClipboard(shareLink);
                    ToastAndroid.show('Copied share link!', ToastAndroid.SHORT);
                  }}
                  className="p-1 bg-blue-500 rounded">
                  <MaterialIcons name="content-copy" size={16} color="white" />
                </TouchableOpacity>
              </View>
              <Text className="text-[10px] text-gray-400 mt-1">
                Room ID: {roomId || 'Generating...'}
              </Text>
            </View>

            <ScrollView
              className="flex-1 mb-2"
              ref={chatScrollRef}
              onContentSizeChange={() =>
                chatScrollRef.current?.scrollToEnd({animated: true})
              }>
              {chatLog.map((msg, index) => (
                <Text
                  key={index}
                  className={`text-sm my-0.5 ${
                    msg.startsWith('You:') ? 'text-blue-300' : 'text-green-300'
                  }`}>
                  {msg}
                </Text>
              ))}
            </ScrollView>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 bg-white/10 text-white rounded-l-md p-2 h-10"
                placeholder="Type message..."
                placeholderTextColor="#9CA3AF"
                value={chatMessage}
                onChangeText={setChatMessage}
                onSubmitEditing={handleSendChat}
              />
              <TouchableOpacity
                className="bg-blue-500 rounded-r-md p-2 h-10 justify-center items-center"
                onPress={handleSendChat}>
                <MaterialIcons name="send" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Top-right control row */}
        {!streamLoading &&
          !Platform.isTV &&
          ((isPlayerLocked && showUnlockButton) ||
            (!isPlayerLocked && showControls)) && (
            <View className="absolute top-5 right-5 flex-row items-center gap-4 z-50">
              {route.params?.episodeList &&
                route.params.episodeList.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowEpisodePanel(!showEpisodePanel)}
                    className="opacity-70 p-2 rounded-full">
                    <MaterialIcons
                      name="list"
                      color={showEpisodePanel ? primary : 'hsl(0, 0%, 70%)'}
                      size={26}
                    />
                  </TouchableOpacity>
                )}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setHDRMode(hdrMode === 'sdr' ? 'auto' : 'sdr')}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: isHDRActive ? primary : 'rgba(255,255,255,0.22)',
                  backgroundColor: isHDRActive
                    ? `${primary}25`
                    : 'rgba(255,255,255,0.06)',
                }}>
                <Text
                  style={{
                    color: isHDRActive ? primary : 'rgba(255,255,255,0.40)',
                    fontSize: 10,
                    fontWeight: '900',
                    letterSpacing: 2,
                    textDecorationLine: isHDRActive ? 'none' : 'line-through',
                  }}>
                  HDR
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setActiveTab('general');
                  setShowSettings(!showSettings);
                }}
                className="opacity-70 p-2 rounded-full">
                <MaterialIcons
                  name="settings"
                  color={'hsl(0, 0%, 70%)'}
                  size={24}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleFullScreen}
                style={{padding: 8, marginLeft: 8}}>
                <MaterialIcons
                  name={isFullScreen ? 'fullscreen-exit' : 'fullscreen'}
                  size={28}
                  color="white"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={togglePlayerLock}
                className="opacity-70 p-2 rounded-full">
                <MaterialIcons
                  name={isPlayerLocked ? 'lock' : 'lock-open'}
                  color={'hsl(0, 0%, 70%)'}
                  size={24}
                />
              </TouchableOpacity>
            </View>
          )}

        {/* Left-side chat button */}
        {!streamLoading &&
          !Platform.isTV &&
          watchTogetherMode &&
          !isPlayerLocked && (
            <View
              style={{
                position: 'absolute',
                left: 20,
                top: '55%',
                zIndex: 50,
              }}>
              <TouchableOpacity
                onPress={() => setShowChatOverlay(true)}
                className="opacity-70 p-3 rounded-full bg-black/50"
                onTouchStart={e => e.stopPropagation()}
                onTouchEnd={e => e.stopPropagation()}>
                <MaterialIcons name="chat" size={28} color={'white'} />
              </TouchableOpacity>
            </View>
          )}

        {/* Bottom control bar */}
        {!isPlayerLocked && showControls && (
          <View className="absolute bottom-3 right-6 flex flex-row justify-center w-full gap-x-12">
            <TouchableOpacity
              onPress={() => {
                setActiveTab('audio');
                setShowSettings(!showSettings);
              }}
              className="flex flex-row gap-2 items-center">
              <MaterialIcons
                style={{opacity: 0.7}}
                name={'multitrack-audio'}
                size={26}
                color="white"
              />
              <Text className="capitalize text-xs text-white opacity-70">
                {audioTracks[selectedAudioTrackIndex]?.language || 'auto'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setActiveTab('subtitle');
                setShowSettings(!showSettings);
              }}
              className="flex flex-row gap-2 items-center">
              <MaterialIcons
                style={{opacity: 0.6}}
                name={'subtitles'}
                size={24}
                color="white"
              />
              <Text className="text-xs capitalize text-white opacity-70">
                {selectedTextTrackIndex === 1000
                  ? 'none'
                  : textTracks[selectedTextTrackIndex]?.language}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row gap-1 items-center opacity-60"
              onPress={() => {
                setActiveTab('speed');
                setShowSettings(!showSettings);
              }}>
              <MaterialIcons name="speed" size={26} color="white" />
              <Text className="text-white text-sm">
                {basePlaybackRate === 1 ? '1.0' : basePlaybackRate}
              </Text>
            </TouchableOpacity>

            {!Platform.isTV && (
              <TouchableOpacity
                className="flex-row gap-1 items-center opacity-60"
                onPress={() => {
                  if (playerRef?.current) {
                    wasPlayingBeforePipRef.current = isPlaying;
                    isPipActiveRef.current = true;
                    try {
                      playerRef.current.enterPictureInPicture();
                    } catch (_err) {
                      isPipActiveRef.current = false;
                      ToastAndroid.show(
                        'PiP not supported on this device',
                        ToastAndroid.SHORT,
                      );
                    }
                  }
                }}>
                <MaterialIcons
                  name="picture-in-picture"
                  size={24}
                  color="white"
                />
                <Text className="text-white text-xs">PIP</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              className="flex-row gap-1 items-center opacity-60"
              onPress={() => {
                setActiveTab('server');
                setShowSettings(!showSettings);
              }}>
              <MaterialIcons name="video-settings" size={25} color="white" />
              <Text className="text-xs text-white capitalize">
                {videoTracks?.length === 1
                  ? formatQuality(videoTracks[0]?.height?.toString() || 'auto')
                  : formatQuality(
                      videoTracks?.[selectedQualityIndex]?.height?.toString() ||
                        'auto',
                    )}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row gap-1 items-center opacity-60"
              onPress={handleResizeMode}>
              <MaterialIcons name="fit-screen" size={26} color="white" />
              <Text className="text-white text-sm min-w-[38px]">
                {resizeMode === ResizeMode.NONE
                  ? 'Fit'
                  : resizeMode === ResizeMode.COVER
                    ? 'Cover'
                    : resizeMode === ResizeMode.STRETCH
                      ? 'Stretch'
                      : 'Contain'}
              </Text>
            </TouchableOpacity>

            {!Platform.isTV &&
              route.params?.episodeList &&
              activeEpisode &&
              route.params.episodeList.findIndex(
                e => e.link === activeEpisode.link,
              ) !== -1 &&
              route.params.episodeList.findIndex(
                e => e.link === activeEpisode.link,
              ) <
                route.params.episodeList.length - 1 &&
              videoDuration > 0 &&
              videoCurrentTime / videoDuration > 0.6 && (
                <TouchableOpacity
                  className="flex-row gap-1 items-center opacity-80"
                  onPress={handleNextEpisode}
                  style={{
                    backgroundColor: primary + '22',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: primary + '55',
                  }}>
                  <MaterialIcons name="skip-next" size={18} color={primary} />
                  <Text className="text-white text-sm font-semibold ml-1">
                    Next Ep
                  </Text>
                </TouchableOpacity>
              )}
          </View>
        )}
      </View>

      {/* Episode Panel Overlay */}
      <EpisodePanelOverlay
        visible={showEpisodePanel}
        onClose={() => setShowEpisodePanel(false)}
        episodeList={route.params?.episodeList || []}
        activeEpisode={activeEpisode}
        onSelectEpisode={episode => {
          setActiveEpisode(episode);
          hasSetInitialTracksRef.current = false;
          hasSkippedIntroRef.current = false;
        }}
        primary={primary}
      />

      {/* Toast */}
      {showToast && (
        <View
          pointerEvents="none"
          className="absolute w-full top-12 justify-center items-center px-2 z-50">
          <Text className="text-white bg-black/70 p-2 rounded-full text-base font-semibold">
            {toastMessage}
          </Text>
        </View>
      )}

      {/* Buffering overlay */}
      {isBuffering && !streamLoading && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 35,
          }}>
          <View
            style={{
              backgroundColor: 'rgba(0,0,0,0.65)',
              borderRadius: 14,
              paddingHorizontal: 20,
              paddingVertical: 14,
              alignItems: 'center',
              gap: 8,
            }}>
            <Animated.View style={[loadingIconStyle]}>
              <MaterialIcons name="hourglass-empty" size={34} color="white" />
            </Animated.View>
            <Text
              style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: 13,
                marginTop: 2,
              }}>
              Buffering…
            </Text>
          </View>
        </View>
      )}

      {/* Settings panel */}
      {!streamLoading && !isPlayerLocked && showSettings && (
        <View
          className="absolute top-0 left-0 w-full h-full bg-black/20 justify-end items-center"
          onTouchEnd={() => setShowSettings(false)}>
          <View
            className="bg-black p-3 w-[600px] h-72 rounded-t-lg flex-row justify-start items-center"
            onTouchEnd={e => e.stopPropagation()}>
            {/* ... (settings tabs unchanged) ... */}
            {/* General tab */}
            {activeTab === 'general' && (
              <ScrollView className="w-full h-full p-1 px-4">
                <Text className="text-lg font-bold text-center text-white mb-4">
                  General Settings
                </Text>
                <View className="flex-row justify-between items-center my-2">
                  <Text className="text-white text-base">Auto Skip Intro</Text>
                  <TouchableOpacity
                    onPress={() => setAutoSkipIntro(!autoSkipIntro)}
                    className="p-2 rounded-full"
                    style={{
                      backgroundColor: autoSkipIntro ? primary : 'gray',
                    }}>
                    <MaterialIcons
                      name={autoSkipIntro ? 'toggle-on' : 'toggle-off'}
                      size={32}
                      color="white"
                    />
                  </TouchableOpacity>
                </View>
                <View className="flex-row justify-between items-center my-2">
                  <Text className="text-white text-base">
                    Intro Skip Duration ({skipDuration}s)
                  </Text>
                  <View className="flex-row items-center gap-4">
                    <TouchableOpacity
                      onPress={() =>
                        setSkipDuration(Math.max(0, skipDuration - 5))
                      }
                      className="p-2 bg-white/10 rounded-md">
                      <Text className="text-white text-lg">-</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setSkipDuration(skipDuration + 5)}
                      className="p-2 bg-white/10 rounded-md">
                      <Text className="text-white text-lg">+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View className="border-t border-white/20 my-4" />
                <Text className="text-lg font-bold text-center text-white mb-4">
                  Watch Together
                </Text>
                {userNickname && userPassword ? (
                  <View>
                    <View className="flex-row justify-between items-center my-2">
                      <Text className="text-white text-base">
                        Your Nickname: **{userNickname}**
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowNicknameModal(true)}
                        className="p-1 bg-white/10 rounded-md">
                        <Text className="text-white text-sm">Change</Text>
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row justify-between items-center my-2">
                      <Text className="text-white text-base">
                        Watch Together Mode (Leader:{' '}
                        {isSessionLeader ? 'Yes' : 'No'})
                      </Text>
                      <TouchableOpacity
                        onPress={() => setWatchTogetherMode(!watchTogetherMode)}
                        className="p-2 rounded-full"
                        style={{
                          backgroundColor: watchTogetherMode ? primary : 'gray',
                        }}>
                        <MaterialIcons
                          name={watchTogetherMode ? 'toggle-on' : 'toggle-off'}
                          size={32}
                          color="white"
                        />
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row justify-between items-center my-2">
                      <Text className="text-white text-base">
                        Assume Session Leadership
                      </Text>
                      <TouchableOpacity
                        onPress={() => setIsSessionLeader(!isSessionLeader)}
                        disabled={!watchTogetherMode}
                        className="p-2 rounded-full"
                        style={{
                          backgroundColor:
                            isSessionLeader && watchTogetherMode
                              ? primary
                              : 'gray',
                        }}>
                        <MaterialIcons
                          name={
                            isSessionLeader
                              ? 'check-box'
                              : 'check-box-outline-blank'
                          }
                          size={24}
                          color="white"
                        />
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row justify-between items-center my-2">
                      <Text className="text-white text-base">
                        Continuous Video Sync (Follower)
                      </Text>
                      <TouchableOpacity
                        onPress={() => setIsSyncingVideo(!isSyncingVideo)}
                        disabled={isSessionLeader || !watchTogetherMode}
                        className="p-2 rounded-full"
                        style={{
                          backgroundColor:
                            isSyncingVideo &&
                            !isSessionLeader &&
                            watchTogetherMode
                              ? primary
                              : 'gray',
                        }}>
                        <MaterialIcons
                          name={
                            isSyncingVideo
                              ? 'check-box'
                              : 'check-box-outline-blank'
                          }
                          size={24}
                          color="white"
                        />
                      </TouchableOpacity>
                    </View>
                    {watchTogetherMode && (
                      <View className="mt-4 p-3 border border-green-500 rounded-lg">
                        <Text className="text-green-400 text-sm font-semibold mb-2">
                          Private Room Active: {roomId?.slice(0, 8)}...
                        </Text>
                        <Text className="text-white text-xs mb-2">
                          Only people with this link can join this session:
                        </Text>
                        <Text className="text-blue-300 text-xs">
                          {shareLink}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowNicknameModal(true)}
                    className="p-3 rounded-md items-center"
                    style={{backgroundColor: primary}}>
                    <Text className="text-white font-semibold">
                      Login to Enable Watch Together
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
            {/* Audio tab */}
            {activeTab === 'audio' && (
              <ScrollView className="w-full h-full p-1 px-4">
                <Text className="text-lg font-bold text-center text-white">
                  Audio
                </Text>
                {audioTracks.length === 0 && (
                  <View className="flex justify-center items-center">
                    <Text className="text-white text-xs">
                      Loading audio tracks...
                    </Text>
                  </View>
                )}
                {audioTracks.map((track, i) => (
                  <TouchableOpacity
                    className="flex-row gap-2 items-center rounded-md my-1 overflow-hidden ml-2"
                    key={i}
                    onPress={() => {
                      setSelectedAudioTrack({
                        type: SelectedTrackType.LANGUAGE,
                        value: track.language,
                      });
                      cacheStorage.setString(
                        'lastAudioTrack',
                        track.language || '',
                      );
                      setSelectedAudioTrackIndex(i);
                      setShowSettings(false);
                    }}>
                    <Text
                      className={'text-lg font-semibold'}
                      style={{
                        color:
                          selectedAudioTrackIndex === i ? primary : 'white',
                      }}>
                      {track.language}
                    </Text>
                    <Text
                      className={'text-base italic'}
                      style={{
                        color:
                          selectedAudioTrackIndex === i ? primary : 'white',
                      }}>
                      {track.type}
                    </Text>
                    <Text
                      className={'text-sm italic'}
                      style={{
                        color:
                          selectedAudioTrackIndex === i ? primary : 'white',
                      }}>
                      {track.title}
                    </Text>
                    {selectedAudioTrackIndex === i && (
                      <MaterialIcons name="check" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {/* Subtitle tab */}
            {activeTab === 'subtitle' && (
              <ScrollView className="w-full h-full p-1 px-4">
                <Text className="text-lg font-bold text-center text-white mb-3">
                  Subtitle
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginBottom: 12,
                  }}>
                  <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 13}}>
                    Delay
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                    <TouchableOpacity
                      onPress={() =>
                        setSubtitleDelay(d => Math.max(-5000, d - 500))
                      }
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}>
                      <Text
                        style={{
                          color: 'white',
                          fontSize: 12,
                          fontWeight: '700',
                        }}>
                        −500ms
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        setSubtitleDelay(d => Math.max(-5000, d - 100))
                      }
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}>
                      <Text
                        style={{
                          color: 'white',
                          fontSize: 12,
                          fontWeight: '700',
                        }}>
                        −100
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={{
                        color:
                          subtitleDelay !== 0
                            ? primary
                            : 'rgba(255,255,255,0.45)',
                        fontSize: 13,
                        minWidth: 68,
                        textAlign: 'center',
                        fontVariant: ['tabular-nums'],
                      }}>
                      {subtitleDelay >= 0 ? '+' : ''}
                      {subtitleDelay} ms
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        setSubtitleDelay(d => Math.min(5000, d + 100))
                      }
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}>
                      <Text
                        style={{
                          color: 'white',
                          fontSize: 12,
                          fontWeight: '700',
                        }}>
                        +100
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        setSubtitleDelay(d => Math.min(5000, d + 500))
                      }
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}>
                      <Text
                        style={{
                          color: 'white',
                          fontSize: 12,
                          fontWeight: '700',
                        }}>
                        +500ms
                      </Text>
                    </TouchableOpacity>
                    {subtitleDelay !== 0 && (
                      <TouchableOpacity onPress={() => setSubtitleDelay(0)}>
                        <MaterialIcons
                          name="refresh"
                          size={18}
                          color="rgba(255,255,255,0.45)"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    borderRadius: 6,
                    backgroundColor:
                      selectedTextTrackIndex === 1000
                        ? `${primary}18`
                        : 'transparent',
                    marginBottom: 4,
                  }}
                  onPress={() => {
                    setSelectedTextTrack({type: SelectedTrackType.DISABLED});
                    setSelectedTextTrackIndex(1000);
                    setSelectedExternalSubUri(null);
                    pendingAutoSelectUriRef.current = null;
                    cacheStorage.setString('lastTextTrack', '');
                    setShowSettings(false);
                  }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color:
                        selectedTextTrackIndex === 1000 ? primary : 'white',
                    }}>
                    None
                  </Text>
                  {selectedTextTrackIndex === 1000 && (
                    <MaterialIcons name="check" size={18} color={primary} />
                  )}
                </TouchableOpacity>

                {textTracks.length > 0 && (
                  <>
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.38)',
                        fontSize: 9,
                        fontWeight: '800',
                        letterSpacing: 2,
                        marginTop: 10,
                        marginBottom: 6,
                        marginLeft: 2,
                      }}>
                      STREAM TRACKS
                    </Text>
                    {textTracks.map(track => {
                      const isSelected = selectedTextTrackIndex === track.index;
                      return (
                        <TouchableOpacity
                          key={`stream-${track.index}`}
                          style={{
                            flexDirection: 'row',
                            gap: 8,
                            alignItems: 'center',
                            paddingVertical: 6,
                            paddingHorizontal: 8,
                            borderRadius: 6,
                            backgroundColor: isSelected
                              ? `${primary}18`
                              : 'transparent',
                            marginVertical: 2,
                          }}
                          onPress={() => {
                            setSelectedTextTrack({
                              type: SelectedTrackType.INDEX,
                              value: track.index,
                            });
                            setSelectedTextTrackIndex(track.index);
                            setSelectedExternalSubUri(null);
                            pendingAutoSelectUriRef.current = null;
                            cacheStorage.setString(
                              'lastTextTrack',
                              track.language || '',
                            );
                            setShowSettings(false);
                          }}>
                          <Text
                            style={{
                              color: isSelected ? primary : 'white',
                              fontSize: 14,
                              fontWeight: '600',
                            }}>
                            {track.language || 'Unknown'}
                          </Text>
                          {track.title ? (
                            <Text
                              style={{
                                color: isSelected
                                  ? `${primary}aa`
                                  : 'rgba(255,255,255,0.45)',
                                fontSize: 11,
                                fontStyle: 'italic',
                                flexShrink: 1,
                              }}
                              numberOfLines={1}>
                              {track.title}
                            </Text>
                          ) : null}
                          {track.type ? (
                            <Text
                              style={{
                                color: 'rgba(255,255,255,0.28)',
                                fontSize: 10,
                                textTransform: 'uppercase',
                              }}>
                              {track.type}
                            </Text>
                          ) : null}
                          {isSelected && (
                            <MaterialIcons
                              name="check"
                              size={18}
                              color={primary}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {externalSubs.length > 0 && (
                  <>
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.38)',
                        fontSize: 9,
                        fontWeight: '800',
                        letterSpacing: 2,
                        marginTop: 10,
                        marginBottom: 6,
                        marginLeft: 2,
                      }}>
                      EXTERNAL TRACKS
                    </Text>
                    {externalSubs.map((sub, idx) => {
                      const isSelected =
                        selectedExternalSubUri === sub.uri ||
                        selectedExternalSubUri === sub.url;
                      const isPending =
                        pendingAutoSelectUriRef.current === sub.uri ||
                        pendingAutoSelectUriRef.current === sub.url;
                      const displayLabel =
                        sub.title ||
                        sub.label ||
                        sub.language ||
                        `Track ${idx + 1}`;
                      return (
                        <TouchableOpacity
                          key={`ext-${idx}-${sub.uri ?? sub.url ?? idx}`}
                          style={{
                            flexDirection: 'row',
                            gap: 8,
                            alignItems: 'center',
                            paddingVertical: 6,
                            paddingHorizontal: 8,
                            borderRadius: 6,
                            backgroundColor: isSelected
                              ? `${primary}18`
                              : 'transparent',
                            marginVertical: 2,
                          }}
                          onPress={() => {
                            const uri = sub.uri ?? sub.url ?? '';
                            setSelectedExternalSubUri(uri);
                            const loaded = textTracks.find(
                              (t: any) => t.uri === uri || t.url === uri,
                            );
                            if (loaded) {
                              setSelectedTextTrack({
                                type: SelectedTrackType.INDEX,
                                value: loaded.index,
                              });
                              setSelectedTextTrackIndex(loaded.index);
                              pendingAutoSelectUriRef.current = null;
                            } else {
                              pendingAutoSelectUriRef.current = uri;
                            }
                            setShowSettings(false);
                          }}>
                          <Text
                            style={{
                              color: isSelected ? primary : 'white',
                              fontSize: 14,
                              fontWeight: '600',
                              flexShrink: 1,
                            }}
                            numberOfLines={1}>
                            {displayLabel}
                          </Text>
                          {isPending && (
                            <MaterialIcons
                              name="hourglass-empty"
                              size={14}
                              color="rgba(255,255,255,0.4)"
                            />
                          )}
                          {isSelected && !isPending && (
                            <MaterialIcons
                              name="check"
                              size={18}
                              color={primary}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    gap: 10,
                    alignItems: 'center',
                    marginTop: 14,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.12)',
                  }}
                  onPress={async () => {
                    const wasPlaying = isPlayingRef.current;
                    playerRef.current?.pause();
                    isPlayingRef.current = false;
                    setIsPlaying(false);

                    try {
                      const res = await DocumentPicker.getDocumentAsync({
                        type: [
                          'text/vtt',
                          'application/x-subrip',
                          'text/srt',
                          'application/ttml+xml',
                          '*/*',
                        ],
                        multiple: false,
                      });

                      if (!res.canceled && res.assets?.[0]) {
                        const asset = res.assets[0];
                        const track = {
                          type: asset.mimeType as any,
                          title:
                            asset.name && asset.name.length > 35
                              ? asset.name.slice(0, 35) + '…'
                              : asset.name || 'External',
                          language: 'und',
                          uri: asset.uri,
                        };
                        const uri = addExternalSub(track);
                        pendingAutoSelectUriRef.current = uri;
                        setSelectedExternalSubUri(uri);
                        ToastAndroid.show(
                          'Subtitle added — activating…',
                          ToastAndroid.SHORT,
                        );
                      }
                    } catch (err) {
                      console.log('Subtitle picker error:', err);
                    } finally {
                      if (wasPlaying) {
                        isPlayingRef.current = true;
                        setIsPlaying(true);
                        playerRef.current?.resume();
                      }
                      setShowSettings(false);
                    }
                  }}>
                  <MaterialIcons
                    name="add-circle-outline"
                    size={20}
                    color={primary}
                  />
                  <Text
                    style={{color: 'white', fontSize: 14, fontWeight: '600'}}>
                    Add from file
                  </Text>
                </TouchableOpacity>

                <SearchSubtitles
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  setExternalSubs={(subs: any) => {
                    const incoming = Array.isArray(subs) ? subs : [];
                    if (incoming.length > 0) {
                      const firstUri =
                        incoming[0].uri ?? incoming[0].url ?? null;
                      if (firstUri) {
                        pendingAutoSelectUriRef.current = firstUri;
                        setSelectedExternalSubUri(firstUri);
                      }
                    }
                    setExternalSubs(subs);
                  }}
                />
              </ScrollView>
            )}
            {/* Server & Quality tabs */}
            {activeTab === 'server' && (
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  width: '100%',
                  height: '100%',
                  paddingHorizontal: 16,
                  paddingTop: 4,
                }}>
                <ScrollView
                  style={{
                    borderRightWidth: 1,
                    borderRightColor: 'rgba(255,255,255,0.15)',
                    paddingRight: 8,
                    flex: 1,
                  }}>
                  <View
                    style={{
                      backgroundColor: `${primary}18`,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: `${primary}40`,
                      padding: 10,
                      marginBottom: 10,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.45)',
                        fontSize: 9,
                        fontWeight: '700',
                        letterSpacing: 2,
                        marginBottom: 2,
                      }}>
                      NOW PLAYING
                    </Text>
                    <Text
                      style={{
                        color: primary,
                        fontSize: 22,
                        fontWeight: '900',
                        letterSpacing: 1,
                      }}>
                      {videoTracks && videoTracks.length > 0
                        ? formatQuality(
                            (
                              videoTracks[selectedQualityIndex] ??
                              videoTracks[0]
                            )?.height?.toString() || 'auto',
                          )
                        : 'Auto'}
                    </Text>
                    {videoTracks &&
                      videoTracks.length > 0 &&
                      (videoTracks[selectedQualityIndex] ?? videoTracks[0])
                        ?.bitrate && (
                        <Text
                          style={{
                            color: 'rgba(255,255,255,0.35)',
                            fontSize: 10,
                            marginTop: 2,
                          }}>
                          {Math.round(
                            ((
                              videoTracks[selectedQualityIndex] ??
                              videoTracks[0]
                            )?.bitrate || 0) / 1000,
                          )}{' '}
                          kbps
                        </Text>
                      )}
                  </View>
                  <Text
                    style={{
                      color: 'white',
                      fontSize: 15,
                      fontWeight: '800',
                      textAlign: 'center',
                      marginBottom: 6,
                    }}>
                    Server
                  </Text>
                  {streamData?.length > 0 &&
                    streamData?.map((track, i) => (
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          gap: 8,
                          alignItems: 'center',
                          borderRadius: 6,
                          marginVertical: 4,
                          overflow: 'hidden',
                          marginLeft: 8,
                        }}
                        key={i}
                        onPress={() => {
                          setSelectedStream(track);
                          setShowSettings(false);
                          playerRef?.current?.resume();
                        }}>
                        <Text
                          style={{
                            fontSize: 14,
                            textTransform: 'capitalize',
                            fontWeight: '600',
                            color:
                              track.link === selectedStream.link
                                ? primary
                                : 'white',
                          }}>
                          {track.server}
                        </Text>
                        {track.link === selectedStream.link && (
                          <MaterialIcons
                            name="check"
                            size={20}
                            color={primary}
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                </ScrollView>
                <ScrollView style={{flex: 1, paddingLeft: 8}}>
                  <Text
                    style={{
                      color: 'white',
                      fontSize: 15,
                      fontWeight: '800',
                      textAlign: 'center',
                      marginBottom: 6,
                    }}>
                    Quality
                  </Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      alignItems: 'center',
                      borderRadius: 6,
                      marginVertical: 4,
                      marginLeft: 8,
                    }}
                    onPress={() => {
                      setSelectedVideoTrack({
                        type: SelectedVideoTrackType.AUTO,
                      });
                      setSelectedQualityIndex(1000);
                    }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color:
                          selectedQualityIndex === 1000 ? primary : 'white',
                      }}>
                      Auto
                    </Text>
                    {selectedQualityIndex === 1000 && (
                      <MaterialIcons name="check" size={20} color={primary} />
                    )}
                  </TouchableOpacity>
                  {videoTracks &&
                    videoTracks.map((track: any, i: any) => (
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          gap: 6,
                          alignItems: 'center',
                          borderRadius: 6,
                          marginVertical: 4,
                          overflow: 'hidden',
                          marginLeft: 8,
                        }}
                        key={i}
                        onPress={() => {
                          setSelectedVideoTrack({
                            type: SelectedVideoTrackType.INDEX,
                            value: track.index,
                          });
                          setSelectedQualityIndex(i);
                        }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color:
                              selectedQualityIndex === i ? primary : 'white',
                          }}>
                          {track.height + 'p'}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontStyle: 'italic',
                            color:
                              selectedQualityIndex === i
                                ? primary
                                : 'rgba(255,255,255,0.5)',
                          }}>
                          {Math.round((track.bitrate || 0) / 1000)}k
                          {track?.codecs
                            ? ` · ${track.codecs.split('.')[0]}`
                            : ''}
                        </Text>
                        {selectedQualityIndex === i && (
                          <MaterialIcons
                            name="check"
                            size={18}
                            color={primary}
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}
            {/* Speed tab */}
            {activeTab === 'speed' && (
              <ScrollView className="w-full h-full p-1 px-4">
                <Text className="text-lg font-bold text-center text-white">
                  Playback Speed
                </Text>
                {playbacks.map((rate, i) => (
                  <TouchableOpacity
                    className="flex-row gap-2 items-center rounded-md my-1 overflow-hidden ml-2"
                    key={i}
                    onPress={() => {
                      setBasePlaybackRate(rate);
                      setShowSettings(false);
                    }}>
                    <Text
                      className={'text-lg font-semibold'}
                      style={{
                        color: basePlaybackRate === rate ? primary : 'white',
                      }}>
                      {rate}x
                    </Text>
                    {basePlaybackRate === rate && (
                      <MaterialIcons name="check" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {/* Fast Forward tab */}
            {activeTab === 'fastForward' && (
              <ScrollView className="w-full h-full p-1 px-4">
                <Text className="text-lg font-bold text-center text-white">
                  Fast Forward Speed
                </Text>
                {MOCK_FAST_FORWARD_RATES.map((rate, i) => (
                  <TouchableOpacity
                    className="flex-row gap-2 items-center rounded-md my-1 overflow-hidden ml-2"
                    key={i}
                    onPress={() => {
                      setLocalFastForwardRate(rate);
                      setShowSettings(false);
                    }}>
                    <Text
                      className={'text-lg font-semibold'}
                      style={{
                        color: fastForwardRate === rate ? primary : 'white',
                      }}>
                      {rate}x
                    </Text>
                    {fastForwardRate === rate && (
                      <MaterialIcons name="check" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {/* HDR tab */}
            {activeTab === 'hdr' && (
              <ScrollView className="w-full h-full p-1 px-4">
                <Text className="text-lg font-bold text-center text-white mb-3">
                  HDR Playback
                </Text>
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 12,
                  }}>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.45)',
                      fontSize: 10,
                      fontWeight: '700',
                      letterSpacing: 2,
                      marginBottom: 8,
                    }}>
                    DEVICE SUPPORT
                  </Text>
                  {(
                    [
                      {
                        label: 'HDR10',
                        ok: hdrCapabilities.isHDR10Supported,
                      },
                      {
                        label: 'HLG (Hybrid Log-Gamma)',
                        ok: hdrCapabilities.isHLGSupported,
                      },
                      {
                        label: 'Dolby Vision',
                        ok: hdrCapabilities.isDolbyVisionSupported,
                      },
                    ] as {label: string; ok: boolean}[]
                  ).map(item => (
                    <View
                      key={item.label}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 4,
                      }}>
                      <Text style={{color: 'white', fontSize: 13}}>
                        {item.label}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                        <MaterialIcons
                          name={item.ok ? 'check-circle' : 'cancel'}
                          size={15}
                          color={item.ok ? '#4ade80' : '#f87171'}
                        />
                        <Text
                          style={{
                            color: item.ok ? '#4ade80' : '#f87171',
                            fontSize: 12,
                          }}>
                          {item.ok ? 'Supported' : 'Not Supported'}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {hdrCapabilities.maxLuminance !== null && (
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: 11,
                        marginTop: 6,
                      }}>
                      Peak Luminance: {hdrCapabilities.maxLuminance} nits
                    </Text>
                  )}
                </View>
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                  <MaterialIcons
                    name={hasHDRTracks ? 'hd' : 'sd'}
                    size={22}
                    color={hasHDRTracks ? primary : 'rgba(255,255,255,0.5)'}
                  />
                  <View style={{flex: 1}}>
                    <Text
                      style={{
                        color: hasHDRTracks ? primary : 'white',
                        fontSize: 13,
                        fontWeight: '600',
                      }}>
                      {hasHDRTracks
                        ? 'HDR tracks detected'
                        : 'SDR stream (no HDR tracks)'}
                    </Text>
                    <Text
                      style={{color: 'rgba(255,255,255,0.4)', fontSize: 11}}>
                      {hasHDRTracks
                        ? 'HEVC / AV1 / Dolby Vision codec found in stream'
                        : 'Stream appears to be standard dynamic range only'}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 10,
                    fontWeight: '700',
                    letterSpacing: 2,
                    marginBottom: 8,
                  }}>
                  PLAYBACK MODE
                </Text>
                {(
                  [
                    {
                      mode: 'auto' as HDRMode,
                      label: 'Auto',
                      desc: 'Let the device & stream decide (recommended)',
                      iconName: 'auto-awesome',
                      requiresCap: true,
                    },
                    {
                      mode: 'sdr' as HDRMode,
                      label: 'SDR Only',
                      desc: 'Force standard dynamic range (caps bitrate to 8 Mbps)',
                      iconName: 'brightness-low',
                      requiresCap: true,
                    },
                    {
                      mode: 'hdr10' as HDRMode,
                      label: 'HDR10',
                      desc: 'High dynamic range — wide color & high luminance',
                      iconName: 'wb-sunny',
                      requiresCap: hdrCapabilities.isHDR10Supported,
                    },
                    {
                      mode: 'hlg' as HDRMode,
                      label: 'HLG',
                      desc: 'Hybrid Log-Gamma — broadcast HDR standard',
                      iconName: 'wb-sunny',
                      requiresCap: hdrCapabilities.isHLGSupported,
                    },
                    {
                      mode: 'dolby_vision' as HDRMode,
                      label: 'Dolby Vision',
                      desc: 'Dynamic per-scene HDR metadata',
                      iconName: 'stars',
                      requiresCap: hdrCapabilities.isDolbyVisionSupported,
                    },
                  ] as {
                    mode: HDRMode;
                    label: string;
                    desc: string;
                    iconName: string;
                    requiresCap: boolean;
                  }[]
                ).map(({mode, label, desc, iconName, requiresCap}) => {
                  const isDisabled = !requiresCap;
                  const isSelected = hdrMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      disabled={isDisabled}
                      onPress={() => {
                        setHDRMode(mode);
                        setShowSettings(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderRadius: 8,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        marginBottom: 4,
                        opacity: isDisabled ? 0.3 : 1,
                        backgroundColor: isSelected
                          ? `${primary}22`
                          : 'transparent',
                        borderWidth: isSelected ? 1 : 0,
                        borderColor: isSelected
                          ? `${primary}55`
                          : 'transparent',
                      }}>
                      <MaterialIcons
                        name={iconName as any}
                        size={20}
                        color={isSelected ? primary : 'rgba(255,255,255,0.7)'}
                        style={{marginRight: 10}}
                      />
                      <View style={{flex: 1}}>
                        <Text
                          style={{
                            color: isSelected ? primary : 'white',
                            fontSize: 14,
                            fontWeight: isSelected ? '700' : '400',
                          }}>
                          {label}
                        </Text>
                        <Text
                          style={{
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: 11,
                          }}>
                          {desc}
                        </Text>
                      </View>
                      {isSelected && (
                        <MaterialIcons name="check" size={18} color={primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* Nickname modal */}
      {showNicknameModal && (
        <NicknameInputOverlay
          primary={primary}
          currentNickname={userNickname}
          setNickname={setUserNickname}
          currentPassword={userPassword}
          setPassword={setUserPassword}
          isAuthenticating={isAuthenticating}
          onConfirm={() => {
            const forcedRoomId = route.params?.roomId
              ? decodeURIComponent(route.params.roomId)
              : null;
            const isJoining = !!route.params?.syncLink && !!forcedRoomId;
            handleSetIdentity(
              userNickname,
              userPassword,
              isJoining,
              forcedRoomId,
            );
          }}
        />
      )}
    </SafeAreaView>
  );
};

export default Player;
