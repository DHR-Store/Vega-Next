// components/Community/StickerPicker.tsx
import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import {MaterialCommunityIcons, Ionicons} from '@expo/vector-icons';

const {width: SW} = Dimensions.get('window');

// ─── Emoji categories ─────────────────────────────────────────────────────────
const EMOJI_CATEGORIES: {label: string; icon: string; emojis: string[]}[] = [
  {
    label: 'Recent',
    icon: '🕒',
    emojis: ['😂', '❤️', '👍', '🔥', '😭', '✨', '🙏', '😍', '🥺', '💀'],
  },
  {
    label: 'Smileys',
    icon: '😀',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '😂',
      '🤣',
      '😊',
      '😇',
      '🙂',
      '🙃',
      '😉',
      '😌',
      '😍',
      '🥰',
      '😘',
      '😗',
      '😙',
      '😚',
      '😋',
      '😛',
      '😝',
      '😜',
      '🤪',
      '🤨',
      '🧐',
      '🤓',
      '😎',
      '🥸',
      '🤩',
      '🥳',
      '😏',
      '😒',
      '😞',
      '😔',
      '😟',
      '😕',
      '🙁',
      '☹️',
      '😣',
      '😖',
      '😫',
      '😩',
      '🥺',
      '😢',
      '😭',
      '😤',
      '😠',
      '😡',
      '🤬',
      '🤯',
      '😳',
      '🥵',
      '🥶',
      '😱',
      '😨',
      '😰',
      '😥',
      '😓',
      '🤗',
      '🤔',
      '🫣',
      '🤭',
      '🤫',
      '🤥',
      '😶',
      '😑',
      '😬',
      '🙄',
      '😯',
      '😦',
      '😧',
      '😮',
      '😲',
      '🥱',
      '😴',
      '🤤',
      '😪',
      '😵',
      '🫠',
      '🤐',
      '🥴',
      '🤢',
      '🤮',
      '🤧',
      '😷',
      '🤒',
      '🤕',
      '🤑',
      '🤠',
      '😈',
      '👿',
      '👹',
      '👺',
      '🤡',
      '💩',
      '👻',
      '💀',
      '☠️',
    ],
  },
  {
    label: 'Gestures',
    icon: '👋',
    emojis: [
      '👋',
      '🤚',
      '✋',
      '🖖',
      '👌',
      '🤌',
      '🤏',
      '✌️',
      '🤞',
      '🫰',
      '🤟',
      '🤘',
      '🤙',
      '👈',
      '👉',
      '👆',
      '🖕',
      '👇',
      '☝️',
      '🫵',
      '👍',
      '👎',
      '✊',
      '👊',
      '🤛',
      '🤜',
      '👏',
      '🙌',
      '🫶',
      '👐',
      '🤲',
      '🙏',
      '✍️',
      '💅',
      '🤳',
      '💪',
      '🦾',
      '🦿',
      '🦵',
      '🦶',
      '👂',
      '🦻',
      '👃',
      '🫀',
      '🫁',
      '🧠',
      '🦷',
      '🦴',
      '👀',
      '👁️',
    ],
  },
  {
    label: 'Animals',
    icon: '🐶',
    emojis: [
      '🐶',
      '🐱',
      '🐭',
      '🐹',
      '🐰',
      '🦊',
      '🐻',
      '🐼',
      '🐻‍❄️',
      '🐨',
      '🐯',
      '🦁',
      '🐮',
      '🐷',
      '🐸',
      '🐵',
      '🙈',
      '🙉',
      '🙊',
      '🐔',
      '🐧',
      '🐦',
      '🐤',
      '🦆',
      '🦅',
      '🦉',
      '🦇',
      '🐺',
      '🐗',
      '🐴',
      '🦄',
      '🐝',
      '🐛',
      '🦋',
      '🐌',
      '🐞',
      '🐜',
      '🦟',
      '🦗',
      '🕷️',
      '🦂',
      '🐢',
      '🐍',
      '🦎',
      '🦖',
      '🦕',
      '🐙',
      '🦑',
      '🦐',
      '🦞',
      '🐠',
      '🐡',
      '🐟',
      '🐬',
      '🐳',
      '🐋',
      '🦈',
      '🦭',
      '🐊',
      '🦛',
    ],
  },
  {
    label: 'Food',
    icon: '🍕',
    emojis: [
      '🍎',
      '🍊',
      '🍋',
      '🍇',
      '🍓',
      '🫐',
      '🍈',
      '🍒',
      '🍑',
      '🥭',
      '🍍',
      '🥥',
      '🥝',
      '🍅',
      '🥑',
      '🍆',
      '🥦',
      '🥬',
      '🌽',
      '🌶️',
      '🍕',
      '🍔',
      '🌮',
      '🌯',
      '🥙',
      '🧆',
      '🥚',
      '🍳',
      '🥘',
      '🍲',
      '🍜',
      '🍝',
      '🍛',
      '🍣',
      '🍱',
      '🥟',
      '🦪',
      '🍤',
      '🍙',
      '🍚',
      '🍦',
      '🍧',
      '🍨',
      '🍩',
      '🍪',
      '🎂',
      '🍰',
      '🧁',
      '🥧',
      '🍫',
      '🍬',
      '🍭',
      '🍮',
      '🍯',
      '🧃',
      '🍵',
      '☕',
      '🧋',
      '🥤',
      '🍺',
    ],
  },
  {
    label: 'Activities',
    icon: '⚽',
    emojis: [
      '⚽',
      '🏀',
      '🏈',
      '⚾',
      '🎾',
      '🏐',
      '🏉',
      '🥏',
      '🎱',
      '🏓',
      '🏸',
      '🥊',
      '🥋',
      '⛳',
      '🎯',
      '🎳',
      '🏋️',
      '🤸',
      '⛹️',
      '🤺',
      '🎮',
      '🕹️',
      '🎲',
      '♟️',
      '🎭',
      '🎨',
      '🖼️',
      '🎪',
      '🎤',
      '🎧',
      '🎵',
      '🎶',
      '🎸',
      '🎹',
      '🥁',
      '🎷',
      '🎺',
      '🎻',
      '🪕',
      '🎙️',
    ],
  },
  {
    label: 'Travel',
    icon: '✈️',
    emojis: [
      '✈️',
      '🚀',
      '🛸',
      '🚁',
      '⛵',
      '🚢',
      '🚗',
      '🚕',
      '🚙',
      '🚌',
      '🚎',
      '🏎️',
      '🚓',
      '🚑',
      '🚒',
      '🛻',
      '🚐',
      '🛵',
      '🏍️',
      '🚲',
      '⛽',
      '🚦',
      '🗺️',
      '🗼',
      '🗽',
      '🏰',
      '🏯',
      '🏟️',
      '🎡',
      '🎢',
      '🌏',
      '🌍',
      '🌎',
      '🌋',
      '🏔️',
      '⛰️',
      '🗻',
      '🏕️',
      '🏖️',
      '🌴',
    ],
  },
  {
    label: 'Symbols',
    icon: '❤️',
    emojis: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '💔',
      '❣️',
      '💕',
      '💞',
      '💓',
      '💗',
      '💖',
      '💘',
      '💝',
      '💟',
      '☮️',
      '✝️',
      '☪️',
      '🕉️',
      '☸️',
      '✡️',
      '🔯',
      '🕎',
      '🪯',
      '♈',
      '♉',
      '⭐',
      '🌟',
      '✨',
      '💫',
      '⚡',
      '🔥',
      '💥',
      '🌈',
      '☀️',
      '🌙',
      '⚠️',
      '🆘',
      '♻️',
      '✅',
      '❌',
      '⭕',
      '🚫',
      '💯',
      '🔞',
      '📵',
    ],
  },
];

