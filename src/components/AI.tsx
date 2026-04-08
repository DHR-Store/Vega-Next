// components/AI.tsx

import React, {useState, useEffect, useRef, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  ToastAndroid,
  DeviceEventEmitter,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Easing,
  Image,
  StatusBar,
} from 'react-native';
import {MaterialCommunityIcons, Feather, Ionicons} from '@expo/vector-icons';
import useThemeStore from '../lib/zustand/themeStore';
import {MMKV} from '../lib/Mmkv';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- API KEYS ---
// WARNING: NEVER HARDCODE SECURE KEYS IN PRODUCTION. This is for example/internal use only.
const GROQ_API_KEY = 'YOUR_GROQ_API_KEY';
const TMDB_API_KEY = 'YOUR_TMDB_API_KEY';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

// Slider configuration
const SLIDER_CARD_WIDTH = SCREEN_WIDTH * 0.7;
const SLIDER_CARD_MARGIN = 8;
const SLIDER_SNAP_INTERVAL = SLIDER_CARD_WIDTH + SLIDER_CARD_MARGIN * 2;

const EDGE_BUFFER_TOP = 40;
const EDGE_BUFFER_BOTTOM = 100;
const EDGE_BUFFER_SIDES = 10;

const CHAT_SESSIONS_KEY = 'vega_ai_chat_sessions';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: any[];
  name?: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
}

interface AIProps {
  currentRoute: string;
  onNavigateToHistory: () => void;
}

const TypingIndicator = React.memo(() => {
  const {primary} = useThemeStore(state => state);
  const opacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [opacity]);

  const dotStyle = [styles.typingDot, {backgroundColor: primary, opacity}];

  return (
    <View style={styles.typingContainer}>
      <Animated.View style={dotStyle} />
      <Animated.View style={dotStyle} />
      <Animated.View style={dotStyle} />
    </View>
  );
});

export const formatTime = (ts: number) => {
  const d = new Date(ts);
  let hours = d.getHours();
  let minutes: any = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return hours + ':' + minutes + ' ' + ampm;
};

