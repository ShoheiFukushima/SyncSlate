# 解析フェーズ設計書
Version: v1.0
Date: 2025-08-22
Status: Implementation Ready

## エグゼクティブサマリー

AutoEditTATEの解析フェーズにおける音楽・映像・歌詞の統合解析システムの設計書。SNSショート動画編集に特化し、相対的ダイナミズムの原則に基づいて実装する。

## 1. 設計思想

### 1.1 核心原則：相対的ダイナミズム

**すべての解析値は楽曲・素材内での相対値として扱う**

```typescript
// ❌ 悪い例：絶対値での判断
if (bpm > 120) { 
  return "fast"; 
}

// ✅ 良い例：楽曲内での相対値
const relativeIntensity = (current - song.min) / (song.max - song.min);
if (relativeIntensity > 0.8) {
  return "この曲の中では激しい";
}
```

### 1.2 解析の目的

- **編集点の発見**: いつカットすべきかのスコアリング
- **素材の評価**: どのクリップが使えるかの判定
- **関係性の把握**: 音楽・映像・歌詞の相関を理解

## 2. 音楽解析（Music Analysis）

### 2.1 解析項目と編集での活用

```typescript
interface MusicAnalysis {
  // 基本情報（参考値）
  absolute: {
    bpm: number;               // 120
    key: string;              // "C major"
    timeSignature: string;    // "4/4"
  };
  
  // 相対的特徴量（メイン）
  relative: {
    // 強度（この曲の中での位置）
    intensity: {
      current: number;        // 0.0-1.0
      deviation: number;      // 中心からの偏差
      percentile: number;     // 何パーセンタイル
    };
    
    // ハーモニック複雑性（音の厚み）
    harmonicDensity: {
      current: number;        // 0.0-1.0
      interpretation: "sparse" | "moderate" | "dense";
      editStrategy: string;   // "少ないカットで聴かせる"
    };
    
    // スペクトラル重心（明るさ）
    spectralBrightness: {
      current: number;        // 0.0-1.0
      deviation: number;      // この曲の中心からの偏差
      suggestion: string;     // "明るい映像を選択"
    };
  };
  
  // 編集点候補（最重要）
  editPoints: Array<{
    time: number;             // タイムコード
    confidence: number;       // 0.0-1.0 スコア
    type: EditPointType;      // "beat" | "phrase_start" | "build_up"
    flexibility: number;      // 前後の許容範囲（秒）
    reason: string;          // "キックドラムのヒット"
  }>;
  
  // 楽器トラッキング
  instruments: {
    [instrument: string]: {
      active: boolean;
      prominence: number;     // この曲の中での目立ち度
      performerId?: string;   // 対応する演者ID
      entry: number;         // 楽器が入るタイミング
      exit?: number;         // 楽器が抜けるタイミング
    };
  };
  
  // 音楽構造
  structure: Array<{
    type: "intro" | "verse" | "chorus" | "bridge" | "outro";
    start: number;
    end: number;
    relativeEnergy: number;   // このセクションのエネルギー
    editingHint: string;      // "ワイドショットで全体を見せる"
  }>;
}
```

### 2.2 実装詳細

