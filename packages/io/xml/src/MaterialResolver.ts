import { promises as fs } from 'fs';
import path from 'path';
import type { MaterialPath, MediaClip } from './types.js';

/**
 * 素材パス解決器
 * XMLから参照される素材ファイルのパスを解決
 */
export class MaterialResolver {
  private searchPaths: string[] = [];
  private cache = new Map<string, MaterialPath>();
  
  constructor(basePaths: string[] = []) {
    this.searchPaths = basePaths;
  }
  
  /**
   * 検索パスを追加
   */
  public addSearchPath(searchPath: string): void {
    if (!this.searchPaths.includes(searchPath)) {
      this.searchPaths.push(searchPath);
    }
  }
  
  /**
   * 素材パスを解決
   */
  public async resolve(originalPath: string): Promise<MaterialPath> {
    // キャッシュチェック
    if (this.cache.has(originalPath)) {
      return this.cache.get(originalPath)!;
    }
    
    // パスのクリーンアップ
    const cleanPath = this.cleanPath(originalPath);
    
    // 解決を試みる
    const resolved = await this.tryResolve(cleanPath);
    
    // キャッシュに保存
    this.cache.set(originalPath, resolved);
    
    return resolved;
  }
  
  /**
   * 複数の素材パスを一括解決
   */
  public async resolveMultiple(paths: string[]): Promise<MaterialPath[]> {
    return Promise.all(paths.map(p => this.resolve(p)));
  }
  
  /**
   * クリップから素材パスを抽出して解決
   */
  public async resolveFromClips(clips: MediaClip[]): Promise<Map<string, MaterialPath>> {
    const resolved = new Map<string, MaterialPath>();
    
    for (const clip of clips) {
      const paths = this.extractPathsFromClip(clip);
      
      for (const path of paths) {
        if (path && !resolved.has(path)) {
          const material = await this.resolve(path);
          resolved.set(path, material);
        }
      }
    }
    
    return resolved;
  }
  
  /**
   * パスをクリーンアップ
   */
  private cleanPath(originalPath: string): string {
    let cleaned = originalPath;
    
    // file:// URLの処理
    if (cleaned.startsWith('file://')) {
      cleaned = cleaned.substring(7);
      
      // Windowsパスの処理
      if (/^\/[A-Z]:/.test(cleaned)) {
        cleaned = cleaned.substring(1);
      }
    }
    
    // URLエンコードされた文字をデコード
    cleaned = decodeURIComponent(cleaned);
    
    // バックスラッシュをスラッシュに変換（Windows）
    cleaned = cleaned.replace(/\\/g, '/');
    
    return cleaned;
  }
  
  /**
   * パス解決を試みる
   */
  private async tryResolve(cleanPath: string): Promise<MaterialPath> {
    // 絶対パスの場合
    if (path.isAbsolute(cleanPath)) {
      const exists = await this.checkFileExists(cleanPath);
      if (exists) {
        return this.createMaterialPath(cleanPath, cleanPath, true);
      }
    }
    
    // 検索パスから探す
    for (const searchPath of this.searchPaths) {
      const fullPath = path.join(searchPath, cleanPath);
      const exists = await this.checkFileExists(fullPath);
      
      if (exists) {
        return this.createMaterialPath(cleanPath, fullPath, true);
      }
    }
    
    // ファイル名のみで検索
    const fileName = path.basename(cleanPath);
    for (const searchPath of this.searchPaths) {
      const found = await this.findFileInDirectory(searchPath, fileName);
      if (found) {
        return this.createMaterialPath(cleanPath, found, true);
      }
    }
    
    // 見つからない場合
    return this.createMaterialPath(cleanPath, cleanPath, false);
  }
  
