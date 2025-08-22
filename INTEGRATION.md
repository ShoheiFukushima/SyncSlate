# AutoEditTATE Integration Guide

## 🎯 Overview

AutoEditTATE is a comprehensive AI-powered automatic video editing system designed for SNS content creation (60 seconds or less). This document provides complete integration and deployment guidance for the finished system.

## 📋 System Architecture

### Core Design Principles

1. **Relative Dynamism Principle**: All analysis values are treated as relative values within the song/material, not absolute values
2. **Time-based Matching Strategy**: Different editing strategies for different time segments (0-3s hook, 3-10s engagement, etc.)
3. **30% Change Rule**: At least one element must change by 30% or more between cuts for smooth transitions
4. **Quality Assurance**: Aggregate confidence ≥ 88% required for output approval

### Module Structure

```
AutoEditTATE/
├── packages/
│   ├── config/                 # Configuration management
│   ├── analysis/
│   │   ├── music/             # Music analysis engine
│   │   └── video/             # Video analysis engine
│   ├── matching/              # Time-based matching engine
│   ├── io/xml/               # XML I/O processing
│   ├── qa/validators/        # Quality assurance suite
│   ├── core/                 # Main integration module
│   ├── electron/             # Electron main process
│   └── renderer/             # React UI components
├── tests/                    # Integration tests
└── docs/                    # Documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18.0.0
- npm ≥ 8.0.0
- 8GB+ RAM recommended
- macOS, Windows, or Linux

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/autoedit-tate.git
cd autoedit-tate

# Install dependencies
npm install

# Build all packages
npm run build

# Start development environment
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Create distributables
npm run dist
```

## 🔧 Configuration

### Core Settings

The system uses YAML configuration files in `packages/config/`:

- `matching-segments.yaml`: Time segment strategies and weights
- `analysis-settings.yaml`: Music and video analysis parameters

### Key Configuration Options

```yaml
# Music Analysis
music:
  beatDetectionSensitivity: 0.7    # Beat detection threshold
  relativeDynamicsWindow: 4000     # Window for relative analysis (ms)

# Video Analysis
video:
  shotDetectionThreshold: 0.3      # Shot boundary detection
  heroShotEdgeComplexity: 0.6      # Complexity threshold for hero shots

# Quality Standards
quality:
  confidenceThreshold: 0.88        # Minimum confidence for output
  thirtyPercentRuleStrict: true    # Enforce 30% change rule
```

## 📊 Processing Workflow

### 1. Input Processing

**XML Mode**: Import Premiere Pro XML project
- Parses XML structure
- Resolves material file paths
- Extracts existing cue points

**Files Mode**: Import separate audio and video files
- Direct file analysis
- Format validation
- Metadata extraction

### 2. Analysis Phase

**Music Analysis** (3-8 seconds):
- Beat and onset detection using relative dynamics
- Edit point identification with confidence scores
- Musical context analysis (downbeats, phrases)

**Video Analysis** (4-6 seconds):
- Shot boundary detection and quality assessment
- Hero shot identification (high visual complexity)
- 30% change rule validation between shots

### 3. Time-based Matching (8-12 seconds)

Generates three distinct editing patterns:

**Dynamic Cut Pattern**:
- High sync with music beats
- Rapid cutting style
- Visual emphasis

**Narrative Flow Pattern**:
- Semantic coherence priority
- Longer shot durations
- Story-driven transitions

**Hybrid Balance Pattern**:
- Balanced approach
- Optimized for broad appeal
- Recommended for most content

### 4. Quality Assurance (2-4 seconds)

Comprehensive validation suite:
- Confidence validation (≥88% aggregate)
- 30% rule compliance checking
- Segment transition analysis
- Technical quality metrics
- Performance validation

### 5. Output Generation (1-2 seconds)

- **edit_result.xml**: Premiere Pro timeline
- **explain.json**: Detailed decision explanations
- **qa_report.json**: Quality assurance metrics
- **summary.txt**: Processing overview

## 🎛️ API Reference

### Core AutoEditTATE Class

```typescript
import { AutoEditTATE } from '@autoedittate/core';

const autoEdit = new AutoEditTATE();

// Process from XML
const result = await autoEdit.processFromXML(
  xmlPath: string,
  outputDir: string,
  options?: ProcessingOptions
);

// Process from files
const result = await autoEdit.processFromFiles(
  audioPath: string,
  videoPath: string,
  outputDir: string,
  options?: ProcessingOptions
);

// Get system status
const status = autoEdit.getSystemStatus();

// Update configuration
await autoEdit.updateConfiguration(config);
```

### Processing Options

```typescript
interface ProcessingOptions {
  targetDuration?: number;        // Target duration in ms (default: 60000)
  constraints?: {
    maxCuts?: number;            // Maximum number of cuts
    minShotDuration?: number;    // Minimum shot duration in ms
    preferredPatterns?: string[]; // Preferred pattern types
  };
  quality?: {
    confidenceThreshold?: number;     // Override confidence threshold
    requireHeroShots?: boolean;       // Require hero shots in opening
    enforce30PercentRule?: boolean;   // Strict 30% rule enforcement
  };
}
```

### Processing Result

