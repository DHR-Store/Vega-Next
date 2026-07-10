// components/HeroSuggestionSlider.tsx
//
// Auto-sliding ("auto hero slide") + manually swipeable poster-card carousel
// meant to sit at the top of the Search screen — styled after a Netflix-style
// "coming soon" row: portrait poster art with a small badge, and a title
// caption underneath the art (not overlaid on top of it).
//
// How it works:
// 1. Pulls together the user's most recent Watch History, Watchlist and
//    Search History (deduped, most-recent-first, capped at 20 titles).
// 2. Sends that list to the SAME Groq AI model/key used by the AI chat
//    assistant (components/AI.tsx) — both read from lib/config/aiConfig.ts —
//    asking it to analyze the user's taste and recommend up to 20 movies/
//    shows.
// 3. Resolves a poster + rating/release-date for each recommendation via the
//    SAME TMDB API key already used elsewhere in the app.
// 4. Renders the results as a peeking poster-card row that auto-scrolls one
//    card at a time and can also be swiped manually (autoplay pauses while
//    the user is dragging).
//
// Results are cached in MMKV and only regenerated when the underlying
// history actually changes (or the cache expires), so normal use of the app
// (e.g. saving playback progress every few seconds) doesn't re-trigger the
// AI/TMDB calls.
//
// NOTE: adjust the two store import paths below if your Watch History /
// Watchlist zustand stores live somewhere other than lib/zustand in your
// project.

import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import {Ionicons, Feather} from '@expo/vector-icons';
import useThemeStore from '../lib/zustand/themeStore';
import {MMKV} from '../lib/Mmkv';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import useWatchListStore from '../lib/zustand/watchListStore';
import {
  GROQ_API_KEY,
  GROQ_ENDPOINT,
  GROQ_MODEL,
  TMDB_API_KEY,
  TMDB_BASE_URL,
  TMDB_IMAGE_BASE,
} from '.././lib/config/aiConfig';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

// --- Poster-card layout (matches the peeking-card reference UI) ---
const CARD_SIDE_INSET = 16; // left inset of the first card / scroll padding
const CARD_MARGIN = 10; // gap between cards
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.3); // ~3 cards visible + a peek of the next
const POSTER_HEIGHT = Math.round(CARD_WIDTH * 1.5); // 2:3 poster aspect ratio
const CAPTION_HEIGHT = 34; // space for the up-to-2-line title caption below the poster
const CARD_TOTAL_HEIGHT = POSTER_HEIGHT + CAPTION_HEIGHT;
const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN;

const AUTO_PLAY_INTERVAL_MS = 3500;

// How many recent titles from combined history to feed the AI, and the max
// number of recommended cards to show — "every 20 movie" from the brief.
const MAX_HISTORY_ITEMS = 20;
const MAX_HERO_ITEMS = 20;

const CACHE_KEY = 'heroSuggestionsCache_v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface HeroItem {
  id: number;
  title: string;
  overview: string;
  rating: string;
  year: string;
  releaseDate: string;
  mediaType: string;
  posterUrl: string | null;
  backdropUrl: string | null;
}

interface CachePayload {
  signature: string;
  timestamp: number;
  sectionTitle: string;
  items: HeroItem[];
}

interface HeroSuggestionSliderProps {
  // Called when the user taps a card. Wire this to the same handler you use
  // for other suggestion taps (e.g. Search.tsx's handleSearch) so the title
  // is searched against your providers, exactly like every other suggestion
  // in the Search screen.
  onSelectTitle: (title: string) => void;
}

const buildRecommendationPrompt = (titles: string[]) => `
You are a movie & TV recommendation engine for a streaming app.
Analyze the user's recent activity below (their watch history, watchlist, and searches, most recent first) and infer their taste — genres, themes, tone, era, favorite actors/directors if identifiable.

User activity:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Recommend up to ${MAX_HERO_ITEMS} movies or TV shows the user is highly likely to enjoy.
Rules:
- Do NOT repeat any title already listed above.
- Favor variety across the genres/themes shown, don't just repeat one franchise.
- Mix popular and slightly lesser-known picks.
- Use real, correctly spelled titles only.

Respond with ONLY strict JSON, no markdown fences, no commentary, in exactly this shape:
{"recommendations": ["Title 1", "Title 2"]}
`;

