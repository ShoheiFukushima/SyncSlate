/**
 * PinButton コンポーネント
 *
 * スレート実行中にマーカーを打つためのボタン
 * - ミュートボタンの右側に配置
 * - スレート実行中のみ表示
 * - 1秒に1回のみマーカーを打てる
 */

import React, { useState, useEffect } from 'react';
import { Pin } from 'lucide-react';
import clsx from 'clsx';

interface PinButtonProps {
  /** スレート実行中かどうか */
  isRunning: boolean;

  /** 現在の経過時間(秒) */
  currentTime: number;

  /** マーカー追加時のコールバック */
  onAddPin: (timestamp: number) => void;

  /** カスタムクラス名 */
  className?: string;
}

/**
 * マーカー打ちボタン
 */
export function PinButton({
  isRunning,
  currentTime,
  onAddPin,
  className,
}: PinButtonProps) {
  const [lastPinTime, setLastPinTime] = useState<number>(-1);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);

  // フィードバック状態を2秒後にリセット
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 500);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  /**
   * マーカーを追加
   */
  const handleClick = () => {
    // 1秒以内の連打防止
    if (currentTime - lastPinTime < 1) {
      setFeedback('error');
      return;
    }

    // マーカーを追加
    const timestamp = Math.floor(currentTime);
    onAddPin(timestamp);
    setLastPinTime(currentTime);
    setFeedback('success');

    // 短いビープ音を再生(オプション)
    playBeep();
  };

  /**
   * 短いビープ音を再生
   */
  const playBeep = () => {
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // 800Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.1
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.error('Failed to play beep:', error);
    }
  };

  // スレート実行中でない場合は表示しない
  if (!isRunning) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'pin-button',
        'flex items-center justify-center gap-2',
        'w-24 h-12',
        'bg-gradient-to-br from-blue-500 to-blue-600',
        'text-white font-semibold text-sm',
        'rounded-xl',
        'shadow-lg shadow-blue-500/30',
        'transition-all duration-200',
        'hover:from-blue-600 hover:to-blue-700',
        'hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/40',
        'active:translate-y-0 active:shadow-lg active:shadow-blue-500/30',
        {
          'bg-gradient-to-br from-green-500 to-green-600': feedback === 'success',
          'shake': feedback === 'error',
        },
        className
      )}
      aria-label="マーカーを追加"
    >
      <Pin className="w-5 h-5" />
      <span className="tracking-wide">PIN</span>
    </button>
  );
}

// CSS animations (追加でグローバルCSSに含める必要があります)
const styles = `
@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

.shake {
  animation: shake 0.3s ease;
}

@media (max-width: 640px) {
  .pin-button {
    width: 5rem;
    height: 4rem;
    flex-direction: column;
    gap: 0.25rem;
    border-radius: 1rem;
  }

  .pin-button svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .pin-button span {
    font-size: 0.75rem;
  }
}
`;
