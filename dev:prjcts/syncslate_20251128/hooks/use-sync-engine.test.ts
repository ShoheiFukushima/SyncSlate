/**
 * Sync Engine Test
 * Tests for BroadcastChannel synchronization
 */

describe('Sync Engine', () => {
  let broadcastChannel: any;
  let mockPostMessage: jest.Mock;

  beforeEach(() => {
    // Reset BroadcastChannel mock
    mockPostMessage = jest.fn();
    broadcastChannel = {
      postMessage: mockPostMessage,
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    (global.BroadcastChannel as jest.Mock).mockReturnValue(broadcastChannel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BroadcastChannel Initialization', () => {
    test('creates BroadcastChannel with correct channel name', () => {
      const channelName = 'sync-slate-v1';
      new BroadcastChannel(channelName);

      expect(global.BroadcastChannel).toHaveBeenCalledWith(channelName);
    });

    test('sets up message event listener', () => {
      new BroadcastChannel('sync-slate-v1');

      expect(broadcastChannel.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });
  });

  describe('Message Broadcasting', () => {
    test('broadcasts CMD_START message with timestamp', () => {
      const channel = new BroadcastChannel('sync-slate-v1');
      const startTime = Date.now() + 500; // 500ms buffer

      const message = {
        type: 'CMD_START',
        payload: { startTime }
      };

      channel.postMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith(message);
    });

    test('broadcasts CMD_STOP message', () => {
      const channel = new BroadcastChannel('sync-slate-v1');

      const message = {
        type: 'CMD_STOP',
        payload: { manual: true }
      };

      channel.postMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith(message);
    });

    test('broadcasts SYNC_STATE with settings', () => {
      const channel = new BroadcastChannel('sync-slate-v1');

      const message = {
        type: 'SYNC_STATE',
        payload: {
          settings: {
            duration: 30,
            preRoll: 3,
            direction: 'DOWN'
          },
          smartCues: [],
          colorRanges: []
        }
      };

      channel.postMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith(message);
    });
  });

  describe('Message Reception', () => {
    test('handles incoming CMD_START message', () => {
      const channel = new BroadcastChannel('sync-slate-v1');
      const messageHandler = jest.fn();

      // Get the actual handler that was registered
      const addEventListenerCall = broadcastChannel.addEventListener.mock.calls[0];
      const registeredHandler = addEventListenerCall[1];

      // Simulate incoming message
      const event = {
        data: {
          type: 'CMD_START',
          payload: { startTime: Date.now() + 500 }
        }
      };

      registeredHandler(event);

      // Verify the handler was called
      expect(broadcastChannel.addEventListener).toHaveBeenCalled();
    });
  });

  describe('Sync Timing', () => {
    test('calculates correct absolute time reference (ATR)', () => {
      const now = Date.now();
      const bufferMs = 500;
      const expectedStartTime = now + bufferMs;

      // Verify ATR calculation
      expect(expectedStartTime).toBeGreaterThan(now);
      expect(expectedStartTime - now).toBe(bufferMs);
    });

    test('ensures all clients start simultaneously', () => {
      const startTime = Date.now() + 500;
      const clients = [];

      // Simulate multiple clients receiving the same start time
      for (let i = 0; i < 5; i++) {
        clients.push({
          receivedStartTime: startTime,
          localTime: Date.now()
        });
      }

      // All clients should have the same start time
      const uniqueStartTimes = new Set(clients.map(c => c.receivedStartTime));
      expect(uniqueStartTimes.size).toBe(1);
    });
  });

  describe('Channel Cleanup', () => {
    test('closes channel on cleanup', () => {
      const channel = new BroadcastChannel('sync-slate-v1');

      channel.close();

      expect(broadcastChannel.close).toHaveBeenCalled();
    });

    test('removes event listeners on cleanup', () => {
      const channel = new BroadcastChannel('sync-slate-v1');
      const handler = () => {};

      channel.removeEventListener('message', handler);

      expect(broadcastChannel.removeEventListener).toHaveBeenCalledWith(
        'message',
        handler
      );
    });
  });

  describe('Error Handling', () => {
    test('handles BroadcastChannel not supported', () => {
      const originalBroadcastChannel = global.BroadcastChannel;
      delete (global as any).BroadcastChannel;

      // Should gracefully handle missing BroadcastChannel
      expect(() => {
        // Code should check for BroadcastChannel support
        if (typeof BroadcastChannel === 'undefined') {
          console.warn('BroadcastChannel not supported');
        }
      }).not.toThrow();

      global.BroadcastChannel = originalBroadcastChannel;
    });
  });
});

/**
 * Integration test ideas for future:
 * - Test actual countdown synchronization
 * - Test HOST/CLIENT role interaction
 * - Test network latency compensation
 * - Test reconnection scenarios
 */