```typescript
class MusicAnalyzer {
  private audioBuffer: AudioBuffer;
  private songContext: SongContext;
  
  async analyze(audioFile: File): Promise<MusicAnalysis> {
    // 1. 全体を通して聴く（コンテキスト把握）
    this.songContext = await this.establishContext(audioFile);
    
    // 2. 詳細解析
    const features = await this.extractFeatures();
    
    // 3. 相対値に変換
    const relative = this.normalizeToSong(features);
    
    // 4. 編集点を検出
    const editPoints = this.detectEditPoints(relative);
    
    // 5. 楽器を識別
    const instruments = await this.trackInstruments();
    
    return {
      absolute: features.raw,
      relative,
      editPoints,
      instruments,
      structure: this.analyzeStructure(relative)
    };
  }
  
  private detectEditPoints(features: RelativeFeatures): EditPoint[] {
    const points: EditPoint[] = [];
    
    // ビート検出
    const beats = this.detectBeats(features);
    beats.forEach(beat => {
      points.push({
        time: beat.time,
        confidence: beat.strength * 0.8,  // スコアであって命令ではない
        type: 'beat',
        flexibility: 0.042,  // ±1フレーム@24fps
        reason: this.describeBeat(beat)
      });
    });
    
    // フレーズの開始
    const phrases = this.detectPhrases(features);
    phrases.forEach(phrase => {
      points.push({
        time: phrase.start,
        confidence: 0.9,  // フレーズ開始は高スコア
        type: 'phrase_start',
        flexibility: 0.1,
        reason: `${phrase.instrument}のフレーズ開始`
      });
    });
    
    // ビルドアップとドロップ
    const dynamics = this.detectDynamics(features);
    dynamics.forEach(d => {
      if (d.type === 'buildup' || d.type === 'drop') {
        points.push({
          time: d.peak,
          confidence: 0.95,
          type: d.type,
          flexibility: 0.05,
          reason: d.description
        });
      }
    });
    
    return points.sort((a, b) => a.time - b.time);
  }
}
```

## 3. 映像解析（Video Analysis）

### 3.1 解析項目と実践的判断

```typescript
interface VideoAnalysis {
  // ショット使用可能性（最重要）
  shots: Array<{
    id: string;
    start: number;
    duration: number;
    
    // 使用可能性の判定
    usability: {
      score: number;           // 0.0-1.0
      usableFrom: number;      // 使用可能開始時間（1秒後など）
      stableAfter: number;     // 完全に安定する時間（4秒後）
      issues: string[];        // ["最初1秒ブレ", "露出オーバー"]
    };
    
    // 30%変化の法則用データ
    composition: {
      subjectPosition: Point;  // 被写体位置
      shotSize: ShotSize;      // "closeup" | "medium" | "wide"
      dominantColor: RGB;      // 支配的な色
      brightness: number;       // 明るさ
    };
    
    // ヒーローショット判定
    heroShot: {
      score: number;           // 0.0-1.0
      reason: string;          // "構図完璧、表情良好"
      suggestedUse: "opening" | "climax" | null;
    };
    
    // 音楽との相性
    musicCompatibility: {
      energyMatch: number;     // エネルギーレベルの一致度
      rhythmMatch: number;     // リズムとの相性
      allowedBlur: number;     // 音楽的に許容されるブレ度
    };
  }>;
  
  // カット間の遷移品質
  transitions: Array<{
    from: string;  // shot ID
    to: string;    // shot ID
    
    quality: {
      score: number;           // 0.0-1.0
      positionChange: number;  // 位置変化率（%）
      sizeChange: number;      // サイズ変化率（%）
      colorChange: number;     // 色変化率（%）
      warning?: string;        // "同ポジ同サイズ"
    };
    
    recommendation: string;    // "良好な遷移" | "別カット挿入推奨"
  }>;
  
  // 顔検出と演者識別
  faces: Array<{
    shotId: string;
    faceId: string;            // 演者ID
    confidence: number;
    
    details: {
      size: "extreme_close" | "close" | "medium" | "long";
      expression: Expression;   // 表情
      quality: number;         // 顔の映り具合
      fanImportance: number;   // ファン的重要度
    };
    
    tracking: {
      stable: boolean;         // 顔が安定して映っているか
      duration: number;        // 顔が映っている時間
      bestMoment: number;      // 最も良い瞬間
    };
  }>;
  
  // 技術的品質
  technicalQuality: {
    exposure: {
      value: number;           // EV値
      correctable: boolean;    // 補正可能か
      stressLevel: "low" | "medium" | "high";
    };
    
    blur: {
      level: number;           // ブレ度
      acceptable: boolean;     // 使用可能か
      musicallyJustified: boolean;  // 音楽的に正当化されるか
    };
    
    lighting: {
      changes: Array<{        // ライブ照明の変化
        time: number;
        magnitude: number;
        syncWithBeat: boolean;
      }>;
    };
  };
}
```

### 3.2 実装詳細

