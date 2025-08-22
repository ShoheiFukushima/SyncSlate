# AutoEditTATE Backend - Task Status Management System

## 概要

AutoEditTATEのタスクステータス管理システムのバックエンドAPIです。
FastAPI、SQLAlchemy、Celeryを使用して、リアルタイムのタスク管理と進捗追跡を実現します。

## 機能

- ✅ タスクの作成・更新・削除
- ✅ リアルタイム進捗更新（WebSocket対応）
- ✅ プロジェクト管理
- ✅ タスクログ記録
- ✅ 非同期タスク処理（Celery）
- ✅ ステータスダッシュボード

## 必要要件

- Python 3.9+
- PostgreSQL 12+
- Redis 6+
- Node.js 18+ (フロントエンド用)

## セットアップ

### 1. 依存関係のインストール

```bash
cd backend
pip install -r requirements.txt
```

### 2. 環境変数の設定

```bash
cp .env.example .env
# .envファイルを編集して適切な値を設定
```

### 3. データベースのセットアップ

```bash
# PostgreSQLデータベースを作成
createdb autoedit_tate

# マイグレーションの初期化
alembic revision --autogenerate -m "Initial migration"

# マイグレーションの実行
alembic upgrade head
```

### 4. Redisの起動

```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:latest
```

## 起動方法

### APIサーバーの起動

```bash
# 開発環境
python main.py

# または
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Celeryワーカーの起動

```bash
# 別のターミナルで実行
celery -A celery_app worker --loglevel=info
```

### Celery Beatの起動（定期タスク用）

```bash
# 必要に応じて
celery -A celery_app beat --loglevel=info
```

## APIエンドポイント

### タスク管理

- `POST /api/tasks/` - タスク作成
- `GET /api/tasks/` - タスク一覧
- `GET /api/tasks/{task_id}` - タスク詳細
- `PUT /api/tasks/{task_id}` - タスク更新
- `DELETE /api/tasks/{task_id}` - タスク削除
- `POST /api/tasks/{task_id}/logs` - ログ追加
- `GET /api/tasks/{task_id}/logs` - ログ取得

### プロジェクト管理

- `POST /api/projects/` - プロジェクト作成
- `GET /api/projects/` - プロジェクト一覧
- `GET /api/projects/{project_id}` - プロジェクト詳細
- `PUT /api/projects/{project_id}` - プロジェクト更新
- `DELETE /api/projects/{project_id}` - プロジェクト削除
- `GET /api/projects/{project_id}/tasks` - プロジェクトのタスク一覧

### ステータス管理

- `GET /api/status/summary` - ステータスサマリー
- `GET /api/status/active` - アクティブタスク
- `WS /api/status/ws/{task_id}` - WebSocketリアルタイム更新
- `POST /api/status/notify/{task_id}` - 更新通知

## テスト

```bash
# テストの実行
pytest

# カバレッジ付きテスト
pytest --cov=. --cov-report=html

# 特定のテストファイルを実行
pytest tests/test_api.py
```

## 開発ツール

### APIドキュメント

起動後、以下のURLでAPIドキュメントにアクセスできます：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### データベース管理

```bash
# 新しいマイグレーションを作成
alembic revision --autogenerate -m "Description"

# マイグレーションを適用
alembic upgrade head

# マイグレーションをロールバック
alembic downgrade -1
```

## トラブルシューティング

### データベース接続エラー

```bash
# PostgreSQLが起動しているか確認
pg_ctl status

# データベースが存在するか確認
psql -l | grep autoedit_tate
```

### Redisエラー

```bash
# Redisが起動しているか確認
redis-cli ping
# PONGが返ってくればOK
```

### Celeryタスクが実行されない

```bash
# Celeryワーカーのログを確認
celery -A celery_app worker --loglevel=debug

# タスクキューの状態を確認
celery -A celery_app inspect active
```

## アーキテクチャ

```
backend/
├── api/              # APIエンドポイント
│   ├── tasks.py     # タスク管理API
│   ├── projects.py  # プロジェクト管理API
│   └── status.py    # ステータス管理API
├── models/          # データベースモデル
│   ├── task.py      # タスクモデル
│   ├── project.py   # プロジェクトモデル
│   └── database.py  # DB接続設定
├── services/        # ビジネスロジック
│   ├── tasks.py     # Celeryタスク
│   └── task_manager.py # タスク管理ロジック
├── tests/           # テスト
├── alembic/         # マイグレーション
├── main.py          # FastAPIアプリケーション
└── celery_app.py    # Celery設定
```

## ライセンス

MIT License