const getRecentSearchHistory = (): string[] => {
  try {
    return MMKV.getArray<string>('searchHistory') || [];
  } catch {
    return [];
  }
};

// Pulls the JSON object out of a model response even if it wraps it in
// markdown fences or adds stray commentary around it.
const safeParseRecommendations = (raw: string): string[] => {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed.recommendations)) {
      return parsed.recommendations.filter(
        (t: any) => typeof t === 'string' && t.trim(),
      );
    }
  } catch {
    // ignore — caller falls back to trending
  }
  return [];
};

const resolveTMDB = async (title: string): Promise<HeroItem | null> => {
  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
        title,
      )}`,
    );
    const data = await res.json();
    const match = (data.results || []).find(
      (r: any) => r.poster_path || r.backdrop_path,
    );
    if (!match) return null;

    const releaseDate = match.release_date || match.first_air_date || '';

    return {
      id: match.id,
      title: match.title || match.name || title,
      overview: match.overview || '',
      rating: match.vote_average ? match.vote_average.toFixed(1) : 'N/A',
      year: releaseDate.slice(0, 4),
      releaseDate,
      mediaType: match.media_type || 'movie',
      posterUrl: match.poster_path
        ? `${TMDB_IMAGE_BASE}/w500${match.poster_path}`
        : null,
      backdropUrl: match.backdrop_path
        ? `${TMDB_IMAGE_BASE}/w780${match.backdrop_path}`
        : match.poster_path
          ? `${TMDB_IMAGE_BASE}/w780${match.poster_path}`
          : null,
    };
  } catch {
    return null;
  }
};

const fetchTrendingFallback = async (): Promise<HeroItem[]> => {
  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}`,
    );
    const data = await res.json();
    return (data.results || [])
      .slice(0, MAX_HERO_ITEMS)
      .map((match: any): HeroItem => {
        const releaseDate = match.release_date || match.first_air_date || '';
        return {
          id: match.id,
          title: match.title || match.name || 'Untitled',
          overview: match.overview || '',
          rating: match.vote_average ? match.vote_average.toFixed(1) : 'N/A',
          year: releaseDate.slice(0, 4),
          releaseDate,
          mediaType: match.media_type || 'movie',
          posterUrl: match.poster_path
            ? `${TMDB_IMAGE_BASE}/w500${match.poster_path}`
            : null,
          backdropUrl: match.backdrop_path
            ? `${TMDB_IMAGE_BASE}/w780${match.backdrop_path}`
            : null,
        };
      })
      .filter((item: HeroItem) => item.posterUrl || item.backdropUrl);
  } catch {
    return [];
  }
};

// Upcoming/just-released titles get a "JUN 26" style date pill (like the
// reference UI); everything else falls back to a star-rating pill.
const formatDateBadge = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
    .toUpperCase();
};

const getCardBadge = (
  item: HeroItem,
): {icon: React.ReactNode; label: string} => {
  const releaseTime = item.releaseDate
    ? new Date(item.releaseDate).getTime()
    : NaN;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const isNewOrUpcoming = !isNaN(releaseTime) && releaseTime > thirtyDaysAgo;
  const dateLabel = isNewOrUpcoming ? formatDateBadge(item.releaseDate) : null;

  if (dateLabel) {
    return {
      icon: <Feather name="calendar" size={9} color="white" />,
      label: dateLabel,
    };
  }
  return {
    icon: <Ionicons name="star" size={9} color="#FFD700" />,
    label: item.rating,
  };
};

