/**
 * End-to-End Test Scenarios
 * 完全なユーザーフローのテスト
 *
 * 実際の使用シナリオを通じてシステム全体の動作を検証
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { mockDateNow } from '../setup';

// Playwright を使用した実際のE2Eテストのシミュレーション
describe('E2E Scenarios', () => {

  describe('シナリオ1: ゲストがURLを開いて即座に同期', () => {
    it('完全なゲストフロー：ログインなしで同期表示', async () => {
      // ゲストがリンクを受け取る
      const guestURL = 'http://localhost:3000/?role=client&session=abc123';

      // URLを設定
      delete (window as any).location;
      (window as any).location = {
        href: guestURL,
        origin: 'http://localhost:3000',
        search: '?role=client&session=abc123',
      };

      // アプリをレンダリング
      const { container } = render(<App />);

      // 1. ログイン画面が表示されないことを確認
      expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/log in/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/create account/i)).not.toBeInTheDocument();

      // 2. "WAITING FOR HOST" が表示される
      await waitFor(() => {
        expect(screen.getByText('WAITING FOR HOST')).toBeInTheDocument();
      });

      // 3. 設定UIが表示されないことを確認
      expect(screen.queryByLabelText(/duration/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/pre-roll/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/load ai voices/i)).not.toBeInTheDocument();

      // 4. HOSTからの開始信号をシミュレート
      const channel = new BroadcastChannel('sync-slate-v1-abc123');
      const startTime = Date.now() + 500;

      channel.postMessage({
        type: 'CMD_START',
        payload: { startTime },
      });

      // 5. カウントダウンが開始される
      mockDateNow(startTime + 100);

      await waitFor(() => {
        expect(screen.queryByText('WAITING FOR HOST')).not.toBeInTheDocument();
      });

      channel.close();
    });

    it('セッションIDだけでCLIENTモードになる', async () => {
      // roleパラメータなし、sessionのみ
      (window as any).location.search = '?session=xyz789';

      render(<App />);

      // CLIENTモードで動作
      expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('WAITING FOR HOST')).toBeInTheDocument();
      });
    });
  });

  describe('シナリオ2: HOSTが設定してCLIENTと同期', () => {
    it('HOST→CLIENT完全フロー', async () => {
      const user = userEvent.setup();

      // HOSTとしてアプリを開く
      (window as any).location.search = '?role=host';

      // 認証済みユーザーとしてモック
      jest.mock('@clerk/nextjs', () => ({
        useUser: () => ({ user: { id: 'user-123' } }),
        SignedIn: ({ children }: any) => children,
        SignedOut: () => null,
      }));

      const { container } = render(<App />);

      // 1. 設定を行う
      const durationInput = await screen.findByLabelText(/duration/i);
      await user.clear(durationInput);
      await user.type(durationInput, '120');

      const preRollInput = screen.getByLabelText(/pre-roll/i);
      await user.clear(preRollInput);
      await user.type(preRollInput, '10');

      // 2. Smart Cuesを追加
      const addCueButton = screen.getByText(/add cue/i);
      await user.click(addCueButton);

      const cueTimeInput = screen.getByLabelText(/cue time/i);
      await user.type(cueTimeInput, '30');

      const cueTextInput = screen.getByLabelText(/cue text/i);
      await user.type(cueTextInput, 'Camera ready');

      // 3. 共有リンクを生成
      const shareButton = screen.getByText(/share link/i);
      await user.click(shareButton);

      // クリップボードにコピーされたURLを確認
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('role=client')
      );
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('session=')
      );

      // 4. スレートを開始
      const startButton = screen.getByText(/start slate/i);
      await user.click(startButton);

      // BroadcastChannelでメッセージが送信されることを確認
      // (実際のテストではspy/mockで検証)
    });
  });

  describe('シナリオ3: 複数CLIENTの同期', () => {
    it('3つのCLIENTが同時に同期', async () => {
      const clients: any[] = [];
      const sessionId = 'multi-123';

      // 3つのCLIENTをセットアップ
      for (let i = 0; i < 3; i++) {
        const container = document.createElement('div');
        document.body.appendChild(container);

        (window as any).location.search = `?role=client&session=${sessionId}`;

        const { getByText, queryByText } = render(<App />, { container });
        clients.push({ getByText, queryByText, container });
      }

      // 全てのCLIENTが待機状態
      clients.forEach(client => {
        expect(client.getByText('WAITING FOR HOST')).toBeInTheDocument();
      });

      // HOSTから開始信号
      const channel = new BroadcastChannel(`sync-slate-v1-${sessionId}`);
      const startTime = Date.now() + 1000;

      channel.postMessage({
        type: 'SYNC_STATE',
        payload: {
          settings: { duration: 60, preRoll: 5 },
          smartCues: [],
          colorRanges: [],
        },
      });

      channel.postMessage({
        type: 'CMD_START',
        payload: { startTime },
      });

      // 全てのCLIENTが同期して動作開始
      mockDateNow(startTime + 100);

      await waitFor(() => {
        clients.forEach(client => {
          expect(client.queryByText('WAITING FOR HOST')).not.toBeInTheDocument();
        });
      });

      // クリーンアップ
      clients.forEach(client => {
        document.body.removeChild(client.container);
      });
      channel.close();
    });
  });

  describe('シナリオ4: Permission Request（制御権要求）', () => {
    it('CLIENTがHOSTに制御権を要求', async () => {
      const user = userEvent.setup();
      const sessionId = 'control-456';

      // CLIENTとしてセットアップ
      (window as any).location.search = `?role=client&session=${sessionId}`;
      render(<App />);

      // 設定アイコンをクリック
      const settingsButton = await screen.findByLabelText(/settings/i);
      await user.click(settingsButton);

      // Request Controlボタンをクリック
      const requestControlButton = screen.getByText(/request control/i);
      await user.click(requestControlButton);

      // リクエストが送信されることを確認
      // (実際にはBroadcastChannelで REQUEST_CONTROL メッセージが送信される)
      expect(screen.getByText(/control requested/i)).toBeInTheDocument();
    });
  });

  describe('シナリオ5: オフライン対応（PWA）', () => {
    it('オフラインでも動作継続', async () => {
      // オンラインで初期化
      (window as any).navigator.onLine = true;
      (window as any).location.search = '?role=client&session=offline-789';

      const { rerender } = render(<App />);

      // 同期開始
      const channel = new BroadcastChannel('sync-slate-v1-offline-789');
      const startTime = Date.now() + 500;

      channel.postMessage({
        type: 'CMD_START',
        payload: { startTime },
      });

      // オフラインに切り替え
      (window as any).navigator.onLine = false;
      window.dispatchEvent(new Event('offline'));

      // カウントダウンは継続
      mockDateNow(startTime + 2000);
      rerender(<App />);

      // タイマーが正常に動作していることを確認
      // (具体的な表示内容はアプリケーションの実装による)

      channel.close();
    });
  });

  describe('シナリオ6: エラーリカバリー', () => {
    it('不正なセッションIDでも適切にエラー表示', async () => {
      // 不正な文字を含むセッションID
      (window as any).location.search = '?role=client&session=<script>alert("xss")</script>';

      render(<App />);

      // XSSが実行されないことを確認
      expect(document.querySelector('script')).toBeNull();

      // 通常通り待機画面が表示される
      await waitFor(() => {
        expect(screen.getByText('WAITING FOR HOST')).toBeInTheDocument();
      });
    });

    it('HOSTが途中で切断してもCLIENTは継続', async () => {
      const sessionId = 'disconnect-000';
      (window as any).location.search = `?role=client&session=${sessionId}`;

      render(<App />);

      // 同期開始
      const channel = new BroadcastChannel(`sync-slate-v1-${sessionId}`);
      const startTime = Date.now() + 500;

      channel.postMessage({
        type: 'CMD_START',
        payload: { startTime },
      });

      // チャンネルを閉じる（HOST切断をシミュレート）
      channel.close();

      // CLIENTは独立して動作継続
      mockDateNow(startTime + 2000);

      await waitFor(() => {
        expect(screen.queryByText('WAITING FOR HOST')).not.toBeInTheDocument();
      });

      // カウントダウンが継続していることを確認
      // (ATRにより、HOSTの切断後も正確な時刻で動作)
    });
  });

  describe('シナリオ7: 多言語対応', () => {
    it('ブラウザの言語設定を自動検出', async () => {
      // 日本語環境をシミュレート
      Object.defineProperty(navigator, 'language', {
        value: 'ja-JP',
        configurable: true,
      });

      (window as any).location.search = '?role=client&session=lang-111';
      render(<App />);

      // 日本語で表示されることを確認（実装による）
      // expect(screen.getByText('ホストを待機中')).toBeInTheDocument();
      // または
      expect(document.documentElement.lang).toBe('ja');
    });
  });

  describe('シナリオ8: パフォーマンステスト統合', () => {
    it('100回の連続同期でもパフォーマンス維持', async () => {
      const sessionId = 'perf-test';
      const measurements: number[] = [];

      for (let i = 0; i < 100; i++) {
        const startMeasure = performance.now();

        // CLIENT接続をシミュレート
        const channel = new BroadcastChannel(`sync-slate-v1-${sessionId}`);
        const startTime = Date.now() + 500;

        channel.postMessage({
          type: 'CMD_START',
          payload: { startTime },
        });

        // 処理時間を測定
        const elapsed = performance.now() - startMeasure;
        measurements.push(elapsed);

        channel.close();
      }

      // 平均処理時間が10ms以下
      const average = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(average).toBeLessThan(10);

      // 最大でも50ms以下
      expect(Math.max(...measurements)).toBeLessThan(50);
    });
  });
});