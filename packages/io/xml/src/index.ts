/**
 * AutoEditTATE XML I/O モジュール
 * 
 * Premiere Pro XMLの入出力とexplain.json生成
 * - XMLパース（素材解決、キューポイント抽出）
 * - XML生成（編集決定からタイムライン作成）
 * - explain.json出力（編集判断の根拠記録）
 */

export { PremiereXMLParser } from './PremiereXMLParser.js';
export { MaterialResolver } from './MaterialResolver.js';
export { CuePointExtractor } from './CuePointExtractor.js';
export { XMLGenerator } from './XMLGenerator.js';
export { ExplainJsonBuilder } from './ExplainJsonBuilder.js';

// 型定義のエクスポート
export type {
  // XML構造
  PremiereXML,
  Sequence,
  ClipItem,
  MediaClip,
  
  // パース結果
  XMLParseResult,
  MaterialPath,
  CuePoint,
  
  // 生成オプション
  XMLGenerateOptions,
  
  // EDL
  EDLEntry,
  EDLConversionResult,
} from './types.js';