# Documentation Rules

## 1. 基本方針

- Issue は意思決定ログとして残す
- 現行仕様の正本は文書に置く
- 重要判断は Issue だけに閉じ込めない

## 2. 反映ルール

- 実装に影響する重要判断は、Issue で決まったあとに正本文書へ反映する
- 壊してはいけない条件は `docs/product/current-invariants.md` に追記する
- 採用済み判断の要約は `docs/product/adopted-decisions.md` に追記する

## 3. AI 利用ルール

- AI に改修を依頼するときは `current-invariants.md` を最優先で読む
- 仕様判断は `mvp-design.md` を基準にする
- Issue は補助資料として使う

## 4. 更新責務

- 実装で UX や振る舞いが変わったときは、コード変更と同時に文書更新を行う
- 文書更新が未実施の重要判断は、放置せず別 Issue か同一 PR で解消する
