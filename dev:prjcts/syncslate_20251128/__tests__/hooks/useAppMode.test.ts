/**
 * useAppMode Hook Tests
 * CLIENT/HOSTモード判定ロジックのテスト
 *
 * 最重要テスト：CLIENTモードが正しく判定されることを保証
 */

import { renderHook } from '@testing-library/react';
import { useAppMode } from '../../src/hooks/useAppMode';

describe('useAppMode', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    delete (window as any).location;
    (window as any).location = {
      href: 'http://localhost:3000/',
      origin: 'http://localhost:3000',
      search: '',
    };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  describe('CLIENT モード判定', () => {
    it('role=clientパラメータがある場合、CLIENTモードになる', () => {
      window.location.search = '?role=client';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('CLIENT');
    });

    it('sessionパラメータがある場合、CLIENTモードになる', () => {
      window.location.search = '?session=abc123';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('CLIENT');
    });

    it('role=clientとsessionの両方がある場合、CLIENTモードになる', () => {
      window.location.search = '?role=client&session=xyz789';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('CLIENT');
    });

    it('sessionパラメータが空文字でもCLIENTモードになる', () => {
      window.location.search = '?session=';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('CLIENT');
    });

    it('複雑なURLパラメータでもCLIENTモードを正しく判定する', () => {
      window.location.search = '?view=simple&session=abc&debug=true';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('CLIENT');
    });
  });

  describe('HOST モード判定', () => {
    it('パラメータがない場合、HOSTモードになる', () => {
      window.location.search = '';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('HOST');
    });

    it('role=hostパラメータがある場合、HOSTモードになる', () => {
      window.location.search = '?role=host';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('HOST');
    });

    it('関係ないパラメータのみの場合、HOSTモードになる', () => {
      window.location.search = '?debug=true&lang=ja';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('HOST');
    });
  });

  describe('エッジケース', () => {
    it('role=invalidな値でも、sessionがなければHOSTモードになる', () => {
      window.location.search = '?role=invalid';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('HOST');
    });

    it('大文字小文字を区別する（role=CLIENTはHOSTモード）', () => {
      window.location.search = '?role=CLIENT';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('HOST');
    });

    it('role=hostとsession=abcが両方ある場合、roleを優先してHOSTモードになる', () => {
      window.location.search = '?role=host&session=abc';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('HOST');
    });
  });

  describe('URLエンコーディング', () => {
    it('URLエンコードされたパラメータも正しく処理する', () => {
      window.location.search = '?role%3Dclient';
      // URLSearchParams は自動的にデコードしないので、これはHOSTモードになるべき
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('HOST');
    });

    it('sessionパラメータに特殊文字が含まれていてもCLIENTモードになる', () => {
      window.location.search = '?session=' + encodeURIComponent('session-123!@#');
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('CLIENT');
    });
  });

  describe('セキュリティ', () => {
    it('悪意のあるパラメータが含まれていても安全に動作する', () => {
      window.location.search = '?session=<script>alert("xss")</script>';
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('CLIENT');
      // XSSは発生しない（値は使用されず、存在チェックのみ）
    });

    it('非常に長いsessionパラメータでも正常に動作する', () => {
      const longSession = 'a'.repeat(10000);
      window.location.search = `?session=${longSession}`;
      const { result } = renderHook(() => useAppMode());
      expect(result.current).toBe('CLIENT');
    });
  });

  describe('リアクティビティ', () => {
    it('URLが変更されても、フック自体は同じ結果を返す（リロードが必要）', () => {
      window.location.search = '?role=host';
      const { result, rerender } = renderHook(() => useAppMode());
      expect(result.current).toBe('HOST');

      // URLを変更してもフックは再評価されない（ページリロードが必要）
      window.location.search = '?role=client';
      rerender();
      expect(result.current).toBe('HOST'); // 変わらない
    });
  });
});