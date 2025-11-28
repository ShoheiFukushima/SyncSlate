/**
 * Synchronization Service Tests
 * BroadcastChannelを使用した同期機能のテスト
 *
 * HOST/CLIENT間のリアルタイム同期を保証
 */

import { SyncService, SyncMessage, SyncState } from '../../src/services/syncService';
import { mockDateNow } from '../setup';

describe('SyncService', () => {
  let hostService: SyncService;
  let clientService: SyncService;

  beforeEach(() => {
    hostService = new SyncService('HOST');
    clientService = new SyncService('CLIENT');
  });

  afterEach(() => {
    hostService.disconnect();
    clientService.disconnect();
  });

  describe('基本的な同期', () => {
    it('HOSTからCLIENTへメッセージが送信される', async () => {
      const messageReceived = jest.fn();
      clientService.onMessage(messageReceived);

      const testMessage: SyncMessage = {
        type: 'SYNC_STATE',
        payload: {
          settings: {
            duration: 60,
            preRoll: 5,
          },
          smartCues: [],
          colorRanges: [],
        },
      };

      hostService.sendMessage(testMessage);

      // BroadcastChannelは非同期
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(messageReceived).toHaveBeenCalledWith(testMessage);
    });

    it('複数のCLIENTが同時に受信できる', async () => {
      const client1Received = jest.fn();
      const client2Received = jest.fn();

      const client1 = new SyncService('CLIENT');
      const client2 = new SyncService('CLIENT');

      client1.onMessage(client1Received);
      client2.onMessage(client2Received);

      const testMessage: SyncMessage = {
        type: 'CMD_START',
        payload: { startTime: Date.now() + 1000 },
      };

      hostService.sendMessage(testMessage);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(client1Received).toHaveBeenCalledWith(testMessage);
      expect(client2Received).toHaveBeenCalledWith(testMessage);

      client1.disconnect();
      client2.disconnect();
    });

    it('CLIENTからHOSTへは送信できない（読み取り専用）', async () => {
      const hostReceived = jest.fn();
      hostService.onMessage(hostReceived);

      // CLIENTは送信メソッドを持たないべき
      expect((clientService as any).sendMessage).toBeUndefined();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(hostReceived).not.toHaveBeenCalled();
    });
  });

  describe('CMD_START メッセージ', () => {
    it('開始コマンドが正しく送受信される', async () => {
      const clientReceived = jest.fn();
      clientService.onMessage(clientReceived);

      const futureTime = Date.now() + 500; // 500ms後に開始
      hostService.sendStartCommand(futureTime);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(clientReceived).toHaveBeenCalledWith({
        type: 'CMD_START',
        payload: { startTime: futureTime },
      });
    });

    it('過去の時間では開始コマンドを送信しない', () => {
      const sendSpy = jest.spyOn(hostService, 'sendMessage');
      const pastTime = Date.now() - 1000;

      expect(() => {
        hostService.sendStartCommand(pastTime);
      }).toThrow('Start time must be in the future');

      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe('CMD_STOP メッセージ', () => {
    it('停止コマンドが正しく送受信される', async () => {
      const clientReceived = jest.fn();
      clientService.onMessage(clientReceived);

      hostService.sendStopCommand(true);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(clientReceived).toHaveBeenCalledWith({
        type: 'CMD_STOP',
        payload: { manual: true },
      });
    });
  });

  describe('SYNC_STATE メッセージ', () => {
    it('状態同期メッセージが正しく送受信される', async () => {
      const clientReceived = jest.fn();
      clientService.onMessage(clientReceived);

      const state: SyncState = {
        settings: {
          duration: 120,
          preRoll: 10,
          actionText: 'Action!',
          cutText: 'Cut!',
        },
        smartCues: [
          { time: 5, text: 'Ready', voice: true },
          { time: 10, text: 'Set', voice: false },
        ],
        colorRanges: [
          { start: 0, end: 10, color: '#00FF00' },
          { start: 110, end: 120, color: '#FF0000' },
        ],
      };

      hostService.syncState(state);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(clientReceived).toHaveBeenCalledWith({
        type: 'SYNC_STATE',
        payload: state,
      });
    });
  });

  describe('接続管理', () => {
    it('disconnectを呼ぶとメッセージを受信しなくなる', async () => {
      const clientReceived = jest.fn();
      clientService.onMessage(clientReceived);

      clientService.disconnect();

      hostService.sendMessage({
        type: 'CMD_START',
        payload: { startTime: Date.now() + 1000 },
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(clientReceived).not.toHaveBeenCalled();
    });

    it('再接続が可能', async () => {
      const clientReceived = jest.fn();

      clientService.disconnect();
      clientService = new SyncService('CLIENT');
      clientService.onMessage(clientReceived);

      hostService.sendMessage({
        type: 'CMD_STOP',
        payload: { manual: false },
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(clientReceived).toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング', () => {
    it('不正なメッセージタイプは無視される', async () => {
      const clientReceived = jest.fn();
      const errorHandler = jest.fn();

      clientService.onMessage(clientReceived);
      clientService.onError(errorHandler);

      // 不正なメッセージを直接送信
      const channel = new BroadcastChannel('sync-slate-v1');
      channel.postMessage({ type: 'INVALID_TYPE', payload: {} });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(clientReceived).not.toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid message type'),
        })
      );

      channel.close();
    });

    it('ペイロードが欠けているメッセージはエラーになる', async () => {
      const errorHandler = jest.fn();
      clientService.onError(errorHandler);

      const channel = new BroadcastChannel('sync-slate-v1');
      channel.postMessage({ type: 'CMD_START' }); // payloadなし

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorHandler).toHaveBeenCalled();

      channel.close();
    });
  });

  describe('メッセージバッファリング', () => {
    it('高頻度のメッセージも全て受信される', async () => {
      const clientReceived = jest.fn();
      clientService.onMessage(clientReceived);

      // 連続して10メッセージ送信
      for (let i = 0; i < 10; i++) {
        hostService.sendMessage({
          type: 'SYNC_STATE',
          payload: {
            settings: { duration: i, preRoll: 0 },
            smartCues: [],
            colorRanges: [],
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(clientReceived).toHaveBeenCalledTimes(10);
    });
  });

  describe('Permission Request（CLIENT→HOST）', () => {
    it('CLIENTが制御権を要求できる', async () => {
      const hostReceived = jest.fn();
      hostService.onMessage(hostReceived);

      // Permission Request機能の実装
      const permissionChannel = new BroadcastChannel('sync-slate-v1');
      permissionChannel.postMessage({
        type: 'REQUEST_CONTROL',
        payload: { clientId: 'client-123' },
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(hostReceived).toHaveBeenCalledWith({
        type: 'REQUEST_CONTROL',
        payload: { clientId: 'client-123' },
      });

      permissionChannel.close();
    });
  });

  describe('チャンネル分離', () => {
    it('異なるセッションIDは異なるチャンネルを使用', async () => {
      const session1Host = new SyncService('HOST', 'session-1');
      const session1Client = new SyncService('CLIENT', 'session-1');
      const session2Client = new SyncService('CLIENT', 'session-2');

      const client1Received = jest.fn();
      const client2Received = jest.fn();

      session1Client.onMessage(client1Received);
      session2Client.onMessage(client2Received);

      session1Host.sendMessage({
        type: 'CMD_START',
        payload: { startTime: Date.now() + 1000 },
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // session-1のクライアントのみが受信
      expect(client1Received).toHaveBeenCalled();
      expect(client2Received).not.toHaveBeenCalled();

      session1Host.disconnect();
      session1Client.disconnect();
      session2Client.disconnect();
    });
  });
});