const HeroSuggestionSlider = ({onSelectTitle}: HeroSuggestionSliderProps) => {
  const {primary} = useThemeStore(state => state);
  const history = useWatchHistoryStore(state => state.history);
  const watchList = useWatchListStore(state => state.watchList);

  const [heroItems, setHeroItems] = useState<HeroItem[]>([]);
  const [sectionTitle, setSectionTitle] = useState('Picks For You');
  const [loading, setLoading] = useState(true);

  const flatListRef = useRef<FlatList<HeroItem>>(null);
  const autoPlayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDragging = useRef(false);
  const requestId = useRef(0);
  const currentIndexRef = useRef(0);

  // Combine the three signals, most-recent-first, deduped, capped at 20.
  const combinedTitles = useMemo(() => {
    const fromHistory = [...history]
      .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
      .map(item => item.title)
      .filter(Boolean);

    const fromWatchList = (watchList || [])
      .map((item: any) => item.title || item.name)
      .filter(Boolean);

    const fromSearch = getRecentSearchHistory();

    const combined: string[] = [];
    [...fromHistory, ...fromWatchList, ...fromSearch].forEach(title => {
      const clean = String(title).trim();
      if (clean && !combined.includes(clean)) combined.push(clean);
    });

    return combined.slice(0, MAX_HISTORY_ITEMS);
  }, [history, watchList]);

  const signature = combinedTitles.join('|');

  const generateRecommendations = useCallback(
    async (force = false) => {
      const myRequestId = ++requestId.current;
      setLoading(true);

      // Serve from cache if the underlying history hasn't changed.
      if (!force) {
        try {
          const raw = MMKV.getString(CACHE_KEY);
          if (raw) {
            const cached: CachePayload = JSON.parse(raw);
            const fresh = Date.now() - cached.timestamp < CACHE_TTL_MS;
            if (cached.signature === signature && fresh) {
              setHeroItems(cached.items);
              setSectionTitle(cached.sectionTitle);
              setLoading(false);
              return;
            }
          }
        } catch {
          // ignore corrupt cache, fall through to regeneration
        }
      }

      try {
        let titlesToResolve: string[] = [];
        let label = 'Picks For You';

        if (combinedTitles.length >= 3) {
          const aiRes = await fetch(GROQ_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: GROQ_MODEL,
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a precise JSON API. Only output valid JSON, never markdown.',
                },
                {
                  role: 'user',
                  content: buildRecommendationPrompt(combinedTitles),
                },
              ],
              response_format: {type: 'json_object'},
              temperature: 0.8,
              reasoning_effort: 'low',
            }),
          });

          const aiData = await aiRes.json();
          const raw = aiRes.ok ? aiData.choices?.[0]?.message?.content : null;

          if (raw) {
            titlesToResolve = safeParseRecommendations(raw).slice(
              0,
              MAX_HERO_ITEMS,
            );
          }
        }

        let resolvedItems: HeroItem[] = [];

        if (titlesToResolve.length > 0) {
          const resolved = await Promise.all(titlesToResolve.map(resolveTMDB));
          resolvedItems = resolved.filter(Boolean) as HeroItem[];
        }

        if (resolvedItems.length < 3) {
          // Not enough history yet, or the AI/TMDB pass came back thin —
          // fall back to trending so the row is never empty.
          resolvedItems = await fetchTrendingFallback();
          label = 'Trending Now';
        }

        resolvedItems = resolvedItems.slice(0, MAX_HERO_ITEMS);

        // Ignore stale responses if a newer request started meanwhile.
        if (myRequestId !== requestId.current) return;

        currentIndexRef.current = 0;
        setHeroItems(resolvedItems);
        setSectionTitle(label);

        if (resolvedItems.length > 0) {
          const payload: CachePayload = {
            signature,
            timestamp: Date.now(),
            sectionTitle: label,
            items: resolvedItems,
          };
          MMKV.setString(CACHE_KEY, JSON.stringify(payload));
        }
      } catch (e) {
        console.warn('[HeroSuggestionSlider] generation failed:', e);
        if (myRequestId === requestId.current) {
          const fallback = await fetchTrendingFallback();
          setHeroItems(fallback);
          setSectionTitle('Trending Now');
        }
      } finally {
        if (myRequestId === requestId.current) setLoading(false);
      }
    },
    [combinedTitles, signature],
  );

  useEffect(() => {
    generateRecommendations(false);
    // Only re-run when the underlying history signature actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // --- Autoplay: advance one card at a time ---
  const stopAutoPlay = () => {
    if (autoPlayTimer.current) {
      clearInterval(autoPlayTimer.current);
      autoPlayTimer.current = null;
    }
  };

  const startAutoPlay = useCallback(() => {
    stopAutoPlay();
    if (heroItems.length <= 1) return;
    autoPlayTimer.current = setInterval(() => {
      if (isDragging.current) return;
      const next = (currentIndexRef.current + 1) % heroItems.length;
      currentIndexRef.current = next;
      flatListRef.current?.scrollToOffset({
        offset: next * SNAP_INTERVAL,
        animated: true,
      });
    }, AUTO_PLAY_INTERVAL_MS);
  }, [heroItems.length]);

  useEffect(() => {
    startAutoPlay();
    return stopAutoPlay;
  }, [startAutoPlay]);

  const handleScrollBeginDrag = () => {
    isDragging.current = true;
    stopAutoPlay();
  };

  const handleScrollEndDrag = () => {
    isDragging.current = false;
    // Resume autoplay after a short pause so the user's swipe isn't
    // immediately overridden.
    setTimeout(startAutoPlay, 1800);
  };

  const handleMomentumScrollEnd = (
    e: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    currentIndexRef.current = Math.max(
      0,
      Math.min(index, heroItems.length - 1),
    );
  };

  const renderCard = ({item, index}: {item: HeroItem; index: number}) => {
    const badge = getCardBadge(item);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onSelectTitle(item.title)}
        style={{
          width: CARD_WIDTH,
          marginLeft: index === 0 ? CARD_SIDE_INSET : 0,
          marginRight: CARD_MARGIN,
        }}>
        <View
          style={{
            width: CARD_WIDTH,
            height: POSTER_HEIGHT,
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: '#1A1A1A',
          }}>
          <Image
            source={{uri: item.posterUrl || item.backdropUrl || undefined}}
            style={{width: '100%', height: '100%'}}
            resizeMode="cover"
          />
          {/* Bottom-left pill: release date for new/upcoming titles, rating otherwise */}
          <View
            style={{
              position: 'absolute',
              left: 6,
              bottom: 6,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 3,
            }}>
            {badge.icon}
            <Text
              style={{
                color: 'white',
                fontSize: 10,
                fontWeight: '700',
                marginLeft: 3,
              }}>
              {badge.label}
            </Text>
          </View>
          {/* Top-left pill: Movie / TV */}
          <View
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}>
            <Text style={{color: '#E5E7EB', fontSize: 9, fontWeight: '700'}}>
              {item.mediaType === 'tv' ? 'TV' : 'MOVIE'}
            </Text>
          </View>
        </View>

        <Text
          className="text-white text-xs font-semibold mt-1.5"
          numberOfLines={2}
          ellipsizeMode="tail">
          {item.title}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading && heroItems.length === 0) {
    return (
      <View className="mb-2">
        <View className="flex-row items-center justify-between px-4 mb-2">
          <Text className="text-white/90 text-base font-semibold">
            Picks For You
          </Text>
        </View>
        <View style={{flexDirection: 'row', paddingLeft: CARD_SIDE_INSET}}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={{
                width: CARD_WIDTH,
                height: POSTER_HEIGHT,
                borderRadius: 10,
                backgroundColor: '#1F1F1F',
                marginRight: CARD_MARGIN,
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  if (heroItems.length === 0) return null;

  return (
    <View className="mb-2">
      <View className="flex-row items-center justify-between px-4 mb-2">
        <Text className="text-white/90 text-base font-semibold">
          {sectionTitle}
        </Text>
        <TouchableOpacity
          onPress={() => generateRecommendations(true)}
          disabled={loading}
          className="p-1"
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Feather
            name="refresh-cw"
            size={14}
            color={loading ? '#555' : '#999'}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={heroItems}
        keyExtractor={(item, index) => `hero-${item.id}-${index}`}
        renderItem={renderCard}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        style={{height: CARD_TOTAL_HEIGHT}}
        contentContainerStyle={{paddingRight: CARD_SIDE_INSET}}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: SNAP_INTERVAL,
          offset: SNAP_INTERVAL * index,
          index,
        })}
      />
    </View>
  );
};

export default HeroSuggestionSlider;
