// screens/Community.tsx
import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  Keyboard,
  Image,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import * as Notifications from 'expo-notifications'; // 👈 NEW: Link preview library

import {
  communityService,
  CommunityMessage,
  Attachment,
} from '../lib/services/CommunityService';
import {userSession, supabaseClient} from '../lib/services/login';
import useThemeStore from '../lib/zustand/themeStore';
import {useMediaPicker, PendingAttachment} from '../lib/hooks/useMediaPicker';

import UserNamePromptModal from '../components/Community/UserNamePromptModal';
import MessageActionModal from '../components/Community/MessageActionModal';
import ChannelDrawer from '../components/Community/ChannelDrawer';
import ChatInput from '../components/Community/ChatInput';
import MessageItem from '../components/Community/MessageItem';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNELS = [
  'General',
  'Anime',
  'Movie',
  'TV Show',
  'Off-Topic',
  'Suggestions',
  'Help',
];

const isNameInvalid = (user: any): boolean => {
  if (!user) return true;
  const name = (user.name ?? '').trim().toLowerCase();
  return name === '' || name === 'anonymous' || name === 'user';
};

interface Props {
  onClose: () => void;
}

type WindowMode = 'floating' | 'fullscreen' | 'minimized';

const extractLinks = (text: string) => {
  if (!text) return {imageUrl: null, ytVideoId: null, genericUrl: null};

  const imgRegex =
    /(https?:\/\/(?:[^\s]+?\.(?:jpeg|jpg|gif|png|webp)(?:\?[^\s]*)?|[^\s]+?gstatic\.com\/images\?[^\s]+))/i;
  const ytRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube-nocookie\.com\/embed\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
  const genericUrlRegex = /(https?:\/\/[^\s]+)/i; // 👈 NEW: Matches generic URLs

  const imgMatch = text.match(imgRegex);
  const ytMatch = text.match(ytRegex);
  const genericMatch = text.match(genericUrlRegex);

  return {
    imageUrl: imgMatch ? imgMatch[0] : null,
    ytVideoId: ytMatch ? ytMatch[1] : null,
    // 👈 NEW: Only use generic link preview if it's NOT a direct image and NOT a youtube video
    genericUrl: !imgMatch && !ytMatch && genericMatch ? genericMatch[0] : null,
  };
};

