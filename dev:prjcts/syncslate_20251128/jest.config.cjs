/**
 * Jest Configuration for SyncSlate AI
 * TDD対応のテスト設定
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>', '<rootDir>/__tests__'],

  // モジュール解決
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__tests__/__mocks__/fileMock.js',
  },

  // セットアップファイル
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.cjs',
  ],

  // カバレッジ設定
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.stories.tsx',
    '!**/index.tsx',
    '!**/vite-env.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/dist/**',
    '!**/coverage/**',
  ],

  // カバレッジ閾値（TDD重視）
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // 最重要ファイルは100%カバレッジ
    './hooks/use-app-mode.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },

  // テストマッチパターン
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],

  // 変換設定
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },

  // ウォッチ時の設定
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],

  // テストタイムアウト
  testTimeout: 10000,

  // パフォーマンステスト用の設定
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },

  // レポーター設定
  reporters: [
    'default',
  ],

  // テストの並列実行
  maxWorkers: '50%',

  // キャッシュ
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // グローバル設定
  globals: {
    // CLIENT/HOSTモード判定用のフラグ
    __CLIENT_MODE__: false,
    __HOST_MODE__: false,
  },

};