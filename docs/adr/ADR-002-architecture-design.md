# ADR-002: システム全体アーキテクチャ設計書

Status: Accepted  
Date: 2025-08-07  
Authors: Architecture Team  
Supersedes: N/A  
Superseded by: N/A  
Related: [docs/adr/ADR-001-architecture.md](docs/adr/ADR-001-architecture.md)

---

## 1. 目的・背景
- 本ドキュメントは当システムのエンドツーエンドのアーキテクチャを詳細に定義し、利害関係者間での共通理解、変更管理 (ADR 運用)、品質向上、運用容易性を実現することを目的とする。
- 設計の根拠は C4 モデル、12-Factor App、CNCF ベストプラクティス、OWASP ASVS、NIST CSF、SRE 原則、ISO 25010 を参照する。
- 本設計は将来の機能拡張とチーム規模拡大を見据え、段階的モジュール化から必要に応じたサービス分割へ進化可能な形を採る。

## 2. スコープと非スコープ
- スコープ
  - システムコンテキスト、コンテナ構成、主要コンポーネント、ドメインモデル、データモデル
  - API 契約とバージョニング、エラーハンドリング、セキュリティ、可観測性、デプロイ/IaC
  - i18n/l10n、レジリエンス、コスト、運用 Runbook、品質保証戦略
- 非スコープ
  - サードパーティ製品内部実装、特定クラウドの詳細サービス仕様
  - プロジェクト毎の細粒度 UI デザインと文言

## 3. 利害関係者とユースケース
- 利害関係者
  - エンドユーザー、管理者、サポート、PdM/PO、開発、QA、SRE/Ops、セキュリティ、法務/コンプライアンス、経営
- 代表ユースケース
  - ユーザー登録/認証/権限付与、コンテンツ作成・検索・更新・公開、バッチ取込/同期
  - 監査証跡/レポート、言語切替、失敗時の再実行、エクスポート/アーカイブ

## 4. 要求 (機能/非機能)
- 機能要求
  - CRUD、全文検索、バージョニング、ロール/権限、監査ログ、通知、バッチ処理
- 非機能要求
  - 可用性: 99.9%+ (月間)
  - レイテンシ: P95 Read < 300ms, Write < 800ms (API Gateway 観測点)
  - スループット: 平均 500 RPS, ピーク 1500 RPS (水平スケール)
  - 耐障害性: RTO ≤ 30分, RPO ≤ 5分
  - セキュリティ: ASVS L2 相当、PII の at-rest/in-transit 暗号化
  - 変更容易性: デプロイ LT < 1日、ロールバック 15分以内
  - 観測可能性: 主要 SLI (latency/availability/error rate) を可視化

## 5. アーキテクチャ上の制約
- クラウド: AWS
- 実行基盤: Kubernetes (EKS)
- データストア: RDS (PostgreSQL), ElastiCache (Redis), S3, OpenSearch
- 非同期: SQS/Kafka 相当 (初期は SQS)
- 言語/ランタイム: TypeScript/Node.js (BFF, 一部サービス), Go (高スループット/ワーカー)
- フロントエンド: Next.js (App Router), next-intl
- IaC: Terraform + Terragrunt (モジュール化)
- CI/CD: GitHub Actions
- 監視/可観測性: OpenTelemetry, Prometheus, Grafana, CloudWatch
- セキュリティ: AWS KMS, Secrets Manager, WAF, Cognito or OIDC IdP

## 6. アーキテクチャ原則
- Domain-Driven Design と Clean Architecture
- API First と Backward Compatibility First
- Security/Observability by Default
- Infrastructure as Code と Immutable Infrastructure
- Small, Cohesive, Loosely Coupled; Evolutionary Architecture
- 依存方向を内向きに、境界の明確化、データ所有の一意性

## 7. コンテキスト図 (C4: System Context)
- 外部システム/境界
  - IdP (OIDC): 認証/シングルサインオン
  - 決済/課金: 契約/請求
  - 通知 (メール/SMS): 通知配信
  - 管理コンソール: 運用者 UI
  - 外部データ供給者: バルク/差分取り込み
- ユーザー (Web/モバイル) は Edge (CDN/WAF) を介して BFF/API にアクセス

## 8. システム分割 (C4: Container)
- Client (Next.js Web)
- Edge: CloudFront (CDN), AWS WAF
- API Gateway / BFF (Node.js):
  - GraphQL/REST 統合、認可、集約、キャッシュ制御
