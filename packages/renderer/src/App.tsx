import React, { useState, useEffect } from 'react';
import { FileImport } from './components/FileImport';
import { ProcessingView } from './components/ProcessingView';
import { ResultsView } from './components/ResultsView';
import { StatusBar } from './components/StatusBar';
import { TopMenu } from './components/TopMenu';
import { ConfigPanel } from './components/ConfigPanel';
import './App.css';

/**
 * AutoEditTATE React Application
 * 
 * メインのReactアプリケーション
 * - ファイルインポート
 * - 処理進捗表示
 * - 結果プレビュー
 * - 設定管理
 */

export type AppState = 'idle' | 'importing' | 'processing' | 'completed' | 'error';

export interface ProcessingData {
  type: 'xml' | 'files';
  xmlPath?: string;
  audioPath?: string;
  videoPath?: string;
  outputDir?: string;
  options?: any;
}

export interface ProcessingResult {
  success: boolean;
  result?: any;
  error?: string;
}

function App() {
  // アプリケーション状態
  const [appState, setAppState] = useState<AppState>('idle');
  const [processingData, setProcessingData] = useState<ProcessingData | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [showConfig, setShowConfig] = useState(false);
  
  // エラー状態
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // システム状態を取得
    loadSystemStatus();
    
    // Electronイベントリスナーを設定
    setupElectronListeners();
    
    return () => {
      // クリーンアップ
      cleanupElectronListeners();
    };
  }, []);
  
  /**
   * システム状態を読み込み
   */
  const loadSystemStatus = async () => {
    try {
      const status = await window.electronAPI.autoEdit.getStatus();
      setSystemStatus(status);
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  };
  
  /**
   * Electronイベントリスナーを設定
   */
  const setupElectronListeners = () => {
    // メニューからのファイルインポート
    window.electronAPI.on('file:xml-imported', handleXMLImported);
    window.electronAPI.on('file:audio-imported', handleAudioImported);
    window.electronAPI.on('file:video-imported', handleVideoImported);
    
    // メニューからの操作
    window.electronAPI.on('menu:start-analysis', handleStartAnalysis);
    window.electronAPI.on('menu:stop-processing', handleStopProcessing);
    window.electronAPI.on('menu:run-qa', handleRunQA);
    window.electronAPI.on('menu:export', handleExport);
    
    // 処理進捗
    window.electronAPI.on('processing:progress', handleProcessingProgress);
    window.electronAPI.on('processing:complete', handleProcessingComplete);
    window.electronAPI.on('processing:error', handleProcessingError);
  };
  
  /**
   * Electronイベントリスナーをクリーンアップ
   */
  const cleanupElectronListeners = () => {
    const channels = [
      'file:xml-imported',
      'file:audio-imported', 
      'file:video-imported',
      'menu:start-analysis',
      'menu:stop-processing',
      'menu:run-qa',
      'menu:export',
      'processing:progress',
      'processing:complete',
      'processing:error',
    ];\n    \n    channels.forEach(channel => {\n      window.electronAPI.removeAllListeners(channel);\n    });\n  };\n  \n  /**\n   * XMLファイルインポートハンドラー\n   */\n  const handleXMLImported = (xmlPath: string) => {\n    setProcessingData({\n      type: 'xml',\n      xmlPath,\n    });\n    setAppState('importing');\n  };\n  \n  /**\n   * オーディオファイルインポートハンドラー\n   */\n  const handleAudioImported = (audioPath: string) => {\n    setProcessingData(prev => ({\n      ...prev,\n      type: 'files',\n      audioPath,\n    }));\n    setAppState('importing');\n  };\n  \n  /**\n   * ビデオファイルインポートハンドラー\n   */\n  const handleVideoImported = (videoPath: string) => {\n    setProcessingData(prev => ({\n      ...prev,\n      type: 'files',\n      videoPath,\n    }));\n    setAppState('importing');\n  };\n  \n  /**\n   * 解析開始ハンドラー\n   */\n  const handleStartAnalysis = () => {\n    if (processingData) {\n      startProcessing(processingData);\n    }\n  };\n  \n  /**\n   * 処理停止ハンドラー\n   */\n  const handleStopProcessing = () => {\n    setAppState('idle');\n    setProcessingData(null);\n    setProcessingResult(null);\n  };\n  \n  /**\n   * QA実行ハンドラー\n   */\n  const handleRunQA = () => {\n    if (processingResult && processingResult.success) {\n      // QA再実行ロジック\n      console.log('Running QA validation...');\n    }\n  };\n  \n  /**\n   * エクスポートハンドラー\n   */\n  const handleExport = () => {\n    if (processingResult && processingResult.success) {\n      // エクスポートダイアログを表示\n      exportResults();\n    }\n  };\n  \n  /**\n   * 処理進捗ハンドラー\n   */\n  const handleProcessingProgress = (progress: any) => {\n    console.log('Processing progress:', progress);\n  };\n  \n  /**\n   * 処理完了ハンドラー\n   */\n  const handleProcessingComplete = (result: any) => {\n    setProcessingResult({ success: true, result });\n    setAppState('completed');\n  };\n  \n  /**\n   * 処理エラーハンドラー\n   */\n  const handleProcessingError = (error: any) => {\n    setProcessingResult({ success: false, error: error.message });\n    setAppState('error');\n    setError(error.message);\n  };\n  \n  /**\n   * 処理を開始\n   */\n  const startProcessing = async (data: ProcessingData) => {\n    setAppState('processing');\n    setError(null);\n    \n    try {\n      // 出力ディレクトリを選択\n      const outputDirResult = await window.electronAPI.dialog.selectDirectory(\n        'Select Output Directory'\n      );\n      \n      if (outputDirResult.canceled || !outputDirResult.filePaths?.[0]) {\n        setAppState('importing');\n        return;\n      }\n      \n      const outputDir = outputDirResult.filePaths[0];\n      \n      let result;\n      if (data.type === 'xml' && data.xmlPath) {\n        result = await window.electronAPI.autoEdit.processXML(\n          data.xmlPath,\n          outputDir,\n          data.options\n        );\n      } else if (data.type === 'files' && data.audioPath && data.videoPath) {\n        result = await window.electronAPI.autoEdit.processFiles(\n          data.audioPath,\n          data.videoPath,\n          outputDir,\n          data.options\n        );\n      } else {\n        throw new Error('Invalid processing data');\n      }\n      \n      if (result.success) {\n        setProcessingResult(result);\n        setAppState('completed');\n      } else {\n        setProcessingResult(result);\n        setAppState('error');\n        setError(result.error || 'Processing failed');\n      }\n      \n    } catch (error) {\n      const errorMessage = error instanceof Error ? error.message : String(error);\n      setProcessingResult({ success: false, error: errorMessage });\n      setAppState('error');\n      setError(errorMessage);\n    }\n  };\n  \n  /**\n   * 結果をエクスポート\n   */\n  const exportResults = async () => {\n    try {\n      const result = await window.electronAPI.dialog.selectDirectory(\n        'Select Export Directory'\n      );\n      \n      if (!result.canceled && result.filePaths?.[0]) {\n        console.log('Exporting to:', result.filePaths[0]);\n        // エクスポート処理を実装\n      }\n    } catch (error) {\n      console.error('Export failed:', error);\n    }\n  };\n  \n  /**\n   * エラーをクリア\n   */\n  const clearError = () => {\n    setError(null);\n    if (appState === 'error') {\n      setAppState('idle');\n    }\n  };\n  \n  return (\n    <div className=\"app\">\n      {/* トップメニュー */}\n      <TopMenu \n        onShowConfig={() => setShowConfig(true)}\n        onRefreshStatus={loadSystemStatus}\n        systemStatus={systemStatus}\n      />\n      \n      {/* メインコンテンツ */}\n      <div className=\"app-content\">\n        {appState === 'idle' && (\n          <FileImport \n            onStartProcessing={startProcessing}\n            onError={setError}\n          />\n        )}\n        \n        {(appState === 'importing' || appState === 'processing') && (\n          <ProcessingView \n            state={appState}\n            data={processingData}\n            onCancel={() => setAppState('idle')}\n          />\n        )}\n        \n        {(appState === 'completed' || appState === 'error') && (\n          <ResultsView \n            result={processingResult}\n            onReset={() => {\n              setAppState('idle');\n              setProcessingData(null);\n              setProcessingResult(null);\n            }}\n            onRetry={() => {\n              if (processingData) {\n                startProcessing(processingData);\n              }\n            }}\n          />\n        )}\n      </div>\n      \n      {/* ステータスバー */}\n      <StatusBar \n        appState={appState}\n        systemStatus={systemStatus}\n        error={error}\n        onClearError={clearError}\n      />\n      \n      {/* 設定パネル */}\n      {showConfig && (\n        <ConfigPanel \n          onClose={() => setShowConfig(false)}\n          onConfigUpdate={loadSystemStatus}\n        />\n      )}\n    </div>\n  );\n}\n\nexport default App;