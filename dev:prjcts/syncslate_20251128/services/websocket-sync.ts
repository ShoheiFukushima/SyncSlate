/**
 * WebSocket Sync Service
 * Enables synchronization across different devices and browsers
 * Falls back to BroadcastChannel for same-browser sync
 */

type WebSocketMessage =
  | { type: 'SYNC_STATE'; payload: any }
  | { type: 'CMD_START'; payload: { startTime: number } }
  | { type: 'CMD_STOP'; payload: { manual: boolean } }
  | { type: 'JOIN_SESSION'; payload: { sessionId: string; role: 'HOST' | 'CLIENT' } }
  | { type: 'LEAVE_SESSION'; payload: { sessionId: string } };

interface WebSocketSyncConfig {
  url?: string;
  sessionId: string;
  role: 'HOST' | 'CLIENT';
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export class WebSocketSync {
  private ws: WebSocket | null = null;
  private config: WebSocketSyncConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private broadcastChannel: BroadcastChannel | null = null;
  private isConnected = false;

  constructor(config: WebSocketSyncConfig) {
    this.config = config;

    // Initialize BroadcastChannel as fallback
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('sync-slate-v1');
      this.setupBroadcastChannel();
    }

    // Only connect to WebSocket if URL is provided
    if (config.url) {
      this.connect();
    }
  }

  private setupBroadcastChannel() {
    if (!this.broadcastChannel) return;

    this.broadcastChannel.addEventListener('message', (event) => {
      // Forward BroadcastChannel messages when WebSocket is not connected
      if (!this.isConnected && this.config.onMessage) {
        this.config.onMessage(event.data);
      }
    });
  }

  private connect() {
    if (!this.config.url) return;

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        // Join session
        this.send({
          type: 'JOIN_SESSION',
          payload: {
            sessionId: this.config.sessionId,
            role: this.config.role
          }
        });

        if (this.config.onConnect) {
          this.config.onConnect();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;

          // Forward to BroadcastChannel for local sync
          if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(message);
          }

          if (this.config.onMessage) {
            this.config.onMessage(message);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;

        if (this.config.onDisconnect) {
          this.config.onDisconnect();
        }

        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);

        if (this.config.onError) {
          this.config.onError(new Error('WebSocket connection error'));
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  send(message: WebSocketMessage) {
    // Send via WebSocket if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }

    // Always send via BroadcastChannel for local sync
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(message);
    }
  }

  broadcast(message: WebSocketMessage) {
    this.send(message);
  }

  startCountdown(delayMs: number = 500) {
    const startTime = Date.now() + delayMs;
    this.send({
      type: 'CMD_START',
      payload: { startTime }
    });
  }

  stopCountdown(manual: boolean = true) {
    this.send({
      type: 'CMD_STOP',
      payload: { manual }
    });
  }

  syncState(state: any) {
    this.send({
      type: 'SYNC_STATE',
      payload: state
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // Send leave message before closing
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'LEAVE_SESSION',
          payload: { sessionId: this.config.sessionId }
        });
      }

      this.ws.close();
      this.ws = null;
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    this.isConnected = false;
  }

  isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  isBroadcastChannelAvailable(): boolean {
    return this.broadcastChannel !== null;
  }
}

/**
 * Factory function to create WebSocketSync instance
 * Automatically determines if WebSocket should be used
 */
export function createSyncService(sessionId: string, role: 'HOST' | 'CLIENT'): WebSocketSync {
  // Get WebSocket URL from environment or use default
  const wsUrl = process.env.VITE_WEBSOCKET_URL || '';

  return new WebSocketSync({
    url: wsUrl,
    sessionId,
    role,
    onConnect: () => {
      console.log(`Connected as ${role} to session ${sessionId}`);
    },
    onDisconnect: () => {
      console.log('Disconnected from sync service');
    },
    onError: (error) => {
      console.error('Sync service error:', error);
    }
  });
}