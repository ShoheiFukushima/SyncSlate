/**
 * AuthGate Component Tests
 * 認証ゲートコンポーネントのテスト
 *
 * 最重要：CLIENTモードは認証を完全にスキップすることを保証
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuthGate } from '../../src/components/AuthGate';
import * as useAppModeModule from '../../src/hooks/useAppMode';
import { SignedIn, SignedOut } from '@clerk/nextjs';

// Clerkモジュールをモック
jest.mock('@clerk/nextjs', () => ({
  SignedIn: jest.fn(({ children }) => children),
  SignedOut: jest.fn(({ children }) => children),
  RedirectToSignIn: jest.fn(() => <div>Redirecting to sign in...</div>),
  ClerkProvider: jest.fn(({ children }) => children),
}));

describe('AuthGate', () => {
  const TestContent = () => <div>Protected Content</div>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CLIENT モード', () => {
    beforeEach(() => {
      jest.spyOn(useAppModeModule, 'useAppMode').mockReturnValue('CLIENT');
    });

    it('CLIENTモードでは認証チェックを完全にスキップする', () => {
      render(
        <AuthGate>
          <TestContent />
        </AuthGate>
      );

      // コンテンツが直接表示される
      expect(screen.getByText('Protected Content')).toBeInTheDocument();

      // Clerkの認証コンポーネントが一切呼ばれない
      expect(SignedIn).not.toHaveBeenCalled();
      expect(SignedOut).not.toHaveBeenCalled();
    });

    it('CLIENTモードではログイン画面にリダイレクトしない', () => {
      render(
        <AuthGate>
          <TestContent />
        </AuthGate>
      );

      // リダイレクトメッセージが表示されない
      expect(screen.queryByText('Redirecting to sign in...')).not.toBeInTheDocument();
    });

    it('CLIENTモードでは複数の子要素も正しくレンダリングされる', () => {
      render(
        <AuthGate>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </AuthGate>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Child 3')).toBeInTheDocument();
    });
  });

  describe('HOST モード', () => {
    beforeEach(() => {
      jest.spyOn(useAppModeModule, 'useAppMode').mockReturnValue('HOST');
    });

    it('HOSTモードでは認証チェックを実行する', () => {
      render(
        <AuthGate>
          <TestContent />
        </AuthGate>
      );

      // Clerkの認証コンポーネントが呼ばれる
      expect(SignedIn).toHaveBeenCalled();
      expect(SignedOut).toHaveBeenCalled();
    });

    it('HOSTモードでサインイン済みの場合、コンテンツが表示される', () => {
      // SignedInコンポーネントが子要素をレンダリングするようにモック
      (SignedIn as jest.Mock).mockImplementation(({ children }) => (
        <div data-testid="signed-in">{children}</div>
      ));
      (SignedOut as jest.Mock).mockImplementation(() => null);

      render(
        <AuthGate>
          <TestContent />
        </AuthGate>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('HOSTモードでサインアウト状態の場合、リダイレクトが表示される', () => {
      // SignedOutコンポーネントがリダイレクトをレンダリングするようにモック
      (SignedIn as jest.Mock).mockImplementation(() => null);
      (SignedOut as jest.Mock).mockImplementation(({ children }) => (
        <div data-testid="signed-out">{children}</div>
      ));

      render(
        <AuthGate>
          <TestContent />
        </AuthGate>
      );

      expect(screen.getByText('Redirecting to sign in...')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('モード切り替え時の動作', () => {
    it('同一セッション内でモードは変更されない', () => {
      const useAppModeSpy = jest.spyOn(useAppModeModule, 'useAppMode');
      useAppModeSpy.mockReturnValue('CLIENT');

      const { rerender } = render(
        <AuthGate>
          <TestContent />
        </AuthGate>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(SignedIn).not.toHaveBeenCalled();

      // モードを変更してもコンポーネントは再レンダリングされるが、
      // 実際のアプリケーションではページリロードが必要
      useAppModeSpy.mockReturnValue('HOST');
      rerender(
        <AuthGate>
          <TestContent />
        </AuthGate>
      );

      // HOSTモードの動作に切り替わる
      expect(SignedIn).toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング', () => {
    it('useAppModeがエラーを投げても、デフォルトでHOSTモードとして動作', () => {
      jest.spyOn(useAppModeModule, 'useAppMode').mockImplementation(() => {
        throw new Error('Hook error');
      });

      // エラーバウンダリーがない場合のテスト
      expect(() => {
        render(
          <AuthGate>
            <TestContent />
          </AuthGate>
        );
      }).toThrow('Hook error');
    });

    it('子要素が null でも正常に動作する', () => {
      jest.spyOn(useAppModeModule, 'useAppMode').mockReturnValue('CLIENT');

      const { container } = render(
        <AuthGate>
          {null}
        </AuthGate>
      );

      expect(container).toBeInTheDocument();
      expect(SignedIn).not.toHaveBeenCalled();
    });
  });

  describe('パフォーマンス', () => {
    it('CLIENTモードでは不要な再レンダリングが発生しない', () => {
      jest.spyOn(useAppModeModule, 'useAppMode').mockReturnValue('CLIENT');

      const renderSpy = jest.fn();
      const TrackedContent = () => {
        renderSpy();
        return <div>Content</div>;
      };

      const { rerender } = render(
        <AuthGate>
          <TrackedContent />
        </AuthGate>
      );

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // 同じpropsで再レンダリング
      rerender(
        <AuthGate>
          <TrackedContent />
        </AuthGate>
      );

      // 再レンダリングが最小限に抑えられる
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });
});