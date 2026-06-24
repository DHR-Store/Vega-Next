class DiscordRPCService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private sequence: number | null = null;
  private isIdentified: boolean = false;

  private reconnectTimeout: any = null;
  private readonly APP_ID = 'YOUR_APP_ID';
  
  // 🔴 Your Webhook URL
  private readonly WEBHOOK_URL = 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN';

  private pendingPresence: {
    title: string;
    state: string;
    startTime?: number;
    endTime?: number;
    posterUrl?: any;
    providerName?: string;
  } | null = null;

  public connect(token: string) {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING) &&
      this.token === token
    ) {
      return;
    }

    if (this.ws) this.disconnect();

    this.token = token;
    this.isIdentified = false;
    this.sequence = null;

    this.ws = new WebSocket(
      'wss://gateway.discord.gg/?v=10&encoding=json',
      [],
      {
        headers: {
          'User-Agent': 'Discord/1.0.9016',
          Origin: 'https://discord.com',
        },
      }
    );

    this.ws.onopen = () => {
      console.log('[DiscordRPC] Connected to Gateway');
    };

    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string);
        const { op, d, s, t } = payload;

        if (s !== null && s !== undefined) this.sequence = s;

        if (op === 10) {
          this.startHeartbeat(d.heartbeat_interval);
          this.identify();
        }

        if (op === 0 && t === 'READY') {
          console.log('[DiscordRPC] Authenticated!');
          this.isIdentified = true;

          if (this.pendingPresence) {
            setTimeout(() => {
              this.updatePresence(
                this.pendingPresence!.title,
                this.pendingPresence!.state,
                this.pendingPresence!.startTime,
                this.pendingPresence!.endTime,
                this.pendingPresence!.posterUrl,
                this.pendingPresence!.providerName
              );
              this.pendingPresence = null;
            }, 1000);
          }
        }
      } catch (error) {
        console.error('[DiscordRPC] Parse Error:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[DiscordRPC] Disconnected (Code: ${event.code})`);
      this.isIdentified = false;
      this.stopHeartbeat();

      this.reconnectTimeout = setTimeout(() => {
        if (this.token) this.connect(this.token);
      }, 3000);
    };

    this.ws.onerror = (error) =>
      console.error('[DiscordRPC] WebSocket Error:', error);
  }

  private truncateText(text: string, max: number = 128): string {
    if (!text) return '';
    return text.length > max ? text.substring(0, max - 3) + '...' : text;
  }

  /**
   * 🚀 NEW TRICK: Uses a Discord Webhook to force Discord to generate an "mp:external/" proxy URL
   * This handles Discord's new dynamic proxy subdomains (images-ext-1, media.discordapp, etc.)
   */
  private async getDiscordProxyUrl(imageUrl: string): Promise<string | null> {
    if (!this.WEBHOOK_URL || this.WEBHOOK_URL.includes('YOUR_WEBHOOK_ID')) return null;

    try {
      console.log('[DiscordRPC] Requesting media proxy URL via Webhook...');
      // ?wait=true tells Discord to respond with the message object (which contains the proxy URL)
      const res = await fetch(`${this.WEBHOOK_URL}?wait=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{ image: { url: imageUrl } }]
        })
      });

      if (!res.ok) {
        console.error('[DiscordRPC] Webhook failed. Check your Webhook URL.');
        return null;
      }

      const data = await res.json();
      const proxyUrl = data.embeds?.[0]?.image?.proxy_url;
      const messageId = data.id;

      // Silently delete the message immediately so your Discord channel doesn't get spammed
      if (messageId) {
        fetch(`${this.WEBHOOK_URL}/messages/${messageId}`, { method: 'DELETE' }).catch(() => {});
      }

      console.log(`[DiscordRPC] Raw Webhook Response URL: ${proxyUrl}`);

      if (proxyUrl) {
        let formattedMp: string | null = null;

        // Extract the unique hash regardless of which subdomain Discord uses
        if (proxyUrl.includes('/external/')) {
          formattedMp = `mp:external/${proxyUrl.split('/external/')[1]}`;
        } else if (proxyUrl.includes('/ext/')) {
          formattedMp = `mp:external/${proxyUrl.split('/ext/')[1]}`;
        }

        if (formattedMp) {
          console.log(`[DiscordRPC] Successfully proxied image! Format: ${formattedMp}`);
          return formattedMp;
        }
      }

      console.error('[DiscordRPC] Could not extract external hash from proxy URL.');
      return null;
    } catch (error) {
      console.error('[DiscordRPC] Webhook proxy exception:', error);
      return null;
    }
  }

  public async updatePresence(
    movieTitle: string,
    stateText: string,
    startTime?: number,
    endTime?: number,
    posterUrl?: any,
    providerName?: string
  ) {
    if (
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.isIdentified
    ) {
      this.pendingPresence = {
        title: movieTitle,
        state: stateText,
        startTime,
        endTime,
        posterUrl,
        providerName,
      };
      return;
    }

    const displayProvider = providerName || 'Vega';
    let safeTitle = movieTitle && movieTitle.length >= 2 ? movieTitle : 'Watching Video';
    safeTitle = this.truncateText(safeTitle, 128);

    const finalStateText = this.truncateText(
      `Provider - ${displayProvider} | ${stateText}`,
      128
    );

    const activity: any = {
      name: 'Vega Next',
      type: 3,
      details: safeTitle,
      state: finalStateText,
      application_id: this.APP_ID,
    };

    const VEGA_ICON_ASSET_ID = '1488247100549365781';
    let largeImageId = '1488154301208465508'; // Default fallback

    // Pass the raw image URL to our Webhook Proxy to get a Discord-approved link
    if (typeof posterUrl === 'string' && posterUrl.startsWith('http')) {
      const proxiedUrl = await this.getDiscordProxyUrl(posterUrl);
      if (proxiedUrl) {
        largeImageId = proxiedUrl; 
      }
    }

    activity.assets = {
      large_image: largeImageId,
      large_text: safeTitle,
      small_image: VEGA_ICON_ASSET_ID,
      small_text: 'Vega Next',
    };

    if (startTime || endTime) {
      activity.timestamps = {};
      const TIME_OFFSET_MS = 0;

      if (startTime) {
        activity.timestamps.start = Math.floor(startTime + TIME_OFFSET_MS);
      }
      if (endTime) {
        activity.timestamps.end = Math.floor(endTime + TIME_OFFSET_MS);
      }
    }

    const payload = {
      op: 3,
      d: {
        since: Date.now(),
        activities: [activity],
        status: 'online',
        afk: false,
      },
    };

    console.log('[DiscordRPC] Sending Final Payload:', JSON.stringify(payload));
    this.ws.send(JSON.stringify(payload));
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'User requested disconnect');
      this.ws = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.stopHeartbeat();
    this.token = null;
    this.isIdentified = false;
    this.sequence = null;
  }

  private identify() {
    if (!this.ws || !this.token) return;

    this.ws.send(
      JSON.stringify({
        op: 2,
        d: {
          token: this.token,
          capabilities: 65,
          properties: {
            os: 'Windows',
            browser: 'Discord Client',
            device: 'Discord Client',
          },
          compress: false,
        },
      })
    );
  }

  private startHeartbeat(interval: number) {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 1, d: this.sequence }));
      }
    }, interval);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const DiscordRPC = new DiscordRPCService();