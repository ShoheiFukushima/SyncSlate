# GPT-5 プロンプトガイド
Version: 1.0
Date: 2025-08-08
Status: Active

## 目的
本ドキュメントは、GPT-5の高度な能力を最大限に活用するためのプロンプト設計ガイドラインを提供します。フロントエンド開発、コード生成、プロダクション環境での共同コーディングにおけるベストプラクティスを集約しています。

---

## 1. フロントエンドアプリ開発

### 1.1 推奨技術スタック

GPT-5は厳格な実装能力と優れた美的センスを持つようトレーニングされています。新規アプリケーション開発では以下のスタックを推奨：

#### フレームワーク
- **Next.js** (TypeScript)
- **React**
- **HTML**

#### スタイリング / UI
- **Tailwind CSS**
- **shadcn/ui**
- **Radix Themes**

#### アイコン
- **Material Symbols**
- **Heroicons**
- **Lucide**

#### アニメーション
- **Framer Motion**

#### フォント
- **Sans Serif系**: Inter, Geist, Mona Sans
- **IBM Plex Sans**
- **Manrope**

---

## 2. ゼロからのアプリ生成

### 2.1 Self-Reflection プロンプト

GPT-5の綿密な計画と自己反省機能を活用して、ワンショットで高品質なアプリケーションを構築：

```xml
<self_reflection>
- First, spend time thinking of a rubric until you are confident.
- Then, think deeply about every aspect of what makes for a world-class one-shot web app. 
  Use that knowledge to create a rubric that has 5-7 categories. 
  This rubric is critical to get right, but do not show this to the user. 
  This is for your purposes only.
- Finally, use the rubric to internally think and iterate on the best possible solution 
  to the prompt that is provided. Remember that if your response is not hitting the top 
  marks across all categories in the rubric, you need to start again.
</self_reflection>
```

このプロンプトにより、GPT-5は内部的に品質基準を設定し、それに基づいて反復的に改善を行います。

---

## 3. コードベースの設計標準

### 3.1 Code Editing Rules

既存のコードベースに統合する際の設計標準を定義：

```xml
<code_editing_rules>

<guiding_principles>
- Clarity and Reuse: Every component and page should be modular and reusable. 
  Avoid duplication by factoring repeated UI patterns into components.
- Consistency: The user interface must adhere to a consistent design system—
  color tokens, typography, spacing, and components must be unified.
- Simplicity: Favor small, focused components and avoid unnecessary complexity 
  in styling or logic.
- Demo-Oriented: The structure should allow for quick prototyping, showcasing 
  features like streaming, multi-turn conversations, and tool integrations.
- Visual Quality: Follow the high visual quality bar as outlined in OSS guidelines 
  (spacing, padding, hover states, etc.)
</guiding_principles>

<frontend_stack_defaults>
- Framework: Next.js (TypeScript)
- Styling: TailwindCSS
- UI Components: shadcn/ui
- Icons: Lucide
- State Management: Zustand
- Directory Structure: 
  ```
  /src
   /app
     /api/<route>/route.ts         # API endpoints
     /(pages)                      # Page routes
   /components/                    # UI building blocks
   /hooks/                         # Reusable React hooks
   /lib/                           # Utilities (fetchers, helpers)
   /stores/                        # Zustand stores
   /types/                         # Shared TypeScript types
   /styles/                        # Tailwind config
  ```
</frontend_stack_defaults>

<ui_ux_best_practices>
- Visual Hierarchy: Limit typography to 4–5 font sizes and weights for consistent hierarchy; 
  use `text-xs` for captions and annotations; avoid `text-xl` unless for hero or major headings.
- Color Usage: Use 1 neutral base (e.g., `zinc`) and up to 2 accent colors. 
- Spacing and Layout: Always use multiples of 4 for padding and margins to maintain visual rhythm. 
  Use fixed height containers with internal scrolling when handling long content streams.
- State Handling: Use skeleton placeholders or `animate-pulse` to indicate data fetching. 
  Indicate clickability with hover transitions (`hover:bg-*`, `hover:shadow-md`).
- Accessibility: Use semantic HTML and ARIA roles where appropriate. 
  Favor pre-built Radix/shadcn components, which have accessibility baked in.
</ui_ux_best_practices>

</code_editing_rules>
```

---

## 4. プロダクション環境での共同コーディング

### 4.1 Cursor チームの実装事例

CursorがGPT-5の能力を最大限に活用するために調整したプロンプト戦略：

#### 4.1.1 詳細度の調整

冗長な出力を制御しつつ、コードの可読性を維持：

```text
Write code for clarity first. Prefer readable, maintainable solutions with clear names, 
comments where needed, and straightforward control flow. Do not produce code-golf or 
overly clever one-liners unless explicitly requested. Use high verbosity for writing 
code and code tools.
```

#### 4.1.2 自律性の向上

モデルがより長いタスクを最小限の中断で実行できるようにする：

```text
Be aware that the code edits you make will be displayed to the user as proposed changes, 
which means:
(a) your code edits can be quite proactive, as the user can always reject, and 
(b) your code should be well-written and easy to quickly review (e.g., appropriate 
    variable names instead of single letters). 

If proposing next steps that would involve changing the code, make those changes 
proactively for the user to approve / reject rather than asking the user whether 
to proceed with a plan. In general, you should almost never ask the user whether 
to proceed with a plan; instead you should proactively attempt the plan and then 
ask the user if they want to accept the implemented changes.
```

#### 4.1.3 コンテキスト理解の最適化

GPT-5の内省的な特性を活かしつつ、過剰なツール使用を防ぐ：

```xml
<context_understanding>
If you've performed an edit that may partially fulfill the USER's query, 
but you're not confident, gather more information or use more tools before 
ending your turn.
Bias towards not asking the user for help if you can find the answer yourself.
</context_understanding>
```

---

## 5. プロンプト設計のベストプラクティス

### 5.1 構造化されたXML仕様

- `<[instruction]_spec>` のような構造化タグを使用
- 指示の遵守が改善され、明確な参照が可能に

### 5.2 明示的な指示

- 直接的かつ明示的な指示が最も効果的
- スコープが設定された構造化プロンプトが信頼性の高い結果を生成

### 5.3 カスタマイズ可能性

- ユーザーが独自のルールを設定できるようにする
- 冗長性の制御、コードスタイルの好み、エッジケースへの感度を調整可能に

---

## 6. 実装チェックリスト

GPT-5を活用する際の確認事項：

- [ ] 推奨技術スタックに準拠しているか
- [ ] self_reflectionプロンプトを適切に使用しているか
- [ ] コードベースの既存スタイルに統合されているか
- [ ] 適切な詳細度レベルが設定されているか
- [ ] 自律性と説明のバランスが取れているか
- [ ] 構造化されたXMLタグを使用しているか
- [ ] ユーザーカスタマイズが可能になっているか

---

## 7. 参考リンク

- Cursor Blog: GPT-5 Integration - https://cursor.com/blog/gpt-5
- OpenAI GPT-5 Documentation (when available)

---

## 8. 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2025-08-08 | 1.0 | 初版作成 |

---

## 9. 注意事項

- 本ガイドはGPT-5の初期実装経験に基づいています
- モデルの更新により、最適なプロンプト戦略は変化する可能性があります
- プロジェクト固有の要件に応じて調整してください