// ─── Custom sticker packs ─────────────────────────────────────────────────────
const STICKER_PACKS: {label: string; stickers: string[]}[] = [
  {
    label: 'Reactions',
    stickers: [
      '👍',
      '👎',
      '❤️',
      '😂',
      '😮',
      '😢',
      '😡',
      '🎉',
      '🙌',
      '💯',
      '🔥',
      '✨',
      '💪',
      '🤝',
      '👀',
      '💀',
    ],
  },
  {
    label: 'Vibes',
    stickers: [
      '😎',
      '🥶',
      '🤡',
      '👾',
      '🤖',
      '👽',
      '🎃',
      '🤯',
      '🥴',
      '😤',
      '😈',
      '💩',
      '🦋',
      '🌊',
      '⚡',
      '🌙',
    ],
  },
  {
    label: 'Anime',
    stickers: [
      '⛩️',
      '🎌',
      '🌸',
      '🍙',
      '🎎',
      '🏮',
      '🎐',
      '🎑',
      '🗾',
      '🍱',
      '🐉',
      '⚔️',
      '🌺',
      '💮',
      '🀄',
      '🎴',
    ],
  },
];

// ─── GIF search using Tenor (no key needed for basic access) ─────────────────
// Replace TENOR_API_KEY with your key from https://tenor.com/developer/keyregistration
const TENOR_API_KEY = 'YOUR_TENOR_API_KEY';
const TENOR_ENDPOINT = 'https://tenor.googleapis.com/v2';

