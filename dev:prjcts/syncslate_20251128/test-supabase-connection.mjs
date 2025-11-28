/**
 * Supabase接続テストスクリプト
 *
 * 実行: node test-supabase-connection.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ 環境変数が設定されていません');
  console.log('VITE_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.log('VITE_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗');
  process.exit(1);
}

console.log('🔄 Supabase接続テスト開始...\n');

// Supabaseクライアント作成
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

console.log('✅ Supabaseクライアント作成完了');
console.log('   URL:', SUPABASE_URL);

// テスト1: sync_sessionsテーブルにアクセス
console.log('\n📊 テスト1: sync_sessionsテーブルへのアクセス');
try {
  const { data, error } = await supabase
    .from('sync_sessions')
    .select('id, created_at')
    .limit(1);

  if (error) {
    console.error('❌ エラー:', error.message);
  } else {
    console.log('✅ テーブルアクセス成功');
    console.log('   レコード数:', data.length);
  }
} catch (err) {
  console.error('❌ 例外:', err.message);
}

// テスト2: Realtimeチャンネル作成
console.log('\n📡 テスト2: Realtimeチャンネル作成');
try {
  const channel = supabase.channel('test-channel-' + Date.now());

  channel.on('broadcast', { event: 'test' }, (payload) => {
    console.log('📨 メッセージ受信:', payload);
  });

  const subscribePromise = new Promise((resolve, reject) => {
    channel
      .subscribe((status) => {
        console.log('   チャンネル状態:', status);
        if (status === 'SUBSCRIBED') {
          resolve();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          reject(new Error(`チャンネルエラー: ${status}`));
        }
      });
  });

  await subscribePromise;
  console.log('✅ Realtimeチャンネル接続成功');

  // チャンネルを閉じる
  await channel.unsubscribe();
  console.log('✅ チャンネル切断完了');
} catch (err) {
  console.error('❌ Realtimeエラー:', err.message);
}

console.log('\n✅ すべてのテスト完了\n');
process.exit(0);