```typescript
class VideoAnalyzer {
  private videoFile: VideoFile;
  private fps: number;
  
  async analyze(
    videoFile: VideoFile,
    musicAnalysis?: MusicAnalysis  // 音楽解析結果を参照
  ): Promise<VideoAnalysis> {
    const shots = await this.detectShots(videoFile);
    const analyzedShots: AnalyzedShot[] = [];
    
    for (const shot of shots) {
      const analyzed = await this.analyzeShot(shot);
      
      // 音楽との相性を評価
      if (musicAnalysis) {
        analyzed.musicCompatibility = this.evaluateMusicCompatibility(
          analyzed,
          musicAnalysis
        );
      }
      
      analyzedShots.push(analyzed);
    }
    
    // カット間の遷移を評価
    const transitions = this.evaluateTransitions(analyzedShots);
    
    // 顔検出と追跡
    const faces = await this.detectAndTrackFaces(analyzedShots);
    
    return {
      shots: analyzedShots,
      transitions,
      faces,
      technicalQuality: this.assessTechnicalQuality(analyzedShots)
    };
  }
  
  private evaluateTransitions(shots: AnalyzedShot[]): Transition[] {
    const transitions: Transition[] = [];
    
    for (let i = 0; i < shots.length - 1; i++) {
      const from = shots[i];
      const to = shots[i + 1];
      
      // 30%変化の法則をチェック
      const changes = {
        position: this.calculatePositionChange(from, to),
        size: this.calculateSizeChange(from, to),
        color: this.calculateColorChange(from, to),
        brightness: this.calculateBrightnessChange(from, to)
      };
      
      // 少なくとも1つの要素で30%以上の変化が必要
      const significantChanges = Object.values(changes)
        .filter(change => change >= 0.3);
      
      const quality = {
        score: significantChanges.length > 0 ? 
          Math.min(1.0, significantChanges.reduce((a, b) => a + b) / 2) : 
          0.2,
        positionChange: changes.position * 100,
        sizeChange: changes.size * 100,
        colorChange: changes.color * 100,
        warning: significantChanges.length === 0 ? 
          "同ポジ同サイズ - 変化不足" : undefined
      };
      
      transitions.push({
        from: from.id,
        to: to.id,
        quality,
        recommendation: quality.score < 0.5 ? 
          "別カット挿入推奨" : "良好な遷移"
      });
    }
    
    return transitions;
  }
  
  private evaluateMusicCompatibility(
    shot: AnalyzedShot,
    music: MusicAnalysis
  ): MusicCompatibility {
    // ショットの時間範囲での音楽エネルギーを取得
    const musicEnergy = this.getMusicEnergyAt(
      music,
      shot.start,
      shot.start + shot.duration
    );
    
    // ショットの動きの強度
    const motionIntensity = shot.motion?.intensity || 0;
    
    // エネルギーマッチング
    const energyMatch = 1 - Math.abs(musicEnergy - motionIntensity);
    
    // リズムマッチング（カット点がビートに近いか）
    const nearestBeat = this.findNearestBeat(music.editPoints, shot.start);
    const beatDistance = Math.abs(nearestBeat.time - shot.start);
    const rhythmMatch = Math.max(0, 1 - beatDistance / 0.5);  // 0.5秒以内
    
    // 音楽的に許容されるブレ
    const allowedBlur = musicEnergy > 0.7 ? 0.6 : 0.3;  // 激しい音楽ならブレOK
    
    return {
      energyMatch,
      rhythmMatch,
      allowedBlur
    };
  }
}
```

## 4. 歌詞解析（Lyrics Analysis）

### 4.1 音楽と統合された歌詞解析