// Preset GIF categories when no search
const GIF_PRESETS = [
  'excited',
  'love',
  'lol',
  'wow',
  'sad',
  'angry',
  'clap',
  'fire',
];

interface GifResult {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  onGifSelect?: (url: string) => void;
}

type Tab = 'emoji' | 'stickers' | 'gifs';

const StickerPicker: React.FC<Props> = ({onSelect, onClose, onGifSelect}) => {
  const [tab, setTab] = useState<Tab>('emoji');
  const [emojiCat, setEmojiCat] = useState(0);
  const [stickerPack, setStickerPack] = useState(0);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);

  const searchGifs = useCallback(async (query: string) => {
    if (TENOR_API_KEY === 'YOUR_TENOR_API_KEY') {
      // Show placeholder when no key configured
      setGifs([]);
      return;
    }
    setGifLoading(true);
    try {
      const q = query.trim() || 'trending';
      const endpoint = query.trim()
        ? `${TENOR_ENDPOINT}/search?q=${encodeURIComponent(q)}&key=${TENOR_API_KEY}&limit=20&media_filter=gif`
        : `${TENOR_ENDPOINT}/featured?key=${TENOR_API_KEY}&limit=20&media_filter=gif`;
      const res = await fetch(endpoint);
      const data = await res.json();
      const results: GifResult[] = (data.results ?? []).map((r: any) => ({
        id: r.id,
        url: r.media_formats?.gif?.url ?? '',
        preview:
          r.media_formats?.tinygif?.url ?? r.media_formats?.gif?.url ?? '',
        width: r.media_formats?.gif?.dims?.[0] ?? 200,
        height: r.media_formats?.gif?.dims?.[1] ?? 200,
      }));
      setGifs(results);
    } catch {
      setGifs([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  const renderGifGrid = () => {
    if (TENOR_API_KEY === 'YOUR_TENOR_API_KEY') {
      return (
        <View style={styles.gifPlaceholder}>
          <MaterialCommunityIcons name="gif" size={48} color="#374151" />
          <Text style={styles.gifPlaceholderTitle}>GIF Search</Text>
          <Text style={styles.gifPlaceholderText}>
            Add your Tenor API key to{'\n'}enable GIF search.
          </Text>
        </View>
      );
    }
    if (gifLoading) {
      return (
        <View style={styles.gifPlaceholder}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      );
    }
    if (gifs.length === 0) {
      return (
        <View style={styles.gifPlaceholder}>
          <Text style={styles.gifPlaceholderText}>Search for GIFs above</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={gifs}
        numColumns={2}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.gifItem}
            onPress={() => onGifSelect?.(item.url) ?? onSelect(item.url)}>
            <Image
              source={{uri: item.preview}}
              style={styles.gifImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        contentContainerStyle={{padding: 4}}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        {(['emoji', 'stickers', 'gifs'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'emoji'
                ? '😀 Emoji'
                : t === 'stickers'
                  ? '🎭 Stickers'
                  : '🎬 GIFs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Emoji tab ── */}
      {tab === 'emoji' && (
        <View style={styles.emojiTab}>
          {/* Category pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catScrollView}
            contentContainerStyle={styles.catScrollContent}>
            {EMOJI_CATEGORIES.map((cat, idx) => (
              <TouchableOpacity
                key={cat.label}
                style={[
                  styles.catPill,
                  emojiCat === idx && styles.catPillActive,
                ]}
                onPress={() => setEmojiCat(idx)}>
                <Text style={styles.catIcon}>{cat.icon}</Text>
                {emojiCat === idx && (
                  <Text style={styles.catLabel}>{cat.label}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Emoji grid */}
          <FlatList
            data={EMOJI_CATEGORIES[emojiCat].emojis}
            numColumns={8}
            keyExtractor={(item, idx) => `${emojiCat}-${idx}-${item}`}
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.emojiCell}
                onPress={() => onSelect(item)}
                activeOpacity={0.6}>
                <Text style={styles.emojiText}>{item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.emojiGrid}
            showsVerticalScrollIndicator={false}
            style={styles.emojiList}
          />
        </View>
      )}

      {/* ── Stickers tab ── */}
      {tab === 'stickers' && (
        <View style={styles.stickersTab}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catScrollView}
            contentContainerStyle={styles.catScrollContent}>
            {STICKER_PACKS.map((pack, idx) => (
              <TouchableOpacity
                key={pack.label}
                style={[
                  styles.catPill,
                  stickerPack === idx && styles.catPillActive,
                ]}
                onPress={() => setStickerPack(idx)}>
                <Text
                  style={[
                    styles.catLabel,
                    {color: stickerPack === idx ? '#fff' : '#9ca3af'},
                  ]}>
                  {pack.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={STICKER_PACKS[stickerPack].stickers}
            numColumns={4}
            keyExtractor={(item, idx) => `sticker-${stickerPack}-${idx}`}
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.stickerCell}
                onPress={() => onSelect(item)}
                activeOpacity={0.65}>
                <Text style={styles.stickerText}>{item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{padding: 8}}
            showsVerticalScrollIndicator={false}
            style={styles.emojiList}
          />
        </View>
      )}

      {/* ── GIFs tab ── */}
      {tab === 'gifs' && (
        <View style={styles.gifsTab}>
          <View style={styles.gifSearchRow}>
            <Ionicons
              name="search"
              size={16}
              color="#6b7280"
              style={{marginLeft: 12}}
            />
            <TextInput
              style={styles.gifSearchInput}
              placeholder="Search GIFs…"
              placeholderTextColor="#4b5563"
              value={gifSearch}
              onChangeText={setGifSearch}
              onSubmitEditing={() => searchGifs(gifSearch)}
              returnKeyType="search"
            />
            {gifSearch.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setGifSearch('');
                  setGifs([]);
                }}
                style={{marginRight: 8}}>
                <Ionicons name="close-circle" size={16} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>

          {/* Preset quick picks */}
          {gifs.length === 0 && !gifLoading && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{padding: 8, gap: 6}}>
              {GIF_PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset}
                  style={styles.gifPreset}
                  onPress={() => {
                    setGifSearch(preset);
                    searchGifs(preset);
                  }}>
                  <Text style={styles.gifPresetText}>{preset}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={{flex: 1}}>{renderGifGrid()}</View>
        </View>
      )}

      {/* ── Close strip ── */}
      <TouchableOpacity style={styles.closeStrip} onPress={onClose}>
        <View style={styles.closePill} />
      </TouchableOpacity>
    </View>
  );
};

const CELL = Math.floor((SW - 40) / 8);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111318',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1e2530',
    height: 300,
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e2530',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#60a5fa',
  },
  emojiTab: {flex: 1},
  stickersTab: {flex: 1},
  gifsTab: {flex: 1},
  catScrollView: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f28',
  },
  catScrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    alignItems: 'center',
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#1a1f28',
    gap: 4,
  },
  catPillActive: {
    backgroundColor: '#1e3a5f',
  },
  catIcon: {fontSize: 16},
  catLabel: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '600',
  },
  emojiList: {flex: 1},
  emojiGrid: {padding: 4},
  emojiCell: {
    width: CELL,
    height: CELL,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {fontSize: 26},
  stickerCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    backgroundColor: '#1a1f28',
    borderRadius: 12,
  },
  stickerText: {fontSize: 38},
  gifSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f28',
    margin: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e2530',
  },
  gifSearchInput: {
    flex: 1,
    color: '#f3f4f6',
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  gifPreset: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#1e2530',
    borderRadius: 20,
  },
  gifPresetText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  gifItem: {
    flex: 1,
    margin: 3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1f28',
  },
  gifImage: {
    width: '100%',
    height: 100,
  },
  gifPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 20,
  },
  gifPlaceholderTitle: {
    color: '#4b5563',
    fontSize: 16,
    fontWeight: '700',
  },
  gifPlaceholderText: {
    color: '#374151',
    fontSize: 13,
    textAlign: 'center',
  },
  closeStrip: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e2530',
  },
  closePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
  },
});

export default StickerPicker;
