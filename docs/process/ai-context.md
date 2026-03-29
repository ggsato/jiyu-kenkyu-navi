# AI Context

この文書は、Codex / AI に改修を依頼するときの最小コンテキストを定義する。

## 1. 読む順番

1. `docs/product/current-invariants.md`
2. `docs/product/mvp-design.md`
3. `docs/philosophy/jiyu-kenkyu-navi.md`
4. 必要に応じて `docs/philosophy/what-is-jiyu-kenkyu.md`
5. 関連 Issue

## 2. 位置づけ

- `current-invariants.md`
  - 壊してはいけない条件
- `mvp-design.md`
  - 現行仕様の正本
- `philosophy/*`
  - なぜそう設計するかの背景
- Issue
  - 議論と履歴

## 3. AI に期待すること

- 正本と invariants を前提に変更する
- Issue の案を採用済み判断として扱う前に、正本文書への反映有無を確認する
- 重要判断が Issue にしかない場合は、実装だけで終わらせず文書反映を提案する

## 4. Codex への指示の置き場所

今後、Codex に継続的に守らせたい開発上の指示は、次の文書に置く。

- 読む順番と最小コンテキスト
  - `docs/process/ai-context.md`
- 文書更新と正本化の運用ルール
  - `docs/process/documentation-rules.md`
- 壊してはいけない仕様条件
  - `docs/product/current-invariants.md`

Issue のコメントだけに、継続的な Codex 指示を閉じ込めない。

## 5. Codex に渡す基本プロンプト

Codex / コーディングAI に改修を依頼するときは、少なくとも次の指示を含める。

### 基本形

```text
作業前に以下を読んでください。

1. docs/product/current-invariants.md
2. docs/product/mvp-design.md
3. docs/process/documentation-rules.md
4. 必要に応じて docs/philosophy/jiyu-kenkyu-navi.md

ルール:
- current-invariants.md を壊さない
- 現行仕様は mvp-design.md を正本として扱う
- Issue は補助資料として使い、正本の代わりにはしない
- 実装で UX / API / データ構造 / 運用ルールが変わる場合、コードだけでなく関連文書も更新する
- 重要判断が Issue にしかない場合は、文書への反映も提案または実施する
```

### 軽微な改修でも入れる短縮形

```text
docs/product/current-invariants.md と docs/product/mvp-design.md を前提に進めてください。
コード変更で仕様や UX が変わる場合は、関連文書も同時に更新してください。
```

## 6. 文書更新の期待値

コーディングAIは、文書運用ルールに従い、コードだけでなく文書も更新する前提で使う。

特に次の場合は、文書更新を同時に行う。

- 現行仕様が変わる
- 壊してはいけない条件が増える / 変わる
- Issue で採用した判断を正本へ昇格させる必要がある
- AI に渡す読む順番や運用ルールが変わる
