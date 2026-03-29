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
