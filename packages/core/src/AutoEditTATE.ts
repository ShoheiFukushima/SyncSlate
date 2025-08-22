import { ConfigLoader } from '@autoedittate/config';
import { 
  MusicAnalysisEngine, 
  type MusicAnalysisResult 
} from '@autoedittate/music-analysis';
import { 
  VideoAnalysisEngine, 
  type VideoAnalysisResult 
} from '@autoedittate/video-analysis';
import { 
  TimeBasedMatchingEngine, 
  type MatchingResult 
} from '@autoedittate/matching';
import { 
  PremiereXMLParser, 
  XMLGenerator, 
  ExplainJsonBuilder,
  type XMLParseResult 
} from '@autoedittate/xml-io';
import { QAValidationSuite, type QAReport } from '@autoedittate/qa-validators';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * AutoEditTATE メインクラス
 * 
 * SNS向け短編動画（60秒以下）の自動編集システム
 * 音楽、映像、歌詞を分析し、視聴者心理に基づく最適な編集を生成
 */
export class AutoEditTATE {
  private configLoader: ConfigLoader;
  private musicEngine: MusicAnalysisEngine;
  private videoEngine: VideoAnalysisEngine;
  private matchingEngine: TimeBasedMatchingEngine;
  private xmlParser: PremiereXMLParser;
  private xmlGenerator: XMLGenerator;
  private explainBuilder: ExplainJsonBuilder;
  private qaValidator: QAValidationSuite;
  
  constructor() {
    console.log('Initializing AutoEditTATE system...');
    
    // コンポーネントを初期化
    this.configLoader = ConfigLoader.getInstance();
    this.musicEngine = new MusicAnalysisEngine();
    this.videoEngine = new VideoAnalysisEngine();
    this.matchingEngine = new TimeBasedMatchingEngine();
    this.xmlParser = new PremiereXMLParser();
    this.xmlGenerator = new XMLGenerator();
    this.explainBuilder = new ExplainJsonBuilder();
    this.qaValidator = new QAValidationSuite();
    
    console.log('AutoEditTATE system initialized');
  }
  
  /**
   * XMLファイルからの完全自動編集
   * Premiere XMLを読み込み、解析、マッチング、出力まで実行
   */
  public async processFromXML(
    xmlPath: string,
    outputDir: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    console.log(`\n=== AutoEditTATE Processing Started ===`);
    console.log(`Input XML: ${xmlPath}`);
    console.log(`Output Directory: ${outputDir}`);
    
    const startTime = Date.now();
    
    try {
      // 1. XMLパースと素材解決
      console.log('\n1. Parsing XML and resolving materials...');
      const parseResult = await this.xmlParser.parseFromFile(xmlPath);
      console.log(`✓ Found ${parseResult.materials.length} materials`);
      console.log(`✓ Extracted ${parseResult.cuePoints.length} cue points`);
      
      // 2. 音楽解析
      console.log('\n2. Analyzing music...');
      const musicResult = await this.musicEngine.analyzeFromMaterials(
        parseResult.materials.filter(m => m.type === 'audio')
      );
      console.log(`✓ Detected ${musicResult.editPoints.length} edit points`);
      console.log(`✓ Music confidence: ${(musicResult.confidence * 100).toFixed(1)}%`);
      
      // 3. 映像解析
      console.log('\n3. Analyzing video...');
      const videoResult = await this.videoEngine.analyzeFromMaterials(
        parseResult.materials.filter(m => m.type === 'video')
      );
      console.log(`✓ Analyzed ${videoResult.shots.length} shots`);
      console.log(`✓ Hero shots: ${videoResult.shots.filter(s => s.isHeroShot).length}`);
      
      // 4. 時間ベースマッチング
      console.log('\n4. Performing time-based matching...');
      const matchingResult = await this.matchingEngine.process({
        musicAnalysis: musicResult,
        videoAnalysis: videoResult,
        targetDuration: options.targetDuration || 60000, // 60秒デフォルト
        constraints: options.constraints,
      });
      
      console.log(`✓ Generated ${Object.keys(matchingResult.patterns).length} patterns`);
      console.log(`✓ Recommended: ${matchingResult.recommendedPattern}`);
      console.log(`✓ Aggregate confidence: ${(matchingResult.overallQuality.score * 100).toFixed(1)}%`);
      
      // 5. 品質検証
      console.log('\n5. Running quality validation...');
      const pattern = this.getSelectedPattern(matchingResult);
      const explainData = await this.buildExplainData(matchingResult);
      
      const qaReport = await this.qaValidator.runFullValidation(
        matchingResult,
        explainData
      );
      
      console.log(`✓ QA Status: ${qaReport.status}`);
      console.log(`✓ Overall Score: ${(qaReport.overallScore * 100).toFixed(1)}%`);
      
      // 6. 出力生成
      console.log('\n6. Generating outputs...');
      await this.ensureDirectoryExists(outputDir);
      
      // XML出力
      const outputXmlPath = path.join(outputDir, 'edit_result.xml');
      await this.xmlGenerator.generateFromPattern(pattern, outputXmlPath);
      console.log(`✓ XML saved: ${outputXmlPath}`);
      
      // explain.json出力
      const explainPath = path.join(outputDir, 'explain.json');
      await this.explainBuilder.buildFromMatchingResult(matchingResult, explainPath);
      console.log(`✓ Explain.json saved: ${explainPath}`);
      
      // QAレポート出力
      const qaReportPath = path.join(outputDir, 'qa_report.json');
      await fs.writeFile(qaReportPath, JSON.stringify(qaReport, null, 2), 'utf-8');
      console.log(`✓ QA report saved: ${qaReportPath}`);
      
      // 処理結果まとめ
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      const result: ProcessingResult = {
        success: true,
        processingTime,
        matchingResult,
        qaReport,
        outputs: {
          xml: outputXmlPath,
          explain: explainPath,
          qaReport: qaReportPath,
        },
        summary: {
          inputMaterials: parseResult.materials.length,
          totalDecisions: pattern.decisions.length,
          aggregateConfidence: explainData.aggregateConfidence,
          recommendedPattern: matchingResult.recommendedPattern,
          qaStatus: qaReport.status,
        },
      };
      
      // 完了レポート
      this.printCompletionReport(result);
      
      return result;
      
    } catch (error) {
      console.error('\n❌ Processing failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime,
      };
    }
  }
  