```typescript
interface LyricsAnalysis {
  // 歌詞ソース
  source: "user_input" | "transcription" | "none";
  confidence: number;
  
  // タイミング同期
  phrases: Array<{
    id: string;
    text: string;
    start: number;
    end: number;
    
    // 音節レベルの同期
    syllables: Array<{
      text: string;
      time: number;
      pitch?: string;        // 音程（optional）
      emphasis: number;      // 強調度
    }>;
    
    // リップシンク可能性
    lipSync: {
      possible: boolean;
      quality: number;       // 口の動きとの一致度
      visibleFrames: [number, number];  // 口が見える範囲
    };
    
    // 意味解析
    semantic: {
      emotion: number;       // -1.0 to 1.0（この曲の中での相対値）
      importance: number;    // 0.0-1.0 重要度
      keywords: string[];    // キーワード
      visualizable: boolean; // 映像化しやすいか
    };
    
    // 映像との対応
    visualSuggestions: Array<{
      type: "literal" | "emotional" | "abstract";
      description: string;   // "走るシーン" | "笑顔" | "光の表現"
      confidence: number;
    }>;
  }>;
  
  // 音楽セクションとの相関
  sections: Array<{
    musicSection: MusicSection;  // intro/verse/chorus等
    hasLyrics: boolean;
    
    character: {
      musical: string;       // "gentle" | "energetic"
      lyrical?: string;      // "narrative" | "emotional"
      coherence: number;     // 音楽と歌詞の一致度
    };
    
    editStrategy: string;    // "story_telling" | "impact_montage"
  }>;
  
  // サビとフック
  hooks: Array<{
    phrase: string;
    timeRange: [number, number];
    catchiness: number;      // キャッチー度
    repeatCount: number;     // 繰り返し回数
    memorability: number;    // 記憶に残りやすさ
    
    usage: {
      priority: "high" | "medium" | "low";
      suggestedPlacement: "opening" | "climax" | "both";
    };
  }>;
  
  // 韻とリズム
  rhymePatterns: Array<{
    lines: Array<{
      text: string;
      rhymeGroup: string;    // "A" | "B" | "C"等
    }>;
    
    visualStrategy: string;  // "parallel_cuts" | "matching_transitions"
  }>;
}
```

### 4.2 実装詳細

```typescript
class LyricsAnalyzer {
  private musicAnalysis: MusicAnalysis;
  private llmClient?: LLMClient;
  
  async analyze(
    lyricsInput: LyricsInput | null,
    audioFile: AudioFile,
    musicAnalysis: MusicAnalysis
  ): Promise<LyricsAnalysis> {
    this.musicAnalysis = musicAnalysis;
    
    // 1. 歌詞データの取得
    const lyricsData = await this.obtainLyrics(lyricsInput, audioFile);
    
    // 2. タイミング同期
    const syncedPhrases = await this.syncLyricsToMusic(
      lyricsData,
      musicAnalysis
    );
    
    // 3. 意味解析
    const semanticAnalysis = await this.analyzeSemantics(syncedPhrases);
    
    // 4. 音楽セクションとの統合
    const sections = this.correlatWithMusicSections(
      syncedPhrases,
      musicAnalysis.structure
    );
    
    // 5. フックとサビの検出
    const hooks = this.detectHooks(syncedPhrases, sections);
    
    // 6. 韻の検出
    const rhymes = this.detectRhymePatterns(syncedPhrases);
    
    return {
      source: lyricsData.source,
      confidence: lyricsData.confidence,
      phrases: syncedPhrases,
      sections,
      hooks,
      rhymePatterns: rhymes
    };
  }
  
  private async obtainLyrics(
    input: LyricsInput | null,
    audio: AudioFile
  ): Promise<LyricsData> {
    if (input?.hasTimestamps) {
      // ユーザー入力（タイムスタンプ付き）が最優先
      return {
        source: 'user_input',
        confidence: 1.0,
        text: input.text,
        timestamps: input.timestamps
      };
    } else if (input?.text) {
      // テキストのみの場合は音声と照合
      const aligned = await this.alignTextToAudio(input.text, audio);
      return {
        source: 'user_input',
        confidence: 0.8,
        text: input.text,
        timestamps: aligned.timestamps
      };
    } else if (this.llmClient) {
      // LLMで歌詞をテキスト化（認識のみ、生成ではない）
      const transcribed = await this.llmClient.transcribeLyrics(audio);
      return {
        source: 'transcription',
        confidence: transcribed.confidence,
        text: transcribed.text,
        timestamps: transcribed.timestamps
      };
    } else {
      return {
        source: 'none',
        confidence: 0,
        text: '',
        timestamps: []
      };
    }
  }
  
  private detectHooks(
    phrases: SyncedPhrase[],
    sections: Section[]
  ): Hook[] {
    const hooks: Hook[] = [];
    
    // サビのフレーズを検出
    const chorusPhrases = phrases.filter(p => {
      const section = sections.find(s => 
        p.start >= s.start && p.end <= s.end
      );
      return section?.musicSection === 'chorus';
    });
    
    // 繰り返されるフレーズを検出
    const phraseCount = new Map<string, number>();
    phrases.forEach(p => {
      const normalized = p.text.toLowerCase().trim();
      phraseCount.set(normalized, (phraseCount.get(normalized) || 0) + 1);
    });
    
    // フックとして評価
    chorusPhrases.forEach(phrase => {
      const repeatCount = phraseCount.get(
        phrase.text.toLowerCase().trim()
      ) || 1;
      
      if (repeatCount > 1 || phrase.semantic?.importance > 0.7) {
        hooks.push({
          phrase: phrase.text,
          timeRange: [phrase.start, phrase.end],
          catchiness: this.evaluateCatchiness(phrase),
          repeatCount,
          memorability: this.evaluateMemorability(phrase),
          usage: {
            priority: repeatCount > 2 ? 'high' : 'medium',
            suggestedPlacement: repeatCount > 2 ? 'both' : 'climax'
          }
        });
      }
    });
    
    return hooks;
  }
}
```