```typescript
interface ProcessingResult {
  success: boolean;
  processingTime: number;
  matchingResult?: MatchingResult;
  qaReport?: QAReport;
  outputs?: {
    xml: string;          // Path to generated XML
    explain: string;      // Path to explain.json
    qaReport: string;     // Path to QA report
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
```

## 🎨 UI Components

### Electron Application

The desktop application provides:

- **File Import**: Drag-and-drop support for XML, audio, and video files
- **Real-time Processing**: Live progress visualization with detailed step tracking
- **Results Dashboard**: Quality metrics, pattern comparison, and export options
- **Configuration Panel**: Advanced settings for analysis and matching parameters

### Key UI Features

- **Progress Visualization**: Real-time display of processing steps
- **Quality Metrics**: Visual indicators for confidence, sync, and compliance
- **Pattern Selection**: Interactive comparison of generated edit patterns
- **Export Options**: Batch export of all result files

## 🧪 Testing

### Integration Tests

Run comprehensive system tests:

```bash
# Run all tests
npm test

# Run integration tests
node tests/integration-test.js

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Test Coverage

- System initialization and component health
- Configuration management
- File processing simulation
- QA validation system
- Performance and memory usage
- Error handling

## 📈 Performance Metrics

### Target Performance

- **Processing Time**: < 5 minutes for 60-second content
- **Memory Usage**: < 2GB peak memory consumption
- **Initialization**: < 500ms system startup
- **Quality Standard**: ≥88% aggregate confidence

### Optimization Guidelines

1. **Content Length**: Optimal for 15-60 second videos
2. **File Formats**: MP4/MOV for video, MP3/WAV for audio
3. **Resolution**: 1080p or lower for optimal performance
4. **Hardware**: SSD storage recommended for large media files

## 🔍 Quality Assurance

### Validation Suite

The QA system includes 7 specialized validators:

1. **ConfidenceValidator**: Ensures aggregate confidence ≥ 88%
2. **ThirtyPercentRuleValidator**: Validates transition compliance
3. **SegmentTransitionValidator**: Checks timeline continuity
4. **XMLStructureValidator**: Verifies output XML integrity
5. **TimecodeValidator**: Ensures timing consistency
6. **PerformanceValidator**: Monitors processing time
7. **QualityMetricsValidator**: Validates all quality metrics

### Quality Standards

- **Aggregate Confidence**: ≥ 88% for production output
- **30% Rule Compliance**: ≥ 80% of transitions must comply
- **Music Sync**: ≥ 50% musical alignment score
- **Processing Time**: < 5 minutes total processing

## 🚨 Troubleshooting

### Common Issues

**Low Confidence Scores**:
- Adjust beat detection sensitivity
- Ensure adequate shot variety
- Check audio quality and clarity

**30% Rule Violations**:
- Increase shot diversity in source material
- Adjust shot detection threshold
- Review transition validation settings

**Performance Issues**:
- Reduce target video resolution
- Ensure sufficient RAM availability
- Use SSD storage for media files

**XML Import Errors**:
- Verify XML structure validity
- Check material file paths
- Ensure Premiere Pro compatibility

### Debug Mode

Enable detailed logging:

```bash
# Set environment variable
export DEBUG=autoedit:*

# Run with debug output
npm run dev
```

## 📦 Distribution

### Electron Builds

Create platform-specific distributables:

```bash
# Build for current platform
npm run dist

# Platform-specific builds
npm run dist -- --mac
npm run dist -- --win
npm run dist -- --linux
```

### System Requirements

**Minimum**:
- 4GB RAM
- 2GB free disk space
- Dual-core processor

**Recommended**:
- 8GB+ RAM
- 10GB+ free disk space
- Quad-core processor
- Dedicated graphics card

## 🔐 Security Considerations

### File Handling

- Input validation for all media files
- Sandboxed processing environment
- No external network access required

### Data Privacy

- All processing is local
- No user data transmission
- Temporary files are cleaned up automatically

## 📚 Advanced Usage

### Custom Analysis Parameters

Extend the analysis engines:

```typescript
// Custom music analysis settings
const customMusicConfig = {
  beatDetectionSensitivity: 0.8,
  onsetDetectionThreshold: 0.6,
  relativeDynamicsWindow: 3000
};

await autoEdit.updateConfiguration({
  analysis: { music: customMusicConfig }
});
```

### Custom Segment Weights

Modify time-based matching strategies:

```typescript
const customSegmentWeights = {
  opening: { visual: 0.6, sync: 0.2, semantic: 0.1, stability: 0.1 },
  climax: { visual: 0.3, sync: 0.5, semantic: 0.1, stability: 0.1 }
};

await autoEdit.updateConfiguration({
  matching: { segments: customSegmentWeights }
});
```

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Follow TypeScript and ESLint guidelines
4. Add tests for new functionality
5. Submit pull request

### Code Standards

- TypeScript strict mode
- ESM modules
- Comprehensive error handling
- 80%+ test coverage

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For technical support and questions:

- GitHub Issues: https://github.com/your-org/autoedit-tate/issues
- Documentation: https://docs.autoedit-tate.com
- Community Forum: https://community.autoedit-tate.com

---

**AutoEditTATE** - Transforming video editing with AI-powered automation for the SNS generation.

Generated on: $(date)
Version: 1.0.0