  /**
   * 個別ファイルからの処理
   * 音楽ファイルと映像ファイルを直接指定して処理
   */
  public async processFromFiles(
    audioPath: string,
    videoPath: string,
    outputDir: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    console.log(`\n=== AutoEditTATE File Processing Started ===`);
    console.log(`Audio: ${audioPath}`);
    console.log(`Video: ${videoPath}`);
    
    const startTime = Date.now();
    
    try {
      // 1. 音楽解析
      console.log('\n1. Analyzing music file...');
      const musicResult = await this.musicEngine.analyzeFile(audioPath);
      console.log(`✓ Music analysis completed`);
      
      // 2. 映像解析
      console.log('\n2. Analyzing video file...');
      const videoResult = await this.videoEngine.analyzeFile(videoPath);
      console.log(`✓ Video analysis completed`);
      
      // 3. マッチング処理
      console.log('\n3. Performing matching...');
      const matchingResult = await this.matchingEngine.process({
        musicAnalysis: musicResult,
        videoAnalysis: videoResult,
        targetDuration: options.targetDuration || 60000,
        constraints: options.constraints,
      });
      
      // 4. 出力生成
      console.log('\n4. Generating outputs...');
      await this.ensureDirectoryExists(outputDir);
      
      const pattern = this.getSelectedPattern(matchingResult);
      const explainData = await this.buildExplainData(matchingResult);
      
      // XML生成（簡易版）
      const outputXmlPath = path.join(outputDir, 'edit_result.xml');
      await this.xmlGenerator.generateFromPattern(pattern, outputXmlPath);
      
      // explain.json生成
      const explainPath = path.join(outputDir, 'explain.json');
      await this.explainBuilder.buildFromMatchingResult(matchingResult, explainPath);
      
      // QA検証
      const qaReport = await this.qaValidator.runFullValidation(
        matchingResult,
        explainData
      );
      
      const qaReportPath = path.join(outputDir, 'qa_report.json');
      await fs.writeFile(qaReportPath, JSON.stringify(qaReport, null, 2), 'utf-8');
      
      const processingTime = Date.now() - startTime;
      
      const result: ProcessingResult = {
        success: true,
        processingTime,
        matchingResult,
        qaReport,
        outputs: {
          xml: outputXmlPath,
          explain: explainPath,
          qaReport: qaReportPath,
        },
        summary: {
          inputMaterials: 2, // audio + video
          totalDecisions: pattern.decisions.length,
          aggregateConfidence: explainData.aggregateConfidence,
          recommendedPattern: matchingResult.recommendedPattern,
          qaStatus: qaReport.status,
        },
      };
      
      this.printCompletionReport(result);
      
      return result;
      
    } catch (error) {
      console.error('\n❌ Processing failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime,
      };
    }
  }
  
  /**
   * リアルタイム処理モード
   * UIからの段階的処理要求に対応
   */
  public async startRealtimeProcessing(
    callback: RealtimeCallback
  ): Promise<RealtimeSession> {
    console.log('Starting realtime processing session...');
    
    const session: RealtimeSession = {
      id: `session_${Date.now()}`,
      startTime: Date.now(),
      status: 'active',
      progress: {
        musicAnalysis: 0,
        videoAnalysis: 0,
        matching: 0,
        qa: 0,
      },
    };
    
    // プログレス更新機能
    const updateProgress = (stage: keyof RealtimeSession['progress'], value: number) => {
      session.progress[stage] = value;
      callback('progress', { session, stage, value });
    };
    
    return session;
  }
  
  /**
   * 設定の更新
   */
  public async updateConfiguration(config: Partial<any>): Promise<void> {
    await this.configLoader.updateConfiguration(config);
    console.log('Configuration updated');
  }
  