- Backend Services (初期はモジュラーモノリス → 将来分割)
  - User Service (AuthN/Z 補助, Profile, RBAC)
  - Content Service (CRUD/Versioning/Audit)
  - Search Service (OpenSearch 同期/検索 API)
  - Batch/Worker (非同期処理、DLQ 含む)
- Data Stores
  - PostgreSQL (RDS), Redis (ElastiCache), S3, OpenSearch
- Async
  - SQS (標準/遅延)、Outbox パターンでイベント発行
- Observability/CI/CD/Secrets
  - OTel Collector, Prometheus/Grafana, GitHub Actions, KMS/Secrets Manager

## 9. コンポーネント設計 (C4: Component)
- BFF/API
  - 認証トークン検証 (JWKs キャッシュ), RBAC/ABAC, Rate Limiting
  - GraphQL スキーマ/Resolver または REST Controller
  - Cross-cutting: Correlation-ID, Request Logging, Input Validation
- User Component
  - User, Role, Permission 管理、ポリシー評価
- Content Component
  - Content, ContentVersion, Draft/Publish ワークフロー、監査イベント発行
- Search Component
  - インデクサ (Outbox → Ingest)、検索 API、ハイライト、フィルタ
- Batch/Worker
  - バルク取込、再試行、バックフィル、スケジュール実行
- Common
  - Outbox, Idempotency, Error Taxonomy, Retry/Circuit, Config/Feature Flag

## 10. ドメインモデル (Bounded Context & Aggregates)
- Bounded Context
  - Identity: User, Role, Permission, Policy
  - Content: Content, ContentVersion, PublicationState, AuditEvent
  - Search: SearchDocument, IndexTask
- Aggregates と不変条件
  - User: roles の整合性、status
  - Content: version の単調増加、状態遷移 (Draft → Review → Published)
  - AuditEvent: who/what/when/where 不変

## 11. データモデルとスキーマ設計 (RDB/Index)
- RDB (PostgreSQL)
  - users(id pk, email unique, status, created_at, updated_at)
  - roles(id pk, name unique)
  - user_roles(user_id fk, role_id fk, pk(user_id, role_id))
  - contents(id pk, owner_id fk, current_version_id fk, state, created_at, updated_at)
  - content_versions(id pk, content_id fk, version int, title, body, locale, created_at)
  - audit_events(id pk, actor_id, action, entity_type, entity_id, at, meta jsonb)
  - 主要インデックス: users(email), content_versions(content_id, version desc), audit_events(entity_type, entity_id, at)
- OpenSearch
  - index: contents_{env}; doc: denormalized {id, latest fields, facets, locales}
  - リフレッシュ戦略: near-real-time、書き込みバースト時は一時停止とバルク
- Redis
  - 認可キャッシュ、セッション、短命ドキュメント、分散ロック
- S3
  - 大容量アセット、エクスポート、アーカイブ

## 12. API 設計 (REST / GraphQL)
- バージョニング
  - REST: /v1/... (URI versioning), Deprecation ヘッダ
  - GraphQL: スキーマの後方互換ポリシー (フィールド追加は許可、削除は段階的)
- 契約
  - OpenAPI 3.1 / GraphQL SDL を単一ソースとし契約テスト (Pact/Dredd)
- 例 (REST)
  - GET /v1/contents?query=...&locale=ja
  - POST /v1/contents
  - GET /v1/users/{id}
- 例 (GraphQL)
  - Query: content(id), searchContents(query, locale)
  - Mutation: createContent(input), publishContent(id)
- 認証/認可
  - OIDC Bearer JWT, scope/role ベース, リソースレベル ABAC

## 13. ランタイム・シーケンスとフロー
- 認証フロー
  1) Client → IdP (PKCE) → Token 取得
  2) Client → BFF/API (Authorization: Bearer)
  3) BFF → JWKs 検証 (キャッシュ), RBAC/ABAC 判定
- CRUD/検索
  1) BFF → Content Service → DB 書込 → Outbox にイベント
  2) Worker → Outbox 取得 → OpenSearch にバルク投入
  3) Client → Search API → OpenSearch クエリ
- リトライ/タイムアウト/サーキットブレーカ
  - 外向き呼び出し: timeout 2-3s, retry with jitter (max 3), circuit 半開 30s

## 14. エラーハンドリングと回復
- エラー分類
  - 4xx: Validation/Unauthorized/Forbidden/NotFound/Conflict
  - 5xx: Upstream/DB/Timeout/Unknown
  - ビジネスエラー: ドメインルール違反
