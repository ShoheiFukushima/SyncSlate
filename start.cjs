#!/usr/bin/env node

/**
 * AutoEditTATE 起動スクリプト
 * 
 * 使い方:
 * node start.js           - インタラクティブモード
 * node start.js demo      - デモUIを開く
 * node start.js test      - テストを実行
 * node start.js process   - 処理シミュレーション
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const readline = require('readline');

const mode = process.argv[2] || 'interactive';

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                     🎬 AutoEditTATE                         ║
║                                                              ║
║         AI-powered automatic video editing for SNS          ║
║                    (60 seconds or less)                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

switch (mode) {
  case 'demo':
    startDemoUI();
    break;
  case 'test':
    runTests();
    break;
  case 'process':
    runProcessingSimulation();
    break;
  case 'interactive':
  default:
    startInteractiveMode();
    break;
}

function startDemoUI() {
  console.log('🌐 Opening Demo UI in browser...\n');
  const demoPath = path.join(__dirname, 'demo.html');
  
  exec(`open "${demoPath}"`, (error) => {
    if (error) {
      console.error('Failed to open demo:', error);
      console.log(`\nPlease open manually: ${demoPath}`);
    } else {
      console.log('✅ Demo UI opened in browser');
      console.log('\nFeatures available in demo:');
      console.log('  • File import (drag & drop)');
      console.log('  • Processing simulation');
      console.log('  • Progress visualization');
      console.log('  • Result preview\n');
    }
  });
}

function runTests() {
  console.log('🧪 Running tests...\n');
  
  const tests = [
    { name: 'Simple Test', file: 'tests/simple-test.js' },
    { name: 'Module Test', file: 'tests/module-test.ts' },
    { name: 'Integration Test', file: 'tests/final-integration-test.js' }
  ];
  
  console.log('Available tests:');
  tests.forEach((test, i) => {
    console.log(`  ${i + 1}. ${test.name}`);
  });
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('\nSelect test to run (1-3): ', (answer) => {
    const index = parseInt(answer) - 1;
    if (index >= 0 && index < tests.length) {
      const test = tests[index];
      console.log(`\nRunning ${test.name}...\n`);
      
      const child = spawn('node', [test.file], {
        stdio: 'inherit',
        cwd: __dirname
      });
      
      child.on('close', (code) => {
        console.log(`\n${test.name} completed with code ${code}`);
        rl.close();
      });
    } else {
      console.log('Invalid selection');
      rl.close();
    }
  });
}

function runProcessingSimulation() {
  console.log('⚡ Starting processing simulation...\n');
  
  const steps = [
    { name: 'Parsing input files', icon: '📄', duration: 500 },
    { name: 'Analyzing music (relative dynamics)', icon: '🎵', duration: 1000 },
    { name: 'Analyzing video (shot quality)', icon: '🎬', duration: 800 },
    { name: 'Time-based matching (3 patterns)', icon: '⚡', duration: 1200 },
    { name: 'Running QA validation', icon: '✅', duration: 600 },
    { name: 'Generating outputs', icon: '📁', duration: 400 }
  ];
  
  let currentStep = 0;
  
  function processStep() {
    if (currentStep < steps.length) {
      const step = steps[currentStep];
      console.log(`${step.icon} ${step.name}...`);
      
      setTimeout(() => {
        console.log(`   ✓ Completed in ${step.duration}ms\n`);
        currentStep++;
        processStep();
      }, step.duration);
    } else {
      showResults();
    }
  }
  
  processStep();
  
  function showResults() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    PROCESSING COMPLETE!                       ');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('📊 Results:');
    console.log('  • Processing Time: 4.5s');
    console.log('  • Aggregate Confidence: 91.2%');
    console.log('  • Total Decisions: 18');
    console.log('  • Recommended Pattern: Hybrid Balance');
    console.log('  • Quality Standard: PASSED (≥88%)\n');
    
    console.log('📁 Generated Files:');
    console.log('  • edit_result.xml    - Premiere Pro timeline');
    console.log('  • explain.json       - Decision explanations');
    console.log('  • qa_report.json     - Quality metrics\n');
    
    console.log('🎯 Core Principles Applied:');
    console.log('  ✅ Relative Dynamism (0-1 normalization)');
    console.log('  ✅ Time-based Matching (5 segments)');
    console.log('  ✅ 30% Change Rule Validation');
    console.log('  ✅ Quality Assurance (≥88% confidence)\n');
  }
}

function startInteractiveMode() {
  console.log('📋 AutoEditTATE Interactive Mode\n');
  
  const options = [
    { key: '1', label: 'Open Demo UI', action: startDemoUI },
    { key: '2', label: 'Run Tests', action: runTests },
    { key: '3', label: 'Processing Simulation', action: runProcessingSimulation },
    { key: '4', label: 'Show System Info', action: showSystemInfo },
    { key: '5', label: 'Exit', action: () => process.exit(0) }
  ];
  
  console.log('Select an option:');
  options.forEach(opt => {
    console.log(`  ${opt.key}. ${opt.label}`);
  });
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('\nYour choice: ', (answer) => {
    const option = options.find(opt => opt.key === answer);
    if (option) {
      rl.close();
      option.action();
    } else {
      console.log('Invalid option');
      rl.close();
      startInteractiveMode();
    }
  });
}

function showSystemInfo() {
  console.log('\n📊 System Information\n');
  console.log('AutoEditTATE v1.0.0');
  console.log('━'.repeat(50));
  
  console.log('\n📦 Modules:');
  console.log('  ✅ Config Management    - Ready');
  console.log('  ✅ Music Analysis       - Ready');
  console.log('  ✅ Video Analysis       - Ready');
  console.log('  ✅ Matching Engine      - Ready');
  console.log('  ✅ XML I/O             - Ready');
  console.log('  ✅ QA Validators       - Ready');
  console.log('  ✅ UI Components       - Ready');
  
  console.log('\n🎯 Core Features:');
  console.log('  • 3 Edit Patterns (Dynamic, Narrative, Hybrid)');
  console.log('  • 5 Time Segments with unique strategies');
  console.log('  • Relative value normalization (0-1)');
  console.log('  • 30% change rule enforcement');
  console.log('  • 88% confidence threshold');
  
  console.log('\n💾 Installation:');
  console.log('  • Node.js: ' + process.version);
  console.log('  • Platform: ' + process.platform);
  console.log('  • Architecture: ' + process.arch);
  console.log('  • Memory: ' + Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB used');
  
  console.log('\n');
  
  // 戻る
  setTimeout(startInteractiveMode, 2000);
}