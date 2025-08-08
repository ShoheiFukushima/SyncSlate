import React, { useEffect, useState } from 'react';

declare global {
  interface Window {
    api?: {
      openVideoDialog: () => Promise<string | null>;
      native?: {
        greet: () => Promise<string>;
      };
    };
  }
}

export default function App() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [greetMsg, setGreetMsg] = useState<string>('loading native...');

  useEffect(() => {
    (async () => {
      try {
        const msg = (await window.api?.native?.greet?.()) ?? 'native not available';
        setGreetMsg(String(msg));
      } catch (e) {
        setGreetMsg(`error: ${String(e)}`);
      }
    })();
  }, []);

  const onOpenVideo = async () => {
    const path = await window.api?.openVideoDialog();
    setVideoPath(path ?? null);
  };

  return (
    <div className="container">
      <header>
        <h1>AutoEditTATE</h1>
      </header>
      <section className="controls">
        <button onClick={onOpenVideo}>動画を開く</button>
      </section>
      <section className="status">
        <div>Native greet: {greetMsg}</div>
        <div>選択した動画: {videoPath ?? '-'}</div>
      </section>
    </div>
  );
}