- パターン
  - Idempotency-Key (POST 冪等化), Outbox, Dead Letter Queue (DLQ)
  - Poison Message 隔離、指数バックオフ、手動再実行フロー
- エラーレスポンス
  - problem+json 準拠: type, title, status, detail, traceId

## 15. セキュリティアーキテクチャ
- AuthN/Z
  - OIDC + OAuth 2.1、JWKs キャッシュ更新、aud/iss/exp 検証
  - RBAC + ABAC (ownership, locale, tenant)
- データ保護
  - KMS による at-rest 暗号、TLS1.2+、PII フィールドレベル暗号化 (必要箇所)
- アプリ防御
  - 入力検証、出力エスケープ、CSP、CSRF 対策 (状況に応じて)
  - WAF ルール、レートリミット、Bot 対策、IP allowlist (管理系)
- シークレット管理
  - Secrets Manager + IAM ロール、短命クレデンシャル
- 監査
  - 重要操作の監査ログ、不可逆保存 (WORM バケット)

## 16. パフォーマンス・スケーラビリティ
- 水平スケール: HPA (CPU/メモリ/カスタムメトリクス)
- 接続プール/キューバックプレッシャー、バルク API、N+1 回避 (DataLoader)
- 事前計算/マテビュー、非同期化、ハッシュパーティショニング

## 17. キャッシュ戦略
- レイヤ
  - ブラウザ: Cache-Control, ETag, Stale-While-Revalidate
  - CDN: Edge キャッシュ (public 可), 変動コンテンツは短 TTL
  - BFF/Service: Redis read-through/write-through、局所性あるキー設計
- 失効/整合性
  - 書込時のキー無効化、イベント駆動の再構築、二相無効化

## 18. 可観測性 (Observability)
- テレメトリ
  - OpenTelemetry: Trace/Metric/Log を関連付け、Correlation-ID 伝搬
  - Sampling: トラフィックに応じて Tail-based 併用
- ダッシュボードと SLO
  - RED/USE 指標、重要エンドポイントの P95/P99、エラーバジェット
- アラート
  - ノイズ最小化、複合条件、オンコール体制、エスカレーション

## 19. デプロイメント (Environments, CI/CD, IaC)
- 環境
  - dev, stg, prod (+ sandbox)
- IaC
  - Terraform modules、差分は tfvars/Terragrunt、State 保護、PR Plan 必須
- CI/CD
  - Pipeline: build → unit/contract → SAST/DAST → image scan → deploy → smoke → canary → promote
  - 署名付きコンテナ、SBOM 生成、OPA (Conftest) による policy check

## 20. リリース戦略・ロールバック・Feature Flags
- Blue/Green, Canary リリース
- ロールバック: DB マイグレーションは expand → migrate → contract で前方互換維持
- Feature Flags: 段階的公開、トグルの技術的負債管理

## 21. 国際化/多言語対応 (i18n, l10n)
- next-intl によりサーバ/クライアント辞書分割、ICU メッセージ
- 言語検出: Accept-Language + ルーティング、ユーザー設定優先
- 日付/数値/通貨/タイムゾーンローカライズ、フォールバック言語

## 22. アクセシビリティと UX 原則
- WCAG 2.2 AA 目標
- キーボード操作、コントラスト、ARIA、フォーカス管理、エラーメッセージの明確化
- コンテンツ構造の見出し階層、ライブリージョンの節度

## 23. レジリエンス・DR・バックアップ
- マルチ AZ、重要データの PITR、有効なバックアップ検証
- フェイルオーバー Runbook、DR 訓練、RTO/RPO の定期検証
- バルクヘッド隔離、タイムアウト/リトライ標準化

## 24. コンフィグ管理・Secrets 管理
- 12-Factor 準拠、型付きコンフィグスキーマ (Zod/TypeBox)
- バージョン管理、変更監査、ローテーション、最小権限 IAM

## 25. コスト最適化
- オートスケール、Reserved/Spot、Savings Plans
- ストレージ階層化 (S3 IA/Glacier)、OpenSearch ノード階層
- コスト配賦タグ、FinOps ダッシュボード、異常検知

## 26. ガバナンス・ADR 運用
- ADR テンプレ、承認フロー、期限付き再評価 (Sunset)
- セキュリティレビュー、アーキテクチャ審査会、依存ライブラリの脆弱性管理