// --- MAIN AI COMPONENT ---
const AI = ({currentRoute, onNavigateToHistory}: AIProps) => {
  const {primary} = useThemeStore(state => state);

  const [isEnabled, setIsEnabled] = useState(
    MMKV.getBool('isAIEnabled') || false,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const initialGreeting = useMemo<Message[]>(
    () => [
      {
        id: 'system_0',
        role: 'system',
        content: `You are Vega-Next AI, an expert in movies, TV shows, and anime.

SYSTEM DESIGN:
- You generate TEXT ONLY.
- Images are handled separately by the UI using TMDB data.
- Your response must be clean, structured, and visually organized.

----------------------------------------

YOUR ROLE:

Provide high-quality, structured information using a modern, premium format.

For EACH item, follow this structure EXACTLY:

━━━━━━━━━━━━━━━━━━
🎬 Title: <Title Name>

📅 Release Date: <Date>
⭐ Rating: <Rating>/10
🎭 Genre: <Genre(s) if available>

📝 Synopsis:
<2–3 line short, engaging description>

━━━━━━━━━━━━━━━━━━

----------------------------------------

STRICT RULES & TOOLS:

1. If the user asks for a LIST or RECOMMENDATIONS, you MUST use the \`search_entertainment\` tool for EVERY SINGLE ITEM you mention so that the UI can display posters properly.
2. NEVER include:
   - Image markdown (![]())
   - Any URLs
   - "Poster:" text
   - HTML tags
3. ALWAYS:
   - Use tool (TMDB) data if available
   - Keep values accurate (no hallucination)
   - Keep synopsis short (max 2–3 lines)
4. If some fields are missing:
   - Skip that field (do NOT write "N/A")

Only answer entertainment-related queries.`,
        timestamp: Date.now(),
      },
      {
        id: 'init_1',
        role: 'assistant',
        content: `Hello, I am the Vega-Next AI. How can I assist you in the world of entertainment today?`,
        timestamp: Date.now(),
      },
    ],
    [],
  );

  useEffect(() => {
    const loadSessions = () => {
      const saved = MMKV.getString(CHAT_SESSIONS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSessions(parsed);
          if (parsed.length > 0) {
            setActiveSessionId(parsed[0].id);
          } else {
            createNewSession();
          }
          return;
        } catch (e) {
          console.error('Error parsing chat history', e);
        }
      }
      createNewSession();
    };

    loadSessions();

    const eventListener = DeviceEventEmitter.addListener(
      'loadChatSession',
      (sessionId: string) => {
        setActiveSessionId(sessionId);
        setIsOpen(true);
      },
    );

    const toggleListener = DeviceEventEmitter.addListener(
      'toggleAIAssistant',
      value => {
        setIsEnabled(value);
        if (!value) setIsOpen(false);
      },
    );

    return () => {
      eventListener.remove();
      toggleListener.remove();
    };
  }, []);

  const createNewSession = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      updatedAt: Date.now(),
      messages: initialGreeting,
    };

    setSessions(prev => {
      const updated = [newSession, ...prev];
      MMKV.setString(CHAT_SESSIONS_KEY, JSON.stringify(updated));
      return updated;
    });
    setActiveSessionId(newSession.id);
  };

  const updateActiveSession = (newMessages: Message[], newTitle?: string) => {
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: newMessages,
            updatedAt: Date.now(),
            title: newTitle || s.title,
          };
        }
        return s;
      });
      MMKV.setString(CHAT_SESSIONS_KEY, JSON.stringify(updated));
      DeviceEventEmitter.emit('aiChatHistoryUpdated');
      return updated;
    });
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession ? activeSession.messages : [];

  const fabSize = 64;
  const fabPan = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH - fabSize - 16,
      y: SCREEN_HEIGHT - fabSize - 120,
    }),
  ).current;
  const initialChatPos = useMemo(
    () => ({x: EDGE_BUFFER_SIDES, y: SCREEN_HEIGHT * 0.2}),
    [],
  );
  const chatPan = useRef(new Animated.ValueXY(initialChatPos)).current;

  const minWidth = 300;
  const minHeight = 400;
  const maxWidth = SCREEN_WIDTH - EDGE_BUFFER_SIDES * 2;
  const maxHeight = SCREEN_HEIGHT * 0.75;
  const chatWidth = useRef(new Animated.Value(maxWidth)).current;
  const chatHeight = useRef(new Animated.Value(SCREEN_HEIGHT * 0.6)).current;
  const currentSize = useRef({w: maxWidth, h: SCREEN_HEIGHT * 0.6});

  const toggleMaximize = () => {
    const nextMaximizedState = !isMaximized;
    setIsMaximized(nextMaximizedState);

    if (nextMaximizedState) {
      Animated.parallel([
        Animated.spring(chatWidth, {
          toValue: SCREEN_WIDTH,
          useNativeDriver: false,
        }),
        Animated.spring(chatHeight, {
          toValue: SCREEN_HEIGHT,
          useNativeDriver: false,
        }),
        Animated.spring(chatPan, {
          toValue: {x: 0, y: 0},
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(chatWidth, {
          toValue: currentSize.current.w,
          useNativeDriver: false,
        }),
        Animated.spring(chatHeight, {
          toValue: currentSize.current.h,
          useNativeDriver: false,
        }),
        Animated.spring(chatPan, {
          toValue: {
            x: Math.min(
              Math.max((chatPan.x as any)._value, EDGE_BUFFER_SIDES),
              SCREEN_WIDTH - currentSize.current.w - EDGE_BUFFER_SIDES,
            ),
            y: Math.min(
              Math.max((chatPan.y as any)._value, EDGE_BUFFER_TOP),
              SCREEN_HEIGHT - currentSize.current.h - EDGE_BUFFER_BOTTOM,
            ),
          },
          useNativeDriver: false,
        }),
      ]).start();
    }
  };

  const fabPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        fabPan.setOffset({
          x: (fabPan.x as any)._value,
          y: (fabPan.y as any)._value,
        });
        fabPan.setValue({x: 0, y: 0});
      },
      onPanResponderMove: Animated.event([null, {dx: fabPan.x, dy: fabPan.y}], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        fabPan.flattenOffset();
        Animated.spring(fabPan, {
          toValue: {
            x: Math.min(
              Math.max((fabPan.x as any)._value, EDGE_BUFFER_SIDES),
              SCREEN_WIDTH - fabSize - EDGE_BUFFER_SIDES,
            ),
            y: Math.min(
              Math.max((fabPan.y as any)._value, EDGE_BUFFER_TOP),
              SCREEN_HEIGHT - fabSize - EDGE_BUFFER_BOTTOM,
            ),
          },
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  const chatPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        chatPan.setOffset({
          x: (chatPan.x as any)._value,
          y: (chatPan.y as any)._value,
        });
        chatPan.setValue({x: 0, y: 0});
      },
      onPanResponderMove: Animated.event(
        [null, {dx: chatPan.x, dy: chatPan.y}],
        {useNativeDriver: false},
      ),
      onPanResponderRelease: () => {
        chatPan.flattenOffset();
        Animated.spring(chatPan, {
          toValue: {
            x: Math.min(
              Math.max((chatPan.x as any)._value, EDGE_BUFFER_SIDES),
              SCREEN_WIDTH - currentSize.current.w - EDGE_BUFFER_SIDES,
            ),
            y: Math.min(
              Math.max((chatPan.y as any)._value, EDGE_BUFFER_TOP),
              SCREEN_HEIGHT - currentSize.current.h - EDGE_BUFFER_BOTTOM,
            ),
          },
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  const resizePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        let newWidth = Math.min(
          maxWidth,
          Math.max(minWidth, currentSize.current.w + gesture.dx),
        );
        let newHeight = Math.min(
          maxHeight,
          Math.max(minHeight, currentSize.current.h + gesture.dy),
        );
        chatWidth.setValue(newWidth);
        chatHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_, gesture) => {
        currentSize.current.w = Math.min(
          maxWidth,
          Math.max(minWidth, currentSize.current.w + gesture.dx),
        );
        currentSize.current.h = Math.min(
          maxHeight,
          Math.max(minHeight, currentSize.current.h + gesture.dy),
        );
      },
    }),
  ).current;

  if (!isEnabled || currentRoute === 'Player') return null;

  const handleCopy = (text: string | null) => {
    if (!text) return;
    Clipboard.setString(text);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Text copied', ToastAndroid.SHORT);
    }
  };

  const searchTMDB = async (query: string) => {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
          query,
        )}`,
      );
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results.slice(0, 3).map((item: any) => ({
          title: item.title || item.name,
          media_type: item.media_type,
          release_date: item.release_date || item.first_air_date,
          overview: item.overview,
          rating: item.vote_average
            ? `${item.vote_average.toFixed(1)}/10`
            : 'N/A',
          poster_url: item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : null,
        }));
      }
      return {error: 'No entertainment matches found.'};
    } catch (error) {
      return {error: 'Search service failed.'};
    }
  };

  const cleanMessagesForAPI = (msgs: Message[]) => {
    return msgs.map(m => {
      const clean: any = {role: m.role};

      if (m.role === 'assistant' && m.tool_calls) {
        clean.content = m.content || null;
      } else if (m.role === 'tool') {
        clean.content = m.content || '{}'; // Ensure tools always have valid string content
      } else {
        clean.content = m.content || '';
      }

      if (m.name) clean.name = m.name;
      if (m.tool_call_id) clean.tool_call_id = m.tool_call_id;
      if (m.tool_calls) clean.tool_calls = m.tool_calls;

      return clean;
    });
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeSessionId) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, newUserMessage];

    let sessionTitle = activeSession?.title;
    if (messages.length <= 2) {
      sessionTitle = inputText.trim().split(' ').slice(0, 4).join(' ') + '...';
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    updateActiveSession(updatedMessages, sessionTitle);
    setInputText('');
    setIsLoading(true);

    try {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'search_entertainment',
            description:
              'Query TMDB for movie/TV show data. Use this for EVERY movie/show you mention to fetch posters.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The title of the entertainment content',
                },
              },
              required: ['query'],
            },
          },
        },
      ];

      const apiPayload = cleanMessagesForAPI(updatedMessages);

      // Groq recommended model for reliable tool calling
      const modelToUse = 'llama-3.3-70b-versatile';

      const initialGroqResponse = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: apiPayload,
            tools: tools,
            tool_choice: 'auto',
          }),
        },
      );

      const initialData = await initialGroqResponse.json();

      if (!initialGroqResponse.ok) {
        throw new Error(
          `Groq API Error: ${
            initialData.error?.message || initialGroqResponse.status
          }`,
        );
      }

      const initialMessage = initialData.choices[0].message;

      let finalMessages = [
        ...updatedMessages,
        {
          ...initialMessage,
          id: Date.now().toString() + '_resp',
          timestamp: Date.now(),
        },
      ];

      if (initialMessage.tool_calls) {
        for (const toolCall of initialMessage.tool_calls) {
          let searchResults;

          try {
            if (toolCall.function.name === 'search_entertainment') {
              const args = JSON.parse(toolCall.function.arguments);
              searchResults = await searchTMDB(args.query);
            } else {
              searchResults = {error: 'Unknown tool requested.'};
            }
          } catch (parseError) {
            searchResults = {error: 'Failed to parse query.'};
          }

          finalMessages.push({
            id: toolCall.id,
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(searchResults),
            timestamp: Date.now(),
          });
        }

        // FIX: The second request MUST also include the tools definition!
        const secondGroqResponse = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: modelToUse,
              messages: cleanMessagesForAPI(finalMessages),
              tools: tools, // Fixed missing tool array
              tool_choice: 'auto', // Keep auto
            }),
          },
        );

        const finalData = await secondGroqResponse.json();

        if (!secondGroqResponse.ok) {
          throw new Error(
            `Groq API Error on Tool Return: ${
              finalData.error?.message || secondGroqResponse.status
            }`,
          );
        }

        let finalAssistantMessage = finalData.choices[0].message;

        // Safety net: If the AI aggressively calls a tool AGAIN on the second turn
        // we force it to show text so it doesn't get stuck in a loop or render a blank bubble.
        if (
          finalAssistantMessage.tool_calls &&
          !finalAssistantMessage.content
        ) {
          finalAssistantMessage.content =
            'Here are the entertainment results I found for you.';
          delete finalAssistantMessage.tool_calls;
        }

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        updateActiveSession([
          ...finalMessages,
          {
            ...finalAssistantMessage,
            id: Date.now().toString() + '_final',
            timestamp: Date.now(),
          },
        ]);
      } else {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        updateActiveSession(finalMessages);
      }
    } catch (error: any) {
      console.error(error);
      updateActiveSession([
        ...updatedMessages,
        {
          id: Date.now().toString() + '_error',
          role: 'assistant',
          content: `Connection Error. ${
            error.message ||
            'I am unable to connect to the Vega-Next core intelligence unit.'
          }`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (content: string | null, role: string) => {
    if (!content) return null;

    const cleanText = content.replace(/\*\*/g, '');
    if (cleanText.trim() === '') return null;

    return (
      <Text
        selectable
        style={[
          styles.messageText,
          role === 'user'
            ? styles.messageTextUser
            : styles.messageTextAssistant,
        ]}>
        {cleanText}
      </Text>
    );
  };

  return (
    <>
      {!isOpen && (
        <Animated.View
          {...fabPanResponder.panHandlers}
          style={[
            fabPan.getLayout(),
            styles.fabContainer,
            {
              backgroundColor: primary,
              width: fabSize,
              height: fabSize,
              borderRadius: fabSize / 2,
            },
          ]}>
          <TouchableOpacity
            onPress={() => setIsOpen(true)}
            style={styles.fabTouch}
            activeOpacity={0.9}>
            <MaterialCommunityIcons name="robot" size={28} color="white" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {isOpen && (
        <Animated.View
          style={[
            chatPan.getLayout(),
            styles.chatWindow,
            {
              width: chatWidth,
              height: chatHeight,
              borderRadius: isMaximized ? 0 : 20,
            },
          ]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{flex: 1}}>
            {/* Header */}
            <Animated.View
              {...(!isMaximized ? chatPanResponder.panHandlers : {})}
              style={[
                styles.header,
                {
                  paddingTop: isMaximized
                    ? Platform.OS === 'ios'
                      ? 44
                      : (StatusBar.currentHeight || 24) + 12
                    : 12,
                },
              ]}>
              <View style={styles.headerTitle}>
                <MaterialCommunityIcons
                  name="robot"
                  size={22}
                  color={primary}
                />
                <Text style={styles.headerText}>Vega-Next AI</Text>
              </View>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <TouchableOpacity
                  onPress={createNewSession}
                  style={[styles.iconButton, {marginRight: 8}]}>
                  <Feather name="plus" size={20} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setIsOpen(false);
                    onNavigateToHistory();
                  }}
                  style={[styles.iconButton, {marginRight: 8}]}>
                  <MaterialCommunityIcons
                    name="history"
                    size={22}
                    color="white"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleMaximize}
                  style={[styles.iconButton, {marginRight: 8}]}>
                  <Feather
                    name={isMaximized ? 'minimize-2' : 'maximize-2'}
                    size={18}
                    color="white"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsOpen(false)}
                  style={styles.iconButton}>
                  <Feather name="x" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Chat Content */}
            <ScrollView
              ref={scrollViewRef}
              onContentSizeChange={() =>
                scrollViewRef.current?.scrollToEnd({animated: true})
              }
              style={styles.messageScroll}
              contentContainerStyle={styles.messageContent}
              keyboardShouldPersistTaps="handled">
              {messages
                .filter(
                  msg =>
                    msg.role === 'user' ||
                    msg.role === 'assistant' ||
                    msg.role === 'tool',
                )
                .map(msg => {
                  if (msg.role === 'tool') {
                    if (msg.name !== 'search_entertainment' || !msg.content)
                      return null;
                    try {
                      const results = JSON.parse(msg.content);
                      if (
                        results.error ||
                        !Array.isArray(results) ||
                        results.length === 0
                      )
                        return null;

                      const itemsWithPosters = results.filter(
                        (item: any) => item.poster_url,
                      );
                      if (itemsWithPosters.length === 0) return null;

                      return (
                        <View
                          key={msg.id}
                          style={{
                            marginVertical: 12,
                            width: '100%',
                            alignSelf: 'center',
                          }}>
                          <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{
                              alignItems: 'center',
                              paddingHorizontal: 4,
                            }}
                            decelerationRate="fast"
                            snapToInterval={SLIDER_SNAP_INTERVAL}
                            snapToAlignment="center">
                            {itemsWithPosters.map(
                              (item: any, imgIndex: number) => (
                                <View
                                  key={imgIndex}
                                  style={{
                                    width: SLIDER_CARD_WIDTH,
                                    height: 350,
                                    marginHorizontal: SLIDER_CARD_MARGIN,
                                    overflow: 'hidden',
                                    borderRadius: 12,
                                    backgroundColor: '#1A1A1A',
                                    elevation: 3,
                                    shadowColor: '#000',
                                    shadowOffset: {width: 0, height: 1},
                                    shadowOpacity: 0.2,
                                    shadowRadius: 1.5,
                                    borderColor: '#333',
                                    borderWidth: 1,
                                  }}>
                                  <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() =>
                                      setFullScreenImage(item.poster_url)
                                    }
                                    style={{flex: 1}}>
                                    <Image
                                      source={{uri: item.poster_url}}
                                      style={{width: '100%', height: '80%'}}
                                      resizeMode="cover"
                                    />
                                    <View
                                      style={{
                                        padding: 12,
                                        flex: 1,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                      }}>
                                      <Text
                                        style={{
                                          color: 'white',
                                          fontWeight: 'bold',
                                          fontSize: 14,
                                        }}
                                        numberOfLines={1}>
                                        {item.title || 'Untitled'}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                </View>
                              ),
                            )}
                          </ScrollView>
                        </View>
                      );
                    } catch (e) {
                      return null;
                    }
                  }

                  if (!msg.content && msg.role === 'assistant') return null;

                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.messageRow,
                        msg.role === 'user'
                          ? styles.messageUserRow
                          : styles.messageAssistantRow,
                      ]}>
                      {msg.role === 'assistant' && (
                        <MaterialCommunityIcons
                          name="robot"
                          size={16}
                          color={primary}
                          style={styles.messageAvatar}
                        />
                      )}

                      <View
                        style={{
                          flexDirection: 'column',
                          alignItems:
                            msg.role === 'user' ? 'flex-end' : 'flex-start',
                          flexShrink: 1,
                        }}>
                        <TouchableOpacity
                          onLongPress={() => handleCopy(msg.content)}
                          activeOpacity={0.9}
                          style={[
                            styles.bubble,
                            msg.role === 'user'
                              ? [styles.bubbleUser, {backgroundColor: primary}]
                              : styles.bubbleAssistant,
                          ]}>
                          {renderMessageContent(msg.content, msg.role)}
                        </TouchableOpacity>
                        <Text style={styles.timeText}>
                          {formatTime(msg.timestamp)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              {isLoading && (
                <View style={[styles.messageRow, styles.messageAssistantRow]}>
                  <MaterialCommunityIcons
                    name="robot"
                    size={16}
                    color={primary}
                    style={styles.messageAvatar}
                  />
                  <TypingIndicator />
                </View>
              )}
            </ScrollView>

            <View
              style={[
                styles.inputArea,
                {
                  paddingBottom: isMaximized && Platform.OS === 'ios' ? 30 : 10,
                },
              ]}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type an entertainment query..."
                placeholderTextColor="#6B7280"
                style={styles.textInput}
                multiline
                maxLength={500}
                autoCorrect
              />
              <TouchableOpacity
                onPress={sendMessage}
                disabled={isLoading || !inputText.trim()}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor:
                      inputText.trim() && !isLoading ? primary : '#333',
                  },
                ]}
                activeOpacity={0.8}>
                <Ionicons name="send" size={16} color="white" />
              </TouchableOpacity>
            </View>

            {!isMaximized && (
              <Animated.View
                {...resizePanResponder.panHandlers}
                style={styles.resizeHandle}>
                <MaterialCommunityIcons
                  name="resize-bottom-right"
                  size={18}
                  color="#6B7280"
                />
              </Animated.View>
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      )}

      {!!fullScreenImage && (
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity
            style={styles.closeImageBtn}
            onPress={() => setFullScreenImage(null)}
            activeOpacity={0.8}>
            <Feather name="x" size={28} color="white" />
          </TouchableOpacity>
          <Image
            source={{uri: fullScreenImage}}
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
        </View>
      )}
    </>
  );
};

export default AI;

const styles = StyleSheet.create({
  fullScreenImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  closeImageBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 1,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fabContainer: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatWindow: {
    position: 'absolute',
    backgroundColor: '#141414',
    overflow: 'hidden',
    zIndex: 9999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.5,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#262626',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  headerTitle: {flexDirection: 'row', alignItems: 'center'},
  headerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  iconButton: {padding: 4, opacity: 0.8},
  messageScroll: {flex: 1, backgroundColor: '#141414'},
  messageContent: {paddingVertical: 16, paddingHorizontal: 12},
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '85%',
    alignItems: 'flex-start',
  },
  messageUserRow: {alignSelf: 'flex-end'},
  messageAssistantRow: {alignSelf: 'flex-start'},
  messageAvatar: {marginRight: 6, marginTop: 4, opacity: 0.6},
  bubble: {paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16},
  bubbleUser: {
    borderBottomRightRadius: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  bubbleAssistant: {
    backgroundColor: '#1F1F1F',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#262626',
  },
  messageText: {fontSize: 15, lineHeight: 24},
  messageTextUser: {color: 'white', fontWeight: '500'},
  messageTextAssistant: {color: '#E5E7EB'},
  timeText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  typingContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#262626',
    alignSelf: 'flex-start',
  },
  typingDot: {width: 6, height: 6, borderRadius: 3, marginHorizontal: 3},
  inputArea: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#262626',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    color: 'white',
    backgroundColor: '#141414',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resizeHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    padding: 6,
    opacity: 0.6,
  },
});
