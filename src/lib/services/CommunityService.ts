// lib/services/CommunityService.ts
import {supabaseClient} from './login';
import {userSession} from './login';

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'sticker';
  url: string;
  thumbnail?: string;
  mimeType?: string;
}

export interface CommunityMessage {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_photo?: string | null;
  message: string;
  channel: string;
  is_edited?: boolean;
  attachments?: Attachment[];
  reactions?: Record<string, string[]>; // emoji → [user_ids]
  created_at: string;
  reply_to?: {
    id: string;
    user_id: string;
    user_name: string;
    message: string;
  } | null; 
}

export const CHANNELS = [
  'General',
  'Anime',
  'Movie',
  'TV Show',
  'Off-Topic',
  'Suggestions',
  'Help',
];

class CommunityService {
  // 👇 FIX: Store the global channel here so we can strictly manage it
  private globalChannel: any = null; 

  async fetchMessages(channel: string = 'General'): Promise<CommunityMessage[]> {
    const {data, error} = await supabaseClient
      .from('community_messages')
      .select('*')
      .eq('channel', channel)
      .order('created_at', {ascending: true})
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }

  async sendMessage(
    text: string,
    channel: string = 'General',
    attachments: Attachment[] = [],
    replyTo?: CommunityMessage['reply_to'] 
  ): Promise<CommunityMessage> {
    const user = userSession.getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const trimmedText = (text ?? '').trim();
    if (!trimmedText && attachments.length === 0) {
      throw new Error('Message cannot be empty');
    }

    const payload = {
      user_id: user.id,
      user_email: user.email ?? '',
      user_name: user.name ?? 'User',
      user_photo: userSession.getBestPhotoUri?.() ?? null,
      message: trimmedText,
      channel,
      attachments,
      reply_to: replyTo,
    };

    const {data, error} = await supabaseClient
      .from('community_messages')
      .insert(payload)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  async sendSticker(
    sticker: string,
    channel: string = 'General',
  ): Promise<CommunityMessage> {
    return this.sendMessage('', channel, [{type: 'sticker', url: sticker}]);
  }

  async editMessage(messageId: string, newText: string): Promise<void> {
    const trimmed = newText.trim();
    if (!trimmed) throw new Error('Message cannot be empty');
    const {error} = await supabaseClient
      .from('community_messages')
      .update({message: trimmed, is_edited: true})
      .eq('id', messageId);
    if (error) throw error;
  }

  async deleteMessage(messageId: string): Promise<void> {
    const {data, error} = await supabaseClient
      .from('community_messages')
      .delete()
      .eq('id', messageId)
      .select();
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Deletion blocked. Check RLS policies.');
    }
  }

  async addReaction(messageId: string, emoji: string, userId: string): Promise<void> {
    const {data, error} = await supabaseClient
      .from('community_messages')
      .select('reactions')
      .eq('id', messageId)
      .single();
    if (error) throw error;

    const reactions: Record<string, string[]> = data?.reactions ?? {};
    const current = reactions[emoji] ?? [];
    const hasReacted = current.includes(userId);

    if (hasReacted) {
      reactions[emoji] = current.filter(id => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...current, userId];
    }

    const {error: updateError} = await supabaseClient
      .from('community_messages')
      .update({reactions})
      .eq('id', messageId);
    if (updateError) throw updateError;
  }

  subscribeToMessages(
    channel: string = 'General',
    onMessageEvent: (payload: any) => void,
  ) {
    return supabaseClient
      .channel(`community_${channel}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_messages',
          filter: `channel=eq.${channel}`,
        },
        onMessageEvent,
      )
      .subscribe();
  }

  subscribeToAllMessages(onMessageEvent: (payload: any) => void) {
    // 👇 FIX: If a channel already exists (from React hot reload), kill it first!
    if (this.globalChannel) {
      supabaseClient.removeChannel(this.globalChannel);
    }

    const uniqueChannelName = `global_chat_${Date.now()}`;

    // 👇 FIX: Store the new connection safely in the class
    this.globalChannel = supabaseClient
      .channel(uniqueChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_messages',
        },
        onMessageEvent,
      );

    this.globalChannel.subscribe((status: string, err: any) => {
      console.log('🌍 Global Channel Status:', status);
      if (err) {
        console.error('❌ Global Channel Error:', err);
      }
    });

    return this.globalChannel;
  }

  // 👇 NEW: Cleanup function to be called from Community.tsx
  unsubscribeAllMessages() {
    if (this.globalChannel) {
      supabaseClient.removeChannel(this.globalChannel);
      this.globalChannel = null;
    }
  }
}

export const communityService = new CommunityService();