## 27. リスクと対応策
- 依存先障害 → フォールバック/キャッシュ/バルクヘッド
- スキーマドリフト → Contract Test、マイグレーションガイドライン
- レートリミット → エクスポネンシャルバックオフ、トークンバケット
- ベンダーロックイン → 抽象化層、移行計画、データエクスポート

## 28. 移行計画 (システム/データ/API)
- データスキーマ: expand → dual write/read → backfill → contract
- API: 新旧併存、Deprecation ヘッダ、期限を明示
- ロールアウト: Canary → cohort 拡大 → 全体切替、監視に基づくゲーティング

## 29. 品質保証戦略 (テスト)
- ピラミッド: Unit > Contract > Integration > E2E
- カバレッジ目標: statement 80%+, critical paths 90%+
- テストデータ管理、seed、deterministic テスト、flaky 対策
- Chaos/負荷/耐久/セキュリティスキャンのパイプライン統合

## 30. 運用 Runbook・SLO/SLA
- インシデント対応: 検知 → トリアージ → コミュニケーション → RCA → CAPA
- 代表 SLO: p95 latency, availability, error rate、エラーバジェット方針
- 手順書: ローテーション、メンテナンス、秘密情報更新、証明書更新

## 31. 変更容易性・拡張戦略
- 境界コンテキストごとのモジュール境界維持、依存方向 (外→内禁止)
- Event-driven 拡張、プラガブル SPI、Feature Flag による安全な導入
- 将来のサービス分割基準: チーム認知負荷/変更頻度/データ所有/運用境界

## 32. アンチパターンとトレードオフ
- 早すぎるマイクロサービス化、過剰同期通信、過度な一般化
- 一貫性 vs 可用性、強整合 vs 最終整合、性能 vs コスト、厳格性 vs 機敏性
- 本設計は初期はモジュラーモノリスで複雑性を抑え、トラフィック/チーム規模の増大に応じて抽出

## 33. 参考リンク・付録
- 標準/基準: 12-Factor, DDD, OWASP ASVS, OTel, SRE Book, ISO 25010
- ADR/図版/スキーマ: [docs/adr/ADR-001-architecture.md](docs/adr/ADR-001-architecture.md), OpenAPI/GraphQL SDL, ER 図, C4 図
- サンプルスキーマ (概略)
  - OpenAPI: /v1/contents GET/POST, /v1/users GET
  - GraphQL: type Content { id, title, body, locale, version, state }

---

# 付録 A: 設計チェックリスト (実装前/リリース前)

- API 契約
  - [ ] OpenAPI/SDL 更新、後方互換チェック
  - [ ] 入出力スキーマの validation 実装
- セキュリティ
  - [ ] JWKs キャッシュ/検証、スコープ/ロール/ABAC
  - [ ] Secrets/IAM/暗号化設定、CSP/WAF/RateLimit
- データ
  - [ ] マイグレーション expand → migrate → contract
  - [ ] インデックス/クエリ計画/バキューム方針
- 可観測性
  - [ ] Trace/Log/Metric 埋め込み、ダッシュボード/アラート
  - [ ] Correlation-ID, エラー分類&problem+json
- パフォーマンス/キャッシュ
  - [ ] HPA/リソース要求、プール設定
  - [ ] CDN/BFF/Redis キャッシュ設計と失効
- デプロイ/運用
  - [ ] IaC Plan/Apply、イメージ署名、SBOM
  - [ ] Canary/ロールバック手順、Runbook 整備

---

# 付録 B: 推奨デフォルト設定値

- HTTP
  - server timeout: 60s, idle: 30s, read/write: 15s
  - outbound timeout: 3s, retry: 3 (jitter), circuit: failureRate > 50% over 30s
- DB
  - connection pool: max 20-50/Pod, statement timeout: 2s, idle: 30s
- Cache
  - Redis TTL: 60-300s、権限は短 TTL
- Queue
  - visibility timeout = max processing time x 2, DLQ after 5 attempts

---

# 付録 C: ディレクトリ/パッケージ構成例 (モジュラーモノリス)

- backend/
  - app/ (BFF/API)
  - modules/
    - identity/
    - content/
    - search/
    - common/ (outbox, idempotency, errors, config)
  - internal/platform/ (http, db, cache, otel)
- infra/
  - terraform/
  - k8s/

---

# 追記/変更手順
- 変更は ADR 提案として PR 化し、本ファイルの該当章へ反映
- メジャー変更時はバージョンと移行計画を明示