  /**
   * ファイルの存在確認
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * ディレクトリ内でファイルを検索
   */
  private async findFileInDirectory(
    directory: string,
    fileName: string
  ): Promise<string | null> {
    try {
      const files = await fs.readdir(directory, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile() && file.name === fileName) {
          return path.join(directory, file.name);
        }
        
        // サブディレクトリも検索（1階層のみ）
        if (file.isDirectory()) {
          const subPath = path.join(directory, file.name);
          const found = await this.findFileInDirectory(subPath, fileName);
          if (found) return found;
        }
      }
    } catch {
      // ディレクトリアクセスエラーは無視
    }
    
    return null;
  }
  
  /**
   * MaterialPathオブジェクトを作成
   */
  private async createMaterialPath(
    originalPath: string,
    resolvedPath: string,
    exists: boolean
  ): Promise<MaterialPath> {
    const type = this.detectFileType(resolvedPath);
    
    let metadata: MaterialPath['metadata'];
    
    if (exists) {
      try {
        metadata = await this.extractMetadata(resolvedPath, type);
      } catch {
        // メタデータ抽出エラーは無視
      }
    }
    
    return {
      originalPath,
      resolvedPath,
      exists,
      type,
      metadata,
    };
  }
  
  /**
   * ファイルタイプを検出
   */
  private detectFileType(filePath: string): MaterialPath['type'] {
    const ext = path.extname(filePath).toLowerCase();
    
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg'];
    const audioExtensions = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.wma'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.gif', '.webp'];
    
    if (videoExtensions.includes(ext)) {
      return 'video';
    } else if (audioExtensions.includes(ext)) {
      return 'audio';
    } else if (imageExtensions.includes(ext)) {
      return 'image';
    }
    
    // デフォルトはビデオ
    return 'video';
  }
  
  /**
   * メタデータを抽出
   */
  private async extractMetadata(
    filePath: string,
    type: MaterialPath['type']
  ): Promise<MaterialPath['metadata']> {
    const stats = await fs.stat(filePath);
    
    // 基本的なメタデータ
    const metadata: MaterialPath['metadata'] = {};
    
    // ファイルタイプに応じた処理
    // 実際の実装ではffprobeなどを使用
    switch (type) {
      case 'video':
        // ビデオメタデータの仮実装
        metadata.duration = 60000; // 60秒
        metadata.width = 1920;
        metadata.height = 1080;
        metadata.fps = 30;
        metadata.codec = 'h264';
        break;
        
      case 'audio':
        // オーディオメタデータの仮実装
        metadata.duration = 60000;
        break;
        
      case 'image':
        // 画像メタデータの仮実装
        metadata.width = 1920;
        metadata.height = 1080;
        break;
    }
    
    return metadata;
  }
  
  /**
   * クリップからパスを抽出
   */
  private extractPathsFromClip(clip: MediaClip): string[] {
    const paths: string[] = [];
    
    // クリップ自体のパス情報を探す
    // 実際の実装はXML構造に依存
    
    return paths;
  }
  
  /**
   * 欠落ファイルのレポート生成
   */
  public generateMissingFilesReport(materials: MaterialPath[]): {
    total: number;
    found: number;
    missing: string[];
    warnings: string[];
  } {
    const missing: string[] = [];
    const warnings: string[] = [];
    let found = 0;
    
    for (const material of materials) {
      if (!material.exists) {
        missing.push(material.originalPath);
      } else {
        found++;
        
        // 警告チェック
        if (material.type === 'video' && material.metadata) {
          if (material.metadata.codec && !['h264', 'hevc'].includes(material.metadata.codec)) {
            warnings.push(`Non-standard codec for ${material.originalPath}: ${material.metadata.codec}`);
          }
        }
      }
    }
    
    return {
      total: materials.length,
      found,
      missing,
      warnings,
    };
  }
  
  /**
   * パスの再マッピング
   */
  public remapPaths(
    materials: MaterialPath[],
    mapping: Map<string, string>
  ): MaterialPath[] {
    return materials.map(material => {
      const newPath = mapping.get(material.originalPath);
      
      if (newPath) {
        return {
          ...material,
          resolvedPath: newPath,
          exists: true, // 再マッピングされたので存在すると仮定
        };
      }
      
      return material;
    });
  }
}