## 5. 統合解析（Integration）

### 5.1 中間表現層（IR）への変換

```typescript
interface IntegratedAnalysis {
  // タイムライン統合表現
  timeline: Array<{
    time: number;
    duration: number;
    
    // 各解析結果の統合
    music: {
      intensity: number;
      phase: string;
      editPoint?: EditPoint;
    };
    
    video: {
      shotId?: string;
      quality: number;
      heroScore: number;
    };
    
    lyrics: {
      phrase?: string;
      emotion: number;
      importance: number;
    };
    
    // 統合スコア
    integrated: {
      editSuitability: number;  // 編集点としての適切さ
      contentQuality: number;   // コンテンツの品質
      emotionalCoherence: number;  // 感情的一貫性
    };
  }>;
  
  // グローバルコンテキスト
  context: {
    dominantEmotion: string;
    averageEnergy: number;
    narrativeArc: string;
  };
}
```

### 5.2 統合処理

```typescript
class IntegrationEngine {
  async integrate(
    music: MusicAnalysis,
    video: VideoAnalysis,
    lyrics: LyricsAnalysis
  ): Promise<IntegratedAnalysis> {
    // タイムラインの統一
    const unifiedTimeline = this.createUnifiedTimeline(
      music,
      video,
      lyrics
    );
    
    // 各時点での統合評価
    const timeline = unifiedTimeline.map(segment => {
      const musicFeatures = this.getMusicAt(music, segment.time);
      const videoFeatures = this.getVideoAt(video, segment.time);
      const lyricsFeatures = this.getLyricsAt(lyrics, segment.time);
      
      // 統合スコアの計算
      const integrated = this.calculateIntegratedScores(
        musicFeatures,
        videoFeatures,
        lyricsFeatures
      );
      
      return {
        time: segment.time,
        duration: segment.duration,
        music: musicFeatures,
        video: videoFeatures,
        lyrics: lyricsFeatures,
        integrated
      };
    });
    
    // グローバルコンテキストの抽出
    const context = this.extractGlobalContext(timeline);
    
    return { timeline, context };
  }
  
  private calculateIntegratedScores(
    music: MusicFeatures,
    video: VideoFeatures,
    lyrics: LyricsFeatures
  ): IntegratedScores {
    // 編集点としての適切さ
    const editSuitability = 
      music.editPoint ? music.editPoint.confidence * 0.5 : 0 +
      video.quality * 0.3 +
      (lyrics.phrase ? 0.2 : 0);
    
    // コンテンツの品質
    const contentQuality = 
      video.quality * 0.4 +
      video.heroScore * 0.3 +
      (lyrics.importance || 0) * 0.3;
    
    // 感情的一貫性
    const emotionalCoherence = this.calculateEmotionalCoherence(
      music.intensity,
      video.energy || 0,
      lyrics.emotion || 0
    );
    
    return {
      editSuitability,
      contentQuality,
      emotionalCoherence
    };
  }
}
```

