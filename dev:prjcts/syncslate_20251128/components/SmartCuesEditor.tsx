/**
 * SmartCuesEditor コンポーネント
 *
 * SMART CUES の編集画面
 * - CUE一覧の表示
 * - テキスト入力(Phase 1)
 * - プリセット効果音選択(Phase 2)
 * - CUEの削除
 * - すべてクリア
 */

import React, { useRef } from 'react';
import { Trash2, X, Target, Play, Upload, FileAudio } from 'lucide-react';
import clsx from 'clsx';
import type { SmartCue, AudioType } from '../types/smart-cues';
import { useAudioPlayback } from '../hooks/useAudioPlayback';

interface SmartCuesEditorProps {
  /** CUE一覧 */
  cues: SmartCue[];

  /** CUE更新時のコールバック */
  onUpdateCue: (id: string, updates: Partial<SmartCue>) => void;

  /** CUE削除時のコールバック */
  onDeleteCue: (id: string) => void;

  /** すべてクリア時のコールバック */
  onClearAll: () => void;

  /** カスタムクラス名 */
  className?: string;
}

/**
 * 時刻フォーマット(秒 → MM:SS)
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * SMART CUES 編集画面
 */
export function SmartCuesEditor({
  cues,
  onUpdateCue,
  onDeleteCue,
  onClearAll,
  className,
}: SmartCuesEditorProps) {
  const audioPlayback = useAudioPlayback();

  /**
   * テキスト変更ハンドラ
   */
  const handleTextChange = (id: string, text: string) => {
    onUpdateCue(id, { text });
  };

  /**
   * 音声タイプ変更ハンドラ
   */
  const handleAudioTypeChange = (id: string, oldType: AudioType, newType: AudioType) => {
    // タイプ変更時、電話コールに変更した場合はデフォルトで1回に設定
    const updates: Partial<SmartCue> = { audioType: newType };

    if (newType === 'phone' && oldType !== 'phone') {
      updates.phoneRings = 1;
    }

    onUpdateCue(id, updates);
  };

  /**
   * 電話コール回数変更ハンドラ
   */
  const handlePhoneRingsChange = (id: string, rings: number) => {
    onUpdateCue(id, { phoneRings: rings });
  };

  /**
   * カスタム音声ファイルアップロードハンドラ
   */
  const handleCustomAudioUpload = async (id: string, file: File): Promise<void> => {
    try {
      // ファイルをBase64に変換
      const reader = new FileReader();

      await new Promise<void>((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;

            // 音声の長さを取得
            const audio = new Audio(base64Data);
            await new Promise<void>((resolveAudio) => {
              audio.addEventListener('loadedmetadata', () => {
                const duration = audio.duration;

                // CUEを更新
                onUpdateCue(id, {
                  customAudioUrl: base64Data,
                  customAudioDuration: duration,
                  customAudioFilename: file.name,
                });

                resolveAudio();
              });
            });

            resolve();
          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('[SmartCues] Failed to upload custom audio:', error);
      alert('音声ファイルのアップロードに失敗しました');
    }
  };

  /**
   * カスタム音声ファイル削除ハンドラ
   */
  const handleCustomAudioRemove = (id: string) => {
    onUpdateCue(id, {
      customAudioUrl: undefined,
      customAudioDuration: undefined,
      customAudioFilename: undefined,
    });
  };

  return (
    <div className={clsx('smart-cues-editor', 'max-w-4xl mx-auto', className)}>
      {/* ヘッダー */}
      <div className="smart-cues-header flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Target className="w-6 h-6 text-blue-500" />
          <span>SMART CUES</span>
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-blue-500 text-white text-xs font-semibold rounded-full">
            {cues.length}
          </span>
        </h2>
        {cues.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 hover:border-red-300 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            すべてクリア
          </button>
        )}
      </div>

      {/* CUE一覧 */}
      <div className="smart-cues-list p-4 space-y-3">
        {cues.length === 0 ? (
          <EmptyState />
        ) : (
          cues.map(cue => (
            <CueCard
              key={cue.id}
              cue={cue}
              onTextChange={(text) => handleTextChange(cue.id, text)}
              onAudioTypeChange={(oldType, newType) => handleAudioTypeChange(cue.id, oldType, newType)}
              onPhoneRingsChange={(rings) => handlePhoneRingsChange(cue.id, rings)}
              onCustomAudioUpload={(file) => handleCustomAudioUpload(cue.id, file)}
              onCustomAudioRemove={() => handleCustomAudioRemove(cue.id)}
              onDelete={() => onDeleteCue(cue.id)}
              audioPlayback={audioPlayback}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * CUEカード
 */
interface CueCardProps {
  cue: SmartCue;
  onTextChange: (text: string) => void;
  onAudioTypeChange: (oldType: AudioType, newType: AudioType) => void;
  onPhoneRingsChange: (rings: number) => void;
  onCustomAudioUpload: (file: File) => Promise<void>;
  onCustomAudioRemove: () => void;
  onDelete: () => void;
  audioPlayback: ReturnType<typeof useAudioPlayback>;
}

function CueCard({
  cue,
  onTextChange,
  onAudioTypeChange,
  onPhoneRingsChange,
  onCustomAudioUpload,
  onCustomAudioRemove,
  onDelete,
  audioPlayback,
}: CueCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="cue-card bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-lg transition-all relative overflow-hidden">
      {/* 左側のアクセントバー */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />

      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-3 ml-2">
        <div className="flex items-center gap-2 text-base font-semibold text-gray-700">
          <span className="text-lg">📍</span>
          <span className="font-mono text-gray-900">{formatTime(cue.timestamp)}</span>
        </div>
        <button
          onClick={onDelete}
          className="flex items-center justify-center w-8 h-8 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 hover:scale-105 transition-all"
          aria-label={`${formatTime(cue.timestamp)}のCUEを削除`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 音声タイプ選択 */}
      <div className="mb-3 ml-2">
        <select
          value={cue.audioType}
          onChange={(e) => onAudioTypeChange(cue.audioType as AudioType, e.target.value as AudioType)}
          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors cursor-pointer"
        >
          <option value="text">📝 テキスト</option>
          <option value="gunshot">🔫 鉄砲</option>
          <option value="phone">📞 電話コール</option>
          <option value="custom">🎵 カスタム音声</option>
        </select>
      </div>

      {/* 音声タイプ別のコンテンツ */}
      <div className="relative ml-2">
        {cue.audioType === 'text' && (
          <>
            <textarea
              value={cue.text || ''}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="読み上げるテキストを入力(0.8秒以内)"
              maxLength={50}
              className="w-full min-h-[80px] px-3 py-2 bg-white border-2 border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-colors"
            />
            <div className="absolute bottom-2 right-3 text-xs text-gray-500 font-medium">
              {cue.text?.length || 0} / 50
            </div>
            <div className="mt-2 px-3 py-2 bg-blue-50 border-l-3 border-blue-400 rounded text-xs text-blue-700">
              💡 短いフレーズを推奨(例: アクション!)
            </div>
          </>
        )}

        {cue.audioType === 'gunshot' && (
          <div className="space-y-3">
            <div className="px-3 py-2 bg-orange-50 border-l-3 border-orange-400 rounded text-xs text-orange-700">
              🔫 鉄砲効果音（0.15秒）
            </div>
            <button
              onClick={() => audioPlayback.playGunshotSound()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Play className="w-4 h-4" />
              プレビュー再生
            </button>
          </div>
        )}

        {cue.audioType === 'phone' && (
          <div className="space-y-3">
            <div className="px-3 py-2 bg-green-50 border-l-3 border-green-400 rounded text-xs text-green-700">
              📞 電話コール（リング音 + 無音の繰り返し）
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                コール回数: {cue.phoneRings || 1}回
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={cue.phoneRings || 1}
                onChange={(e) => onPhoneRingsChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1回</span>
                <span>5回</span>
              </div>
            </div>
            <button
              onClick={() => audioPlayback.playPhoneRingSound(cue.phoneRings || 1)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
            >
              <Play className="w-4 h-4" />
              プレビュー再生
            </button>
          </div>
        )}

        {cue.audioType === 'custom' && (
          <div className="space-y-3">
            <div className="px-3 py-2 bg-purple-50 border-l-3 border-purple-400 rounded text-xs text-purple-700">
              🎵 カスタム音声ファイル（MP3, WAV, M4A対応）
            </div>

            {!cue.customAudioUrl ? (
              <>
                {/* ファイルアップロード */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      await onCustomAudioUpload(file);
                      // 入力をリセット（同じファイルを再度選択可能にする）
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  音声ファイルを選択
                </button>
              </>
            ) : (
              <>
                {/* アップロード済みファイル情報 */}
                <div className="p-3 bg-purple-100 border border-purple-300 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FileAudio className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-purple-900 truncate">
                        {cue.customAudioFilename || 'カスタム音声.mp3'}
                      </p>
                      <p className="text-xs text-purple-700 mt-1">
                        再生時間: {cue.customAudioDuration?.toFixed(1) || '0.0'}秒
                      </p>
                    </div>
                    <button
                      onClick={onCustomAudioRemove}
                      className="flex-shrink-0 p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-200 rounded transition-colors"
                      aria-label="音声ファイルを削除"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* プレビュー再生ボタン */}
                <button
                  onClick={() => {
                    if (cue.customAudioUrl) {
                      audioPlayback.playCustomAudio(cue.customAudioUrl);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  プレビュー再生
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 空状態
 */
function EmptyState() {
  return (
    <div className="empty-state flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-6xl mb-4 opacity-50">🎯</div>
      <h3 className="text-lg font-bold text-gray-700 mb-2">
        まだCUEがありません
      </h3>
      <p className="text-sm text-gray-600 leading-relaxed">
        スレート実行中に「📍 PIN」ボタンを押して<br />
        監督のタイミングをマークしましょう
      </p>
    </div>
  );
}