  /**
   * システム状態の取得
   */
  public getSystemStatus(): SystemStatus {
    return {
      version: '1.0.0',
      components: {
        config: this.configLoader.isInitialized(),
        musicEngine: true,
        videoEngine: true,
        matchingEngine: true,
        xmlParser: true,
        qaValidator: true,
      },
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
      },
      uptime: process.uptime(),
    };
  }
  
  // プライベートメソッド
  
  private getSelectedPattern(result: MatchingResult): any {
    switch (result.recommendedPattern) {
      case 'dynamic_cut':
        return result.patterns.dynamicCut;
      case 'narrative_flow':
        return result.patterns.narrativeFlow;
      case 'hybrid_balance':
        return result.patterns.hybridBalance;
      default:
        return result.patterns.hybridBalance;
    }
  }
  
  private async buildExplainData(result: MatchingResult): Promise<any> {
    // explain.jsonデータを構築（ExplainJsonBuilderの内部メソッドを利用）
    const pattern = this.getSelectedPattern(result);
    
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      aggregateConfidence: pattern.evaluation.aggregateConfidence,
      decisions: pattern.decisions,
      qualityMetrics: {
        musicSync: pattern.evaluation.musicalAlignment,
        visualFlow: pattern.evaluation.visualFlow,
        narrativeCoherence: pattern.evaluation.narrativeCohesion,
        technicalQuality: pattern.evaluation.aggregateConfidence,
        thirtyPercentCompliance: pattern.evaluation.transitionQuality,
      },
      segmentAnalysis: pattern.segmentEvaluations || [],
      statistics: {
        totalDecisions: pattern.decisions.length,
        avgConfidence: pattern.decisions.reduce((sum: number, d: any) => sum + d.confidence, 0) / pattern.decisions.length,
        avgFlexibility: pattern.decisions.reduce((sum: number, d: any) => sum + d.flexibility, 0) / pattern.decisions.length,
      },
    };
  }
  
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
  
  private printCompletionReport(result: ProcessingResult): void {
    console.log('\n=== AutoEditTATE Processing Complete ===');
    
    if (result.success && result.summary) {
      console.log(`✅ Status: SUCCESS`);
      console.log(`⏱️  Processing Time: ${(result.processingTime / 1000).toFixed(1)}s`);
      console.log(`🎵 Input Materials: ${result.summary.inputMaterials}`);
      console.log(`✂️  Total Decisions: ${result.summary.totalDecisions}`);
      console.log(`🎯 Aggregate Confidence: ${(result.summary.aggregateConfidence * 100).toFixed(1)}%`);
      console.log(`📋 Recommended Pattern: ${result.summary.recommendedPattern}`);
      console.log(`🔍 QA Status: ${result.summary.qaStatus}`);
      
      if (result.outputs) {
        console.log('\n📁 Output Files:');
        console.log(`  • XML: ${result.outputs.xml}`);
        console.log(`  • Explain: ${result.outputs.explain}`);
        console.log(`  • QA Report: ${result.outputs.qaReport}`);
      }
      
      // 品質判定
      const meetsStandard = result.summary.aggregateConfidence >= 0.88;
      console.log(`\n${meetsStandard ? '🟢' : '🟡'} Quality Standard: ${meetsStandard ? 'PASSED' : 'NEEDS_REVIEW'}`);
      
    } else {
      console.log(`❌ Status: FAILED`);
      console.log(`⏱️  Processing Time: ${(result.processingTime / 1000).toFixed(1)}s`);
      if (result.error) {
        console.log(`❗ Error: ${result.error}`);
      }
    }
    
    console.log('==========================================\n');
  }
}

// 型定義

export interface ProcessingOptions {
  targetDuration?: number; // ミリ秒
  constraints?: {
    maxCuts?: number;
    minShotDuration?: number;
    preferredPatterns?: string[];
  };
  quality?: {
    confidenceThreshold?: number;
    requireHeroShots?: boolean;
    enforce30PercentRule?: boolean;
  };
}

export interface ProcessingResult {
  success: boolean;
  processingTime: number;
  matchingResult?: MatchingResult;
  qaReport?: QAReport;
  outputs?: {
    xml: string;
    explain: string;
    qaReport: string;
  };
  summary?: {
    inputMaterials: number;
    totalDecisions: number;
    aggregateConfidence: number;
    recommendedPattern: string;
    qaStatus: string;
  };
  error?: string;
}

export interface RealtimeSession {
  id: string;
  startTime: number;
  status: 'active' | 'paused' | 'completed' | 'error';
  progress: {
    musicAnalysis: number;
    videoAnalysis: number;
    matching: number;
    qa: number;
  };
}

export type RealtimeCallback = (
  event: 'progress' | 'complete' | 'error',
  data: any
) => void;

export interface SystemStatus {
  version: string;
  components: Record<string, boolean>;
  memory: {
    used: number;
    total: number;
  };
  uptime: number;
}