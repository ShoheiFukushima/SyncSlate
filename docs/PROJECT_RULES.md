# プロジェクト絶対ルール（PROJECT_RULES）

状態: Accepted
責任者: Maintainers
最終更新: 2025-08-07

本ドキュメントは、本プロジェクトの運用における「破ってはならない」絶対ルールを明文化します。CI とローカルフックで技術的に強制されます。

1. ルートパスの厳守
- プロジェクトの唯一のルートは次のディレクトリです:
  - /Users/fukushimashouhei/dev1/projects/AutoEditTATE
- このルート外（例: デスクトップ配下）にファイルを作成・移動・保持してはならない。

2. ドキュメント配置
- 全ての設計/仕様/ADR/運用ドキュメントはルート直下の docs/ に配置する。
- 一時ファイルやドラフトも原則 docs/ 配下（例: docs/drafts/）。

3. ADR の一意性
- docs/adr/ 配下の ADR はファイル名を一意に保つ（重複や「コピー」ファイル名は禁止）。
- ADR は Status/Context/Decision/Consequences を満たし、変更は PR で承認する。

4. 自動化とガードレール
- CI はルート外のパス変更を検出した場合、ジョブを失敗させる。
- ローカル pre-commit は同様のパス検証を行い、コミットを拒否する。

5. 例外
- 例外は原則認めない。やむを得ない場合は新規 ADR を起票し、期限付きで許可する。

6. 更新手順
- 本ルールの変更は PR + レビュワー2名承認を必須とし、CI ポリシーも同時更新する。

参考リンク
- docs/roadmap/implementation-plan.md
- docs/adr/ADR-001-architecture.md
- docs/adr/ADR-002-architecture-design.md