## 6. パフォーマンス最適化

### 6.1 並列処理

```typescript
class ParallelAnalyzer {
  async analyzeAll(
    audioFile: File,
    videoFile: File,
    lyricsInput?: LyricsInput
  ): Promise<IntegratedAnalysis> {
    // 並列実行
    const [musicAnalysis, videoAnalysis] = await Promise.all([
      this.musicAnalyzer.analyze(audioFile),
      this.videoAnalyzer.analyze(videoFile)
    ]);
    
    // 歌詞は音楽解析結果を使うので後から
    const lyricsAnalysis = await this.lyricsAnalyzer.analyze(
      lyricsInput,
      audioFile,
      musicAnalysis
    );
    
    // 統合
    return this.integrationEngine.integrate(
      musicAnalysis,
      videoAnalysis,
      lyricsAnalysis
    );
  }
}
```

### 6.2 キャッシング

```typescript
class AnalysisCache {
  private cache = new Map<string, any>();
  
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>
  ): Promise<T> {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    const result = await compute();
    this.cache.set(key, result);
    return result;
  }
}
```

## 7. エラーハンドリング

### 7.1 グレースフル劣化

```typescript
class RobustAnalyzer {
  async analyze(file: File): Promise<Analysis> {
    try {
      // 完全な解析を試みる
      return await this.fullAnalysis(file);
    } catch (error) {
      console.warn('Full analysis failed, falling back', error);
      
      try {
        // 簡易解析にフォールバック
        return await this.basicAnalysis(file);
      } catch (fallbackError) {
        // 最小限の解析
        return this.minimalAnalysis(file);
      }
    }
  }
}
```

## 8. テスト戦略

### 8.1 ユニットテスト

```typescript
describe('MusicAnalyzer', () => {
  it('should detect edit points at beats', async () => {
    const analyzer = new MusicAnalyzer();
    const result = await analyzer.analyze(testAudioFile);
    
    expect(result.editPoints).toHaveLength(greaterThan(0));
    expect(result.editPoints[0].confidence).toBeGreaterThan(0.5);
  });
  
  it('should calculate relative intensity', async () => {
    const analyzer = new MusicAnalyzer();
    const result = await analyzer.analyze(testAudioFile);
    
    expect(result.relative.intensity.current).toBeBetween(0, 1);
  });
});
```

### 8.2 統合テスト

```typescript
describe('Integration', () => {
  it('should align music beats with video cuts', async () => {
    const integrated = await integrationEngine.integrate(
      musicAnalysis,
      videoAnalysis,
      lyricsAnalysis
    );
    
    const editPoints = integrated.timeline.filter(
      t => t.integrated.editSuitability > 0.7
    );
    
    expect(editPoints).toHaveLength(greaterThan(10));
  });
});
```

## 9. 実装チェックリスト

### Phase 1: 基礎実装
- [ ] MusicAnalyzer基本実装
- [ ] VideoAnalyzer基本実装
- [ ] LyricsAnalyzer基本実装
- [ ] 相対値変換ロジック

### Phase 2: 詳細実装
- [ ] 編集点検出アルゴリズム
- [ ] 30%変化の法則実装
- [ ] ヒーローショット判定
- [ ] 楽器トラッキング

### Phase 3: 統合
- [ ] IntegrationEngine実装
- [ ] 中間表現層（IR）への変換
- [ ] 統合スコア計算
- [ ] キャッシング実装

### Phase 4: 最適化
- [ ] 並列処理
- [ ] エラーハンドリング
- [ ] パフォーマンステスト
- [ ] メモリ使用量最適化

## 10. まとめ

解析フェーズは、編集判断の基礎となる重要な工程である。重要なポイント：

1. **相対的ダイナミズム**: すべての値は素材内での相対値
2. **編集点スコアリング**: 提案であって命令ではない
3. **実践的判断**: 技術的な数値を編集判断に変換
4. **統合評価**: 音楽・映像・歌詞を総合的に評価

実装時は、まず基本的な解析から始め、段階的に詳細な解析と統合を追加していく。

---
*本ドキュメントは実装の進捗に応じて更新される。*