const CommunityScreen: React.FC<Props> = ({onClose}) => {
  const {width: SW, height: SH} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {primary} = useThemeStore(state => state);
  const navigation = useNavigation();

  const {pickImage, pickVideo, pickAudio, uploadMedia} = useMediaPicker();
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);

  const [currentUser, setCurrentUser] = useState(userSession.getCurrentUser());
  const [showNamePrompt, setShowNamePrompt] = useState(() =>
    isNameInvalid(currentUser),
  );
  const [tempName, setTempName] = useState(
    !currentUser?.name || currentUser.name === 'Anonymous'
      ? ''
      : currentUser.name,
  );

  const [activeChannel, setActiveChannel] = useState(CHANNELS[0]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedMessage, setSelectedMessage] =
    useState<CommunityMessage | null>(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [windowMode, setWindowMode] = useState<WindowMode>('floating');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CommunityMessage | null>(null);

  const [unreadChannels, setUnreadChannels] = useState<string[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const activeChannelRef = useRef(activeChannel);
  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);
  const initPos = useRef({x: SW * 0.05, y: SH * 0.12});
  const pan = useRef(
    new Animated.ValueXY({x: initPos.current.x, y: initPos.current.y}),
  ).current;
  const initSize = useRef({width: SW * 0.9, height: SH * 0.62});
  const windowSize = useRef(
    new Animated.ValueXY({
      x: initSize.current.width,
      y: initSize.current.height,
    }),
  ).current;
  const bubblePos = useRef(
    new Animated.ValueXY({x: SW - 72, y: SH * 0.4}),
  ).current;
  const bubbleInitPos = useRef({x: SW - 72, y: SH * 0.4});

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        initPos.current.x = (pan.x as any)._value;
        initPos.current.y = (pan.y as any)._value;
      },
      onPanResponderMove: (_, g) => {
        pan.setValue({
          x: Math.max(0, Math.min(initPos.current.x + g.dx, SW - 80)),
          y: Math.max(insets.top, Math.min(initPos.current.y + g.dy, SH - 100)),
        });
      },
      onPanResponderRelease: () => {},
    }),
  ).current;

  const resizePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        initSize.current.width = (windowSize.x as any)._value;
        initSize.current.height = (windowSize.y as any)._value;
      },
      onPanResponderMove: (_, g) => {
        windowSize.setValue({
          x: Math.max(300, Math.min(initSize.current.width + g.dx, SW - 16)),
          y: Math.max(380, Math.min(initSize.current.height + g.dy, SH - 80)),
        });
      },
      onPanResponderRelease: () => {},
    }),
  ).current;

  const bubblePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        bubbleInitPos.current.x = (bubblePos.x as any)._value;
        bubbleInitPos.current.y = (bubblePos.y as any)._value;
      },
      onPanResponderMove: (_, g) => {
        bubblePos.setValue({
          x: Math.max(0, Math.min(bubbleInitPos.current.x + g.dx, SW - 60)),
          y: Math.max(
            insets.top,
            Math.min(bubbleInitPos.current.y + g.dy, SH - 120),
          ),
        });
      },
      onPanResponderRelease: () => {},
    }),
  ).current;

  useEffect(() => {
    Notifications.requestPermissionsAsync();
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const saveName = async () => {
    const newName = tempName.trim();
    if (!newName)
      return Alert.alert('Required', 'Please enter a valid display name.');
    try {
      const base = currentUser ?? {id: `anon_${Date.now()}`, email: ''};
      const updated = {...base, name: newName};
      setCurrentUser(updated as any);
      if (typeof (userSession as any).updateUser === 'function') {
        await (userSession as any).updateUser(updated);
      }
      setShowNamePrompt(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save name. Please try again.');
    }
  };

  useEffect(() => {
    activeChannelRef.current = activeChannel;

    if (!showNamePrompt) {
      loadMessages(activeChannel);
    }
  }, [activeChannel, showNamePrompt]);

  useEffect(() => {
    if (showNamePrompt) return;

    console.log('🔄 Setting up global message listener...');

    const sub = communityService.subscribeToAllMessages(payload => {
      if (payload.eventType === 'INSERT') {
        const newMessage = payload.new as CommunityMessage;

        const currentUser = userSession.getCurrentUser();
        const myUserId = currentUser?.id;

        console.log(`\n=============================`);
        console.log(`📥 NEW MESSAGE IN BACKGROUND`);
        console.log(`📢 Channel: ${newMessage.channel}`);
        console.log(`👤 Sent by User ID: ${newMessage.user_id}`);
        console.log(`📱 My User ID:      ${myUserId}`);
        console.log(`=============================\n`);

        if (newMessage.channel === activeChannelRef.current) {
          console.log(
            '✅ Ignored red dot: You are currently looking at this channel.',
          );
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [newMessage, ...prev];
          });
        } else {
          if (newMessage.user_id !== myUserId) {
            console.log(
              `🔴 SUCCESS! Triggering Red Dot for: ${newMessage.channel}`,
            );

            Alert.alert(
              'Red Dot Triggered!',
              `You have a new message in ${newMessage.channel}`,
            );

            setUnreadChannels(prev => {
              if (prev.includes(newMessage.channel)) return prev;
              return [...prev, newMessage.channel];
            });
          } else {
            console.log(
              '🚫 BLOCKED RED DOT: The app thinks YOU sent this message!',
            );
          }
        }

        if (
          newMessage.reply_to?.user_id === myUserId &&
          newMessage.user_id !== myUserId
        ) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: `Reply from ${newMessage.user_name} in #${newMessage.channel}`,
              body: newMessage.message || 'Sent an attachment',
              data: {
                type: 'chat_reply',
                messageId: newMessage.id,
                channel: newMessage.channel,
              },
            },
            trigger: null,
          });
        }
      }
    });

    return () => {
      console.log('🧹 Cleaning up subscription...');
      communityService.unsubscribeAllMessages();
    };
  }, [showNamePrompt]);

  const loadMessages = async (channel: string) => {
    setLoading(true);
    setMessages([]);
    try {
      const msgs = await communityService.fetchMessages(channel);
      if (activeChannelRef.current === channel) {
        setMessages([...msgs].reverse());
      }
    } catch (error) {
      console.log('Fetch error:', error);
      Alert.alert('Error', 'Could not load messages.');
    } finally {
      if (activeChannelRef.current === channel) {
        setLoading(false);
      }
    }
  };

  const handleAttachPress = () => {
    Alert.alert('Attach Media', 'Choose source', [
      {
        text: '📷  Camera',
        onPress: async () => {
          const res = await pickImage(true);
          if (res) setPendingAttachment(res);
        },
      },
      {
        text: '🖼️  Photo Library',
        onPress: async () => {
          const res = await pickImage(false);
          if (res) setPendingAttachment(res);
        },
      },
      {
        text: '🎬  Video',
        onPress: async () => {
          const res = await pickVideo();
          if (res) setPendingAttachment(res);
        },
      },
      {
        text: '🎵  Audio',
        onPress: async () => {
          const res = await pickAudio();
          if (res) setPendingAttachment(res);
        },
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const handleKeyboardImageSelected = useCallback(
    async ({uri, mime}: {uri: string; mime: string}) => {
      if (!mime.startsWith('image/')) return;
      const pending: PendingAttachment = {
        type: 'image',
        localUri: uri,
        uploading: true,
        uploadedUrl: null,
        mimeType: mime,
      };
      setPendingAttachment(pending);
      try {
        const uploadedUrl = await uploadMedia(uri, mime);
        setPendingAttachment(prev =>
          prev ? {...prev, uploading: false, uploadedUrl} : null,
        );
      } catch (error) {
        Alert.alert(
          'Upload failed',
          'Could not upload the selected image/GIF.',
        );
        setPendingAttachment(null);
      }
    },
    [uploadMedia],
  );

  const handleSendOrEdit = async () => {
    if ((!inputText.trim() && !pendingAttachment) || sending) return;
    if (pendingAttachment?.uploading)
      return Alert.alert('Please wait', 'Media is still uploading…');

    setSending(true);
    try {
      if (editingMessageId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === editingMessageId
              ? {...m, message: inputText.trim(), is_edited: true}
              : m,
          ),
        );
        await communityService.editMessage(editingMessageId, inputText.trim());
        setEditingMessageId(null);
      } else {
        const finalAttachments: Attachment[] = [];
        if (pendingAttachment?.uploadedUrl)
          finalAttachments.push({
            type: pendingAttachment.type,
            url: pendingAttachment.uploadedUrl,
          });

        const replyData = replyingTo
          ? {
              id: replyingTo.id,
              user_id: replyingTo.user_id,
              user_name: replyingTo.user_name,
              message: replyingTo.message,
            }
          : undefined;
        await communityService.sendMessage(
          inputText,
          activeChannel,
          finalAttachments,
          replyData,
        );
      }
      setInputText('');
      setPendingAttachment(null);
      setReplyingTo(null);
    } catch (error: any) {
      Alert.alert(
        'Message Failed',
        error?.message || 'Could not send message. Check your connection.',
      );
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Message', 'Are you sure you want to delete this?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setMessages(prev => prev.filter(m => m.id !== id));
          try {
            await communityService.deleteMessage(id);
          } catch {
            Alert.alert('Error', 'Could not delete message.');
            loadMessages(activeChannel);
          }
        },
      },
    ]);
  };

  const toggleFullScreen = () =>
    setWindowMode(m => (m === 'fullscreen' ? 'floating' : 'fullscreen'));

  const TAB_BAR_HEIGHT =
    Platform.OS === 'ios' ? 50 + insets.bottom : 60 + insets.bottom;
  const isFullScreen = windowMode === 'fullscreen';
  const isMinimized = windowMode === 'minimized';

  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      {showNamePrompt && (
        <UserNamePromptModal
          visible
          tempName={tempName}
          setTempName={setTempName}
          onSave={saveName}
          onCloseChat={onClose}
        />
      )}

      {!showNamePrompt && isMinimized && (
        <Animated.View
          {...bubblePanResponder.panHandlers}
          style={[
            styles.minimizedBubble,
            {transform: bubblePos.getTranslateTransform()},
          ]}>
          <TouchableOpacity
            onPress={() => setWindowMode('floating')}
            style={styles.bubbleInner}
            activeOpacity={0.85}>
            <MaterialCommunityIcons name="chat" size={26} color="#fff" />
            <View style={styles.bubbleBadge}>
              <Text style={styles.bubbleBadgeText}>#</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {!showNamePrompt && !isMinimized && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{flex: 1}}
          pointerEvents="box-none">
          <Animated.View
            pointerEvents="auto"
            style={
              isFullScreen
                ? [
                    styles.fullScreenWindow,
                    {
                      top: insets.top,
                      bottom: isKeyboardVisible ? 0 : TAB_BAR_HEIGHT,
                    },
                  ]
                : [
                    styles.floatingWindow,
                    {
                      transform: [{translateX: pan.x}, {translateY: pan.y}],
                      width: windowSize.x,
                      height: windowSize.y,
                    },
                  ]
            }>
            <View
              {...(isFullScreen ? {} : panResponder.panHandlers)}
              style={styles.header}>
              <TouchableOpacity
                onPress={() => setIsDrawerOpen(true)}
                style={styles.headerBtn}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Ionicons name="menu" size={26} color="#e5e7eb" />
                {unreadChannels.length > 0 && (
                  <View style={styles.menuRedDot} />
                )}
              </TouchableOpacity>

              <View style={styles.headerTitle}>
                <View style={styles.channelDot} />
                <Text style={styles.headerTitleText} numberOfLines={1}>
                  {activeChannel}
                </Text>
              </View>

              <View style={styles.headerActions}>
                {!isFullScreen && (
                  <TouchableOpacity
                    onPress={() => setWindowMode('minimized')}
                    style={styles.headerBtn}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                    <Ionicons name="remove" size={22} color="#9ca3af" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={toggleFullScreen}
                  style={[styles.headerBtn, styles.expandBtn]}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Ionicons
                    name={isFullScreen ? 'contract-outline' : 'expand-outline'}
                    size={20}
                    color="#e5e7eb"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.headerBtn}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Ionicons name="close" size={22} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.messageArea}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    size="large"
                    color={primary ?? '#3b82f6'}
                  />
                  <Text style={styles.loadingText}>Loading messages…</Text>
                </View>
              ) : messages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons
                    name="chat-outline"
                    size={48}
                    color="#374151"
                  />
                  <Text style={styles.emptyText}>No messages yet.</Text>
                  <Text style={styles.emptySubText}>
                    Be the first to say hello! 👋
                  </Text>
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={item => item.id}
                  renderItem={({item}) => {
                    // 👈 NEW: Added genericUrl extraction
                    const {imageUrl, ytVideoId, genericUrl} = extractLinks(
                      item.message,
                    );
                    const isOwn = item.user_id === currentUser?.id;
                    return (
                      <View style={styles.messageWrapper}>
                        <MessageItem
                          item={item}
                          isOwn={isOwn}
                          onSwipeToReply={setReplyingTo}
                          onLongPress={msg => {
                            setSelectedMessage(msg);
                            setActionMenuVisible(true);
                          }}
                        />
                        {/* 👈 NEW: Updated condition to include genericUrl */}
                        {(imageUrl || ytVideoId || genericUrl) && (
                          <View
                            style={[
                              styles.previewContainer,
                              isOwn ? styles.previewOwn : styles.previewOther,
                            ]}>
                            {imageUrl && (
                              <Image
                                source={{uri: imageUrl}}
                                style={styles.previewImage}
                                resizeMode="cover"
                              />
                            )}
                            {ytVideoId && (
                              <View style={styles.ytContainer}>
                                <WebView
                                  source={{
                                    uri: `https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=0&playsinline=1&mute=0`,
                                    headers: {Referer: 'https://localhost'},
                                  }}
                                  style={styles.ytWebView}
                                  allowsInlineMediaPlayback={true}
                                  mediaPlaybackRequiresUserAction={true}
                                  javaScriptEnabled={true}
                                  domStorageEnabled={true}
                                  mixedContentMode="always"
                                />
                              </View>
                            )}
                            {/* 👈 NEW: LinkPreview implementation */}
                            {/* 👈 NEW: LinkPreview implementation */}
                            {genericUrl && (
                              <LinkPreview
                                text={genericUrl}
                                containerStyle={{
                                  backgroundColor: '#f48f55',
                                  borderRadius: 12,
                                  overflow: 'hidden',
                                  width: 260,
                                }}
                                textContainerStyle={{padding: 10}}
                                textStyle={{color: '#ffffff'}} // 👈 ADD THIS: Fixes the black URL text!
                                titleStyle={{
                                  color: '#f3f4f6',
                                  fontSize: 14,
                                  fontWeight: 'bold',
                                }} // White title
                                descriptionStyle={{
                                  color: '#e9eaed',
                                  fontSize: 12,
                                  marginTop: 4,
                                }} // Gray description
                                imageStyle={{width: '100%', height: 140}}
                                metadataContainerStyle={{padding: 0}}
                              />
                            )}
                          </View>
                        )}
                      </View>
                    );
                  }}
                  contentContainerStyle={{paddingTop: 12, paddingBottom: 8}}
                  inverted
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                />
              )}

              {replyingTo && (
                <View style={styles.replyBanner}>
                  <View style={styles.replyBannerLine} />
                  <View style={{flex: 1}}>
                    <Text style={styles.replyBannerName}>
                      Replying to {replyingTo.user_name}
                    </Text>
                    <Text style={styles.replyBannerText} numberOfLines={1}>
                      {replyingTo.message || 'Attachment'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{padding: 8}}
                    onPress={() => setReplyingTo(null)}>
                    <Ionicons name="close" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              )}

              <ChatInput
                inputText={inputText}
                setInputText={setInputText}
                sending={sending}
                editingMessageId={editingMessageId}
                activeChannel={activeChannel}
                paddingBottom={
                  isFullScreen && !isKeyboardVisible ? insets.bottom || 8 : 8
                }
                pendingAttachment={pendingAttachment}
                onSendOrEdit={handleSendOrEdit}
                onCancelEdit={() => {
                  setEditingMessageId(null);
                  setInputText('');
                  setReplyingTo(null);
                }}
                onAttachPress={handleAttachPress}
                onClearAttachment={() => setPendingAttachment(null)}
                onImageSelected={handleKeyboardImageSelected}
              />
            </View>

            <ChannelDrawer
              isOpen={isDrawerOpen}
              onClose={() => setIsDrawerOpen(false)}
              channels={CHANNELS}
              activeChannel={activeChannel}
              unreadChannels={unreadChannels}
              onSelectChannel={ch => {
                setActiveChannel(ch);
                setUnreadChannels(prev => prev.filter(c => c !== ch));
                setIsDrawerOpen(false);
              }}
            />

            {!isFullScreen && (
              <View
                {...resizePanResponder.panHandlers}
                style={styles.resizeEdge}>
                <View style={styles.resizePill} />
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      )}

      {!showNamePrompt && (
        <MessageActionModal
          visible={actionMenuVisible}
          onClose={() => setActionMenuVisible(false)}
          selectedMessage={selectedMessage}
          currentUserId={currentUser?.id}
          onReply={setReplyingTo}
          onEdit={msg => {
            setActionMenuVisible(false);
            setEditingMessageId(msg.id);
            setInputText(msg.message);
          }}
          onDelete={handleDelete}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  floatingWindow: {
    position: 'absolute',
    backgroundColor: '#0d0f12',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
    borderColor: '#1e2530',
    borderWidth: 1,
  },
  fullScreenWindow: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#0d0f12',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1e2530',
    borderBottomWidth: 0,
    overflow: 'hidden',
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2530',
    backgroundColor: '#111318',
  },
  headerBtn: {padding: 6, borderRadius: 8},
  expandBtn: {backgroundColor: '#1e2530', marginHorizontal: 4},
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  channelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  headerTitleText: {
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerActions: {flexDirection: 'row', alignItems: 'center'},
  messageArea: {flex: 1, backgroundColor: '#0d0f12'},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {color: '#6b7280', fontSize: 14},
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 60,
  },
  emptyText: {color: '#4b5563', fontSize: 16, fontWeight: '600', marginTop: 12},
  emptySubText: {color: '#374151', fontSize: 13},
  resizeEdge: {
    height: 26,
    backgroundColor: '#111318',
    borderTopWidth: 1,
    borderTopColor: '#1e2530',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resizePill: {
    width: 44,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
  },
  minimizedBubble: {position: 'absolute', width: 56, height: 56, zIndex: 200},
  bubbleInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 12,
  },
  bubbleBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleBadgeText: {color: '#fff', fontSize: 9, fontWeight: '700'},
  messageWrapper: {marginBottom: 8},
  previewContainer: {
    marginTop: 2,
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: '80%',
  },
  previewOwn: {alignSelf: 'flex-end', marginRight: 12},
  previewOther: {alignSelf: 'flex-start', marginLeft: 52},
  previewImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    marginBottom: 4,
  },
  ytContainer: {
    width: 260,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginBottom: 4,
  },
  ytWebView: {flex: 1, opacity: 0.99},
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111318',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e2530',
  },
  replyBannerLine: {
    width: 3,
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    marginRight: 10,
  },
  replyBannerName: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  replyBannerText: {color: '#9ca3af', fontSize: 13},
  menuRedDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#111318',
    zIndex: 99,
  },
});

export default CommunityScreen;
