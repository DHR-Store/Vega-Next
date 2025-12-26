import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {
  ScrollView,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  Platform,
  TouchableNativeFeedback,
  StatusBar,
  AppState,
  AppStateStatus,
  TextInput,
  Clipboard,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../App';
import {cacheStorage, settingsStorage} from '../../lib/storage';
import {OrientationLocker, LANDSCAPE} from 'react-native-orientation-locker';
import VideoPlayer from '@8man/react-native-media-console';
import {useNavigation} from '@react-navigation/native';
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
import FullScreenChz from 'react-native-fullscreen-chz';

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
  apiKey: 'AIzaSyAesuaUddC4aXLjyMRl7VpFG2-0R36exRU',
  authDomain: 'together-5dde5.firebaseapp.com',
  databaseURL: 'https://together-5dde5-default-rtdb.firebaseio.com',
  projectId: 'together-5dde5',
  storageBucket: 'together-5dde5.appspot.com',
  messagingSenderId: '435182801394',
  appId: '1:435182801394:web:9e283ba6c8949aa70d9b6b',
  measurementId: 'G-ZM6BDPE2M2',
};

// --- UTILITY FOR SANITIZING FIREBASE KEYS ---
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

// --- ROBUST BASE64 IMPLEMENTATION ---
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

// --- STORAGE KEYS ---
const KEY_FF_RATE = 'fastForwardRate';
const KEY_SKIP_INTRO = 'autoSkipIntro';
const KEY_SKIP_DURATION = 'skipIntroDuration';
const KEY_WATCH_TOGETHER = 'watchTogetherMode';
const KEY_USER_NICKNAME = 'userNickname';
const KEY_USER_PASSWORD = 'userPassword';

// --- INITIAL SETTINGS CONSTANTS ---
const DEFAULT_FF_RATE = 2.0;
const DEFAULT_SKIP_INTRO = false;
const DEFAULT_SKIP_DURATION = 85;
const FAST_FORWARD_DELAY_MS = 800;
const MOCK_FAST_FORWARD_RATES = [1.5, 2.0, 3.0, 4.0];

// --- PERSISTENCE LOADERS ---
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

// --- REALTIME SYNC HOOK ---
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

  // Sanitized Session ID (Room ID)
  const safeSessionId = useMemo(
    () => sanitizeFirebaseKey(sessionId),
    [sessionId],
  );

  useEffect(() => {
    const loadFirebaseConfig = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        // YOUR Simple firebase server https://firebase.vercel.app
        const res = await fetch('YOUR FIRE BASE SERVER URL', {
          signal: controller.signal,
          headers: {'Cache-Control': 'no-cache'},
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`Server status: ${res.status}`);
        const cfg = await res.json();
        setFirebaseConfig(cfg);
      } catch (error) {
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
    try {
      // @ts-ignore
      const response = await fetch(chatRef);
      if (!response.ok) return;
      const data = await response.json();
      setRawChatData(data);
      processChatData(data);
    } catch (e) {
      console.error('Error fetching chat:', e);
    }
  }, [chatRef, processChatData]);

  const snapToLeader = useCallback(async () => {
    if (!syncRef) return false;
    try {
      // @ts-ignore
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
        // @ts-ignore
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
    }, 500);

    const syncIntervalId = setInterval(() => {
      fetchSyncTime();
    }, 2000);

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
          // @ts-ignore
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

// --- NICKNAME & PASSWORD INPUT OVERLAY ---
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

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isMovingRef = useRef(false);

  // Animations
  const loadingOpacity = useSharedValue(0);
  const loadingScale = useSharedValue(0.8);
  const loadingRotation = useSharedValue(0);
  const lockButtonTranslateY = useSharedValue(-150);
  const lockButtonOpacity = useSharedValue(0);
  const textVisibility = useSharedValue(0);
  const speedIconOpacity = useSharedValue(1);
  const controlsTranslateY = useSharedValue(150);
  const controlsOpacity = useSharedValue(0);
  const toastOpacity = useSharedValue(0);
  const settingsTranslateY = useSharedValue(10000);
  const settingsOpacity = useSharedValue(0);
  const leftChatButtonTranslateX = useSharedValue(-100);
  const leftChatButtonOpacity = useSharedValue(0);

  const loadingContainerStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
    transform: [{scale: loadingScale.value}],
  }));
  const loadingIconStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${loadingRotation.value}deg`}],
  }));
  const lockButtonStyle = useAnimatedStyle(() => ({
    transform: [{translateY: lockButtonTranslateY.value}],
    opacity: lockButtonOpacity.value,
  }));
  const controlsStyle = useAnimatedStyle(() => ({
    transform: [{translateY: controlsTranslateY.value}],
    opacity: controlsOpacity.value,
  }));
  const toastStyle = useAnimatedStyle(() => ({opacity: toastOpacity.value}));
  const settingsStyle = useAnimatedStyle(() => ({
    transform: [{translateY: settingsTranslateY.value}],
    opacity: settingsOpacity.value,
  }));
  const leftChatButtonStyle = useAnimatedStyle(() => ({
    transform: [{translateX: leftChatButtonTranslateX.value}],
    opacity: leftChatButtonOpacity.value,
  }));

  const initialActiveEpisode = useMemo(() => {
    const fromList = route.params?.episodeList?.[route.params.linkIndex];
    if (fromList) return fromList;
    const link = route.params?.link || route.params?.video_id;
    if (link) {
      const titleFromLink = route.params?.primaryTitle
        ? decodeURIComponent(route.params.primaryTitle)
        : route.params?.title || 'Shared Video';
      return {
        title: titleFromLink,
        link: link,
        poster: route.params?.poster?.poster || null,
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
  ]);

  const [activeEpisode, setActiveEpisode] = useState(initialActiveEpisode);

  useEffect(() => {
    if (initialActiveEpisode?.link !== activeEpisode?.link) {
      setActiveEpisode(initialActiveEpisode);
    }
  }, [initialActiveEpisode, activeEpisode]);

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
    isLoading: streamLoading,
    error: streamError,
    switchToNextStream,
  } = useStream({
    activeEpisode,
    routeParams: route.params,
    provider: streamProvider,
  });

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

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const {
    showControls,
    setShowControls,
    showSettings,
    setShowSettings,
    activeTab,
    setActiveTab,
    resizeMode,
    playbackRate: basePlaybackRate,
    setPlaybackRate: setBasePlaybackRate,
    isPlayerLocked,
    showUnlockButton,
    isTextVisible,
    handleResizeMode,
    togglePlayerLock,
    handleLockedScreenTap,
    unlockButtonTimerRef,
  } = usePlayerSettings();

  const [autoSkipIntro, setAutoSkipIntroState] = useState(getAutoSkipIntro());
  const [skipDuration, setSkipDurationState] = useState(getSkipIntroDuration());
  const hasSkippedIntroRef = useRef(false);
  const lastActiveEpisodeRef = useRef(activeEpisode?.link);

  // --- DEFINED VIDEO ID UPFRONT FOR STORAGE KEYS ---
  const videoId =
    route.params?.link || route.params?.video_id || activeEpisode?.link || '';

  // --- WATCH TOGETHER STATE ---
  const [watchTogetherMode, setWatchTogetherModeState] = useState(
    getWatchTogetherMode(),
  );
  const [showChatOverlay, setShowChatOverlay] = useState(false);
  const [isSessionLeader, setIsSessionLeader] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  // IDENTITY
  const [userNickname, setUserNickname] = useState(getUserNickname());
  const [userPassword, setUserPassword] = useState(getUserPassword());
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [chatMessage, setChatMessage] = useState('');
  const [isSyncingVideo, setIsSyncingVideo] = useState(false);

  // --- ROOM ID MANAGEMENT (PERSISTENT & QUICK) ---
  const roomStorageKey = `room_session_${sanitizeFirebaseKey(videoId)}`;

  // Initialize Room ID: Check Params (Link) -> Storage (History) -> Null
  const [roomId, setRoomId] = useState<string | null>(() => {
    if (route.params?.roomId) {
      return decodeURIComponent(route.params.roomId);
    }
    // Check if we have a saved session for this specific video
    const savedRoomId = cacheStorage.getString(roomStorageKey);
    return savedRoomId || null;
  });

  // --- SELF-HEALING ROOM ID GENERATION ---
  // If watch mode is ON but RoomID is missing, generate it immediately.
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

  // --- SYNC HOOK INIT ---
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
        // Validation check
        if (!userNickname || !userPassword) {
          setShowNicknameModal(true);
          return;
        }

        // --- FIXED LOGIC: GENERATE IMMEDIATELY BEFORE SETTING MODE ---
        // This ensures the view has an ID to display immediately
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

  // --- AUTH HANDLER ---
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
          // User exists, check password
          if (userData.password === pass.trim()) {
            authSuccess = true;
          } else {
            Alert.alert(
              'Authentication Failed',
              'Nickname is already taken and password does not match.',
            );
          }
        } else {
          // Register new user
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

          // Apply joining logic
          if (isJoining && forcedRoomId) {
            setRoomId(forcedRoomId);
            // Save for history if we joined a link
            cacheStorage.setString(roomStorageKey, forcedRoomId);

            setWatchTogetherModeState(true);
            setIsSessionLeader(false);
            setIsSyncingVideo(true);
            ToastAndroid.show('Joined Private Room!', ToastAndroid.SHORT);
          } else if (!isJoining && !roomId) {
            // Started as leader, check storage or generate IMMEDIATELY
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

  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [fastForwardRate, setLocalFastForwardRateState] = useState(
    getFastForwardRate(),
  );

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

  const finalPlaybackRate = useMemo(() => {
    return isFastForwarding ? fastForwardRate : basePlaybackRate;
  }, [isFastForwarding, fastForwardRate, basePlaybackRate]);

  const handleTouchStart = useCallback(
    (e: any) => {
      touchStartXRef.current = e.nativeEvent.pageX;
      touchStartYRef.current = e.nativeEvent.pageY;
      isMovingRef.current = false;
      if (
        !isPlayerLocked &&
        !showControls &&
        !showSettings &&
        !showChatOverlay &&
        playerRef.current
      ) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
          if (!isMovingRef.current) {
            setIsFastForwarding(true);
            setToastMessage(`Fast Forward ${fastForwardRate.toFixed(1)}x`);
            setShowToast(true);
            longPressTimerRef.current = null;
          } else {
            longPressTimerRef.current = null;
          }
        }, FAST_FORWARD_DELAY_MS);
      }
    },
    [
      isPlayerLocked,
      showControls,
      showSettings,
      showChatOverlay,
      fastForwardRate,
      setShowToast,
      setToastMessage,
    ],
  );

  const handleTouchMove = useCallback(
    (e: any) => {
      const deltaX = Math.abs(e.nativeEvent.pageX - touchStartXRef.current);
      const deltaY = Math.abs(e.nativeEvent.pageY - touchStartYRef.current);
      const MIN_MOVE_DISTANCE = 10;
      if (deltaX > MIN_MOVE_DISTANCE || deltaY > MIN_MOVE_DISTANCE) {
        isMovingRef.current = true;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (isFastForwarding) {
          setIsFastForwarding(false);
          setShowToast(false);
        }
      }
    },
    [isFastForwarding, setShowToast],
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isFastForwarding) {
      setIsFastForwarding(false);
      setShowToast(false);
    }
    setTimeout(() => {
      isMovingRef.current = false;
    }, 50);
  }, [isFastForwarding, setShowToast]);

  const {videoPositionRef, handleProgress: baseHandleProgress} =
    usePlayerProgress({
      activeEpisode,
      routeParams: route.params,
      playbackRate: finalPlaybackRate,
      updatePlaybackInfo,
    });

  const lastSyncSendRef = useRef<number>(0);

  const handleProgress = useCallback(
    (data: any) => {
      baseHandleProgress(data);
      const now = Date.now();
      if (
        watchTogetherMode &&
        isSessionLeader &&
        now - lastSyncSendRef.current > 10000
      ) {
        sendTimeUpdate(data.currentTime, isPlaying);
        lastSyncSendRef.current = now;
      }
    },
    [
      baseHandleProgress,
      watchTogetherMode,
      isSessionLeader,
      sendTimeUpdate,
      isPlaying,
    ],
  );

  // --- INITIAL JOIN LOGIC (SYNC LINK) ---
  useEffect(() => {
    const paramsRoomId = route.params?.roomId
      ? decodeURIComponent(route.params.roomId)
      : null;
    if (route.params?.syncLink && paramsRoomId) {
      if (!userNickname || !userPassword) {
        // If joining with link but no auth, show modal
        setShowNicknameModal(true);
      } else {
        // Auto-join if credentials exist
        setRoomId(paramsRoomId);
        // Save joined room to history
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

  useEffect(() => {
    if (
      watchTogetherMode &&
      !isSessionLeader &&
      remoteTime !== null &&
      playerRef.current
    ) {
      if (isSyncingVideo) {
        const localTime = videoPositionRef.current.position;
        const timeDifference = Math.abs(localTime - remoteTime);

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
    videoPositionRef.current.position,
    isSyncingVideo,
  ]);

  useEffect(() => {
    if (autoSkipIntro && !hasSkippedIntroRef.current) {
      const currentPositionSeconds = videoPositionRef.current.position;
      if (activeEpisode?.link !== lastActiveEpisodeRef.current) {
        hasSkippedIntroRef.current = false;
        lastActiveEpisodeRef.current = activeEpisode?.link;
      }
      if (
        currentPositionSeconds > 1 &&
        currentPositionSeconds <= skipDuration
      ) {
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
  }, [
    videoPositionRef.current.position,
    autoSkipIntro,
    skipDuration,
    activeEpisode?.link,
  ]);

  const playbacks = useMemo(
    () => [0.25, 0.5, 1.0, 1.25, 1.35, 1.5, 1.75, 2],
    [],
  );

  // --- SHARE LINK GENERATION ---
  const contentInfoUrl = route.params?.infoUrl || '';
  const contentProviderValue = route.params?.providerValue || provider.value;
  const contentPrimaryTitle =
    route.params?.primaryTitle || activeEpisode?.title || 'Shared Video';
  const currentTime = Math.floor(videoPositionRef.current.position);

  const urlSafeTitle = encodeURIComponent(contentPrimaryTitle);
  const urlSafeInfoUrl = encodeURIComponent(contentInfoUrl);
  const urlSafeProvider = encodeURIComponent(contentProviderValue);
  const urlSafeRoomId = encodeURIComponent(roomId || '');

  // Include roomId in share link to ensure privacy
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

  const handleVideoError = useCallback(
    (e: any) => {
      console.log('PlayerError', e);
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
    ],
  );

  const handleRestorePIP = useCallback(() => {
    setBasePlaybackRate(1.0);
    FullScreenChz.enable();
    setShowPlayer(false);
    setTimeout(() => {
      setKeyForPlayer(prev => prev + 1);
      setShowPlayer(true);
      setTimeout(() => {
        playerRef?.current?.resume();
        setIsPlaying(true);
      }, 75);
    }, 300);
  }, [setBasePlaybackRate]);

  useEffect(() => {
    return () => {
      playerRef?.current?.pause();
      if (unlockButtonTimerRef.current)
        clearTimeout(unlockButtonTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, [unlockButtonTimerRef]);

  useEffect(() => {
    FullScreenChz.enable();
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      FullScreenChz.disable();
      playerRef?.current?.pause();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        nextAppState.match(/inactive|background/) &&
        playerRef.current &&
        !isPlayerLocked &&
        !showSettings
      ) {
        playerRef.current.enterPictureInPicture();
      }
    };
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [isPlayerLocked, showSettings]);

  useEffect(() => {
    setSelectedAudioTrackIndex(0);
    setSelectedTextTrackIndex(1000);
    setSelectedQualityIndex(1000);
    hasSetInitialTracksRef.current = false;
  }, [
    selectedStream,
    activeEpisode,
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

  useEffect(() => {
    if (streamLoading) {
      loadingOpacity.value = withTiming(1, {duration: 800});
      loadingScale.value = withTiming(1, {duration: 800});
      loadingRotation.value = withRepeat(
        withSequence(
          withDelay(500, withTiming(180, {duration: 900})),
          withTiming(180, {duration: 600}),
          withTiming(360, {duration: 900}),
          withTiming(360, {duration: 600}),
        ),
        -1,
      );
    }
  }, [streamLoading]);

  useEffect(() => {
    const shouldShow =
      (isPlayerLocked && showUnlockButton) || (!isPlayerLocked && showControls);
    lockButtonTranslateY.value = withTiming(shouldShow ? 0 : -150, {
      duration: 250,
    });
    lockButtonOpacity.value = withTiming(shouldShow ? 1 : 0, {duration: 250});
  }, [isPlayerLocked, showUnlockButton, showControls]);

  useEffect(() => {
    const shouldShowLeftChat =
      watchTogetherMode && !isPlayerLocked && !showChatOverlay && !showSettings;
    leftChatButtonTranslateX.value = withTiming(shouldShowLeftChat ? 0 : -100, {
      duration: 250,
    });
    leftChatButtonOpacity.value = withTiming(shouldShowLeftChat ? 1 : 0, {
      duration: 250,
    });
  }, [watchTogetherMode, isPlayerLocked, showChatOverlay, showSettings]);

  useEffect(() => {
    textVisibility.value = withTiming(isTextVisible ? 1 : 0, {duration: 250});
    if (isTextVisible) {
      speedIconOpacity.value = withRepeat(
        withSequence(
          withTiming(1, {duration: 250}),
          withTiming(0, {duration: 150}),
          withTiming(1, {duration: 150}),
        ),
        -1,
      );
    } else {
      speedIconOpacity.value = withTiming(1, {duration: 150});
    }
  }, [isTextVisible]);

  useEffect(() => {
    controlsTranslateY.value = withTiming(showControls ? 0 : 150, {
      duration: 250,
    });
    controlsOpacity.value = withTiming(showControls ? 1 : 0, {duration: 250});
  }, [showControls]);

  useEffect(() => {
    toastOpacity.value = withTiming(showToast ? 1 : 0, {duration: 250});
  }, [showToast]);

  useEffect(() => {
    settingsTranslateY.value = withTiming(showSettings ? 0 : 5000, {
      duration: 250,
    });
    settingsOpacity.value = withTiming(showSettings ? 1 : 0, {duration: 250});
  }, [showSettings]);

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

  const videoPlayerProps = useMemo(
    () => ({
      disableGesture: isPlayerLocked || !enableSwipeGesture,
      doubleTapTime: 200,
      disableSeekButtons: isPlayerLocked || hideSeekButtons,
      showOnStart: !isPlayerLocked,
      source: {
        textTracks: externalSubs,
        uri: selectedStream?.link || '',
        bufferConfig: {backBufferDurationMs: 30000},
        shouldCache: true,
        ...(selectedStream?.type === 'm3u8' && {type: 'm3u8'}),
        headers: selectedStream?.headers,
        metadata: {
          title: route.params?.primaryTitle || activeEpisode?.title || '',
          subtitle: activeEpisode?.title || '',
          artist: activeEpisode?.title || '',
          description: activeEpisode?.title || '',
          imageUri: route.params?.poster?.poster,
        },
      },
      onProgress: handleProgress,
      paused: !isPlaying,
      onLoad: (data: any) => {
        if (initialSeekTime > 0) {
          playerRef?.current?.seek(initialSeekTime);
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
        if (isPlaying) {
          playerRef?.current?.resume();
        }
        setBasePlaybackRate(1.0);
      },
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
        if (showChatOverlay) setShowChatOverlay(false);
      },
      onHideControls: () => setShowControls(false),
      rewindTime: 10,
      isFullscreen: true,
      disableFullscreen: true,
      disableVolume: true,
      showHours: true,
      progressUpdateInterval: 1000,
      showNotificationControls: showMediaControls,
      onError: handleVideoError,
      resizeMode,
      selectedAudioTrack,
      onAudioTracks: (e: any) => processAudioTracks(e.audioTracks),
      selectedTextTrack,
      onTextTracks: (e: any) => setTextTracks(e.textTracks),
      onVideoTracks: (e: any) => processVideoTracks(e.videoTracks),
      selectedVideoTrack,
      style: {flex: 1, zIndex: 100},
      controlAnimationTiming: 357,
      controlTimeoutDelay: 10000,
      hideAllControlls: isPlayerLocked && !isSyncingVideo,
      onPlaybackStateChanged: (e: any) => {
        const playing = e.isPlaying;
        setIsPlaying(playing);
        if (watchTogetherMode && isSessionLeader) {
          sendTimeUpdate(videoPositionRef.current.position, playing);
        }
      },
    }),
    [
      isPlayerLocked,
      enableSwipeGesture,
      hideSeekButtons,
      externalSubs,
      selectedStream,
      route.params,
      activeEpisode,
      handleProgress,
      initialSeekTime,
      finalPlaybackRate,
      setBasePlaybackRate,
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
      handleRestorePIP,
      showChatOverlay,
      isPlaying,
      watchTogetherMode,
      isSessionLeader,
      sendTimeUpdate,
      videoPositionRef,
      isSyncingVideo,
    ],
  );

  const handleSendChat = () => {
    if (chatMessage.trim()) {
      sendChat(chatMessage.trim());
      setChatMessage('');
    }
  };

  if (streamLoading) {
    return (
      <SafeAreaView
        edges={{right: 'off', top: 'off', left: 'off', bottom: 'off'}}
        className="bg-black flex-1 justify-center items-center">
        <StatusBar translucent={true} hidden={true} />
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
        <StatusBar translucent={true} hidden={true} />
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

  if (!activeEpisode?.link) {
    return (
      <SafeAreaView className="bg-black flex-1 justify-center items-center">
        <StatusBar translucent={true} hidden={true} />
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
      <StatusBar translucent={true} hidden={true} />
      <OrientationLocker orientation={LANDSCAPE} />

      <View
        className="flex-1"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}>
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1"
          onTouchStart={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}>
          {showPlayer && (
            <VideoPlayer key={keyForPlayer} {...videoPlayerProps} />
          )}
        </TouchableOpacity>

        {isPlayerLocked && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleLockedScreenTap}
            className="absolute top-0 left-0 right-0 bottom-0 z-40 bg-transparent"
          />
        )}

        {watchTogetherMode && showChatOverlay && !isPlayerLocked && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowChatOverlay(false)}
            className="absolute top-0 left-0 right-0 bottom-0 z-49 bg-transparent"
            style={{zIndex: 49}}
          />
        )}

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
                    Clipboard.setString(shareLink);
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
              ref={ref => ref?.scrollToEnd({animated: true})}>
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

        {!streamLoading && !Platform.isTV && (
          <Animated.View
            style={[lockButtonStyle]}
            className="absolute top-5 right-5 flex-row items-center gap-4 z-50">
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
              onPress={togglePlayerLock}
              className="opacity-70 p-2 rounded-full">
              <MaterialIcons
                name={isPlayerLocked ? 'lock' : 'lock-open'}
                color={'hsl(0, 0%, 70%)'}
                size={24}
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        {!streamLoading &&
          !Platform.isTV &&
          watchTogetherMode &&
          !isPlayerLocked && (
            <Animated.View
              style={[leftChatButtonStyle, {top: '55%'}]}
              className="absolute left-5 z-50">
              <TouchableOpacity
                onPress={() => setShowChatOverlay(true)}
                className="opacity-70 p-3 rounded-full bg-black/50"
                onTouchStart={e => e.stopPropagation()}
                onTouchEnd={e => e.stopPropagation()}>
                <MaterialIcons name="chat" size={28} color={'white'} />
              </TouchableOpacity>
            </Animated.View>
          )}

        {!isPlayerLocked && (
          <Animated.View
            style={[controlsStyle]}
            className="absolute bottom-3 right-6 flex flex-row justify-center w-full gap-x-12">
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

            <TouchableOpacity
              className="flex-row gap-1 items-center opacity-60"
              onPress={() => {
                setActiveTab('fastForward');
                setShowSettings(!showSettings);
              }}>
              <MaterialIcons name="fast-forward" size={25} color="white" />
              <Text className="text-xs text-white capitalize">
                ({fastForwardRate.toFixed(1)}x)
              </Text>
            </TouchableOpacity>

            {!Platform.isTV && (
              <TouchableOpacity
                className="flex-row gap-1 items-center opacity-60"
                onPress={() => {
                  playerRef?.current?.enterPictureInPicture();
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
              <MaterialIcons name="fit-screen" size={28} color="white" />
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

            {route.params?.episodeList?.indexOf(activeEpisode) <
              route.params?.episodeList?.length - 1 &&
              videoPositionRef.current.position /
                videoPositionRef.current.duration >
                0.7 && (
                <TouchableOpacity
                  className="flex-row items-center opacity-60"
                  onPress={handleNextEpisode}>
                  <Text className="text-white text-base">Next</Text>
                  <MaterialIcons name="skip-next" size={28} color="white" />
                </TouchableOpacity>
              )}
          </Animated.View>
        )}
      </View>

      <Animated.View
        style={[toastStyle]}
        pointerEvents="none"
        className="absolute w-full top-12 justify-center items-center px-2 z-50">
        <Text className="text-white bg-black/70 p-2 rounded-full text-base font-semibold">
          {toastMessage}
        </Text>
      </Animated.View>

      {!streamLoading && !isPlayerLocked && showSettings && (
        <Animated.View
          style={[settingsStyle]}
          className="absolute opacity-0 top-0 left-0 w-full h-full bg-black/20 justify-end items-center"
          onTouchEnd={() => setShowSettings(false)}>
          <View
            className="bg-black p-3 w-[600px] h-72 rounded-t-lg flex-row justify-start items-center"
            onTouchEnd={e => e.stopPropagation()}>
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

            {activeTab === 'subtitle' && (
              <ScrollView className="w-full h-full p-1 px-4">
                <Text className="text-lg font-bold text-center text-white">
                  Subtitle
                </Text>
                <TouchableOpacity
                  className="flex-row gap-2 items-center rounded-md my-1 overflow-hidden ml-3"
                  onPress={() => {
                    setSelectedTextTrack({type: SelectedTrackType.DISABLED});
                    setSelectedTextTrackIndex(1000);
                    cacheStorage.setString('lastTextTrack', '');
                    setShowSettings(false);
                  }}>
                  <Text
                    className="text-base font-semibold"
                    style={{
                      color:
                        selectedTextTrackIndex === 1000 ? primary : 'white',
                    }}>
                    Disabled
                  </Text>
                </TouchableOpacity>
                {textTracks.map(track => (
                  <TouchableOpacity
                    className="flex-row gap-2 items-center rounded-md my-1 overflow-hidden ml-2"
                    key={track.index}
                    onPress={() => {
                      setSelectedTextTrack({
                        type: SelectedTrackType.INDEX,
                        value: track.index,
                      });
                      setSelectedTextTrackIndex(track.index);
                      cacheStorage.setString(
                        'lastTextTrack',
                        track.language || '',
                      );
                      setShowSettings(false);
                    }}>
                    <Text
                      className={'text-base font-semibold'}
                      style={{
                        color:
                          selectedTextTrackIndex === track.index
                            ? primary
                            : 'white',
                      }}>
                      {track.language}
                    </Text>
                    <Text
                      className={'text-sm italic'}
                      style={{
                        color:
                          selectedTextTrackIndex === track.index
                            ? primary
                            : 'white',
                      }}>
                      {track.type}
                    </Text>
                    <Text
                      className={'text-sm italic text-white'}
                      style={{
                        color:
                          selectedTextTrackIndex === track.index
                            ? primary
                            : 'white',
                      }}>
                      {track.title}
                    </Text>
                    {selectedTextTrackIndex === track.index && (
                      <MaterialIcons name="check" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  className="flex-row gap-2 items-center rounded-md my-1 overflow-hidden ml-2"
                  onPress={async () => {
                    try {
                      const res = await DocumentPicker.getDocumentAsync({
                        type: [
                          'text/vtt',
                          'application/x-subrip',
                          'text/srt',
                          'application/ttml+xml',
                        ],
                        multiple: false,
                      });
                      if (!res.canceled && res.assets?.[0]) {
                        const asset = res.assets[0];
                        const track = {
                          type: asset.mimeType as any,
                          title:
                            asset.name && asset.name.length > 20
                              ? asset.name.slice(0, 20) + '...'
                              : asset.name || 'undefined',
                          language: 'und',
                          uri: asset.uri,
                        };
                        setExternalSubs((prev: any) => [track, ...prev]);
                      }
                    } catch (err) {
                      console.log(err);
                    }
                  }}>
                  <MaterialIcons name="add" size={20} color="white" />
                  <Text className="text-base font-semibold text-white">
                    Add external file
                  </Text>
                </TouchableOpacity>
                <SearchSubtitles
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  setExternalSubs={setExternalSubs}
                />
              </ScrollView>
            )}

            {activeTab === 'server' && (
              <View className="flex flex-row w-full h-full p-1 px-4">
                <ScrollView className="border-r border-white/50">
                  <Text className="w-full text-center text-white text-lg font-extrabold">
                    Server
                  </Text>
                  {streamData?.length > 0 &&
                    streamData?.map((track, i) => (
                      <TouchableOpacity
                        className="flex-row gap-2 items-center rounded-md my-1 overflow-hidden ml-2"
                        key={i}
                        onPress={() => {
                          setSelectedStream(track);
                          setShowSettings(false);
                          playerRef?.current?.resume();
                        }}>
                        <Text
                          className={'text-base capitalize font-semibold'}
                          style={{
                            color:
                              track.link === selectedStream.link
                                ? primary
                                : 'white',
                          }}>
                          {track.server}
                        </Text>
                        {track.link === selectedStream.link && (
                          <MaterialIcons name="check" size={20} color="white" />
                        )}
                      </TouchableOpacity>
                    ))}
                </ScrollView>
                <ScrollView>
                  <Text className="w-full text-center text-white text-lg font-extrabold">
                    Quality
                  </Text>
                  {videoTracks &&
                    videoTracks.map((track: any, i: any) => (
                      <TouchableOpacity
                        className="flex-row gap-2 items-center rounded-md my-1 overflow-hidden ml-2"
                        key={i}
                        onPress={() => {
                          setSelectedVideoTrack({
                            type: SelectedVideoTrackType.INDEX,
                            value: track.index,
                          });
                          setSelectedQualityIndex(i);
                        }}>
                        <Text
                          className={'text-base font-semibold'}
                          style={{
                            color:
                              selectedQualityIndex === i ? primary : 'white',
                          }}>
                          {track.height + 'p'}
                        </Text>
                        <Text
                          className={'text-sm italic'}
                          style={{
                            color:
                              selectedQualityIndex === i ? primary : 'white',
                          }}>
                          {'Bitrate-' +
                            track.bitrate +
                            ' | Codec-' +
                            (track?.codecs || 'unknown')}
                        </Text>
                        {selectedQualityIndex === i && (
                          <MaterialIcons name="check" size={20} color="white" />
                        )}
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}

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
          </View>
        </Animated.View>
      )}

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
