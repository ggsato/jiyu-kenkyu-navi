# 自由研究ナビ MVP仕様 v1.1

作成日: 2026-03-28  
対象: 実装者 / Codex / 開発者レビュー用

---

## 1. この文書の目的

この文書は、自由研究ナビのMVPを実装開始できる粒度まで仕様を凍結するための実装用ドキュメントである。

本書に含めるものは次の4つである。

1. MVP仕様の確定事項
2. データモデルと Prisma schema
3. API一覧
4. Codex向け実装指示

この文書の目的は、議論を続けることではなく、実装の迷いを減らすことである。

---

## 2. プロダクトの核

自由研究ナビは、**願いを、今日の一歩に変えるための道具**である。

このアプリは答えを与えるものではない。利用者が、

- 願いを言葉にし
- 小さな問いを持ち
- 記録し
- 振り返り
- 次の一歩を決められる

ようにするための道具である。

MVPで最初に検証したいことは次の2点である。

1. 利用者の願いが、今日やれる一歩に変わるか
2. 使ったあとに、利用者が「次にこれを試してみよう」と言えるか

特に重要なのは、**問いが動かない時期、記録しかできない時期でも、ループが切れずに続くか**である。

---

## 3. MVPで固定する前提

### 3.1 技術前提

- 開発環境: ローカル Ubuntu サーバー
- 本番環境: AWS
- AIモデル: OpenAI GPT-5
- APIキー: サーバー環境変数 `OPENAI_API_KEY` から取得

### 3.2 アプリ構成

- フロントエンド: Next.js App Router
- API基盤: Next.js Route Handlers
- ORM: Prisma
- DB: PostgreSQL
- 開発用DB: Docker Compose で起動する PostgreSQL
- 開発用画像保存: ローカルディスク
- 本番画像保存: Amazon S3

### 3.3 MVP運用ルール

- 1ユーザーにつき Wish は複数可
- active な Question は常に 1本
- 振り返りは日次固定
- 1日の中で Record は複数件可
- Reflection は Question ごと・日ごとに 1件

### 3.4 初版の認証方針

MVP初版では本格認証は実装しない。

代わりに、固定開発ユーザーを seed で1件作成し、全APIはそのユーザー前提で動作する。
したがって、Wish の `user_id` などのユーザー紐づけは保持するが、初版ではログインUIやセッション管理は持たない。

本格認証は将来の拡張で導入する。

---

## 4. 初版スコープ

### 4.1 画面構成

初版は4画面に固定する。

1. ホーム
2. 問い作成
3. 記録一覧＋記録追加
4. 振り返り

### 4.2 作らないもの

初版では次は作らない。

- 独立した軌跡画面
- 高度な分析画面
- 厳密な因果推論
- 複雑なスコアリング
- 多キャラクターUI
- challengeモードの明示UI

軌跡はホームに要約表示する。

---

## 5. ユーザーフロー

### 5.1 初回起動

- active question が存在しない場合、問い作成画面へ誘導する

### 5.2 問い作成

入力:
- 何を願っているか
- なぜそう願うのか
- 今できていること
- まだできていないこと
- できるようになりたいこと

処理:
- AI が問い候補を最大3件返す
- ユーザーは1件選択する
- `purpose_focus` を選ぶ
- 保存後、ホームへ遷移する

### 5.3 問い作成APIの保存方針

初版では、問い作成画面で入力した願い情報をもとに、Wish の新規作成と Question の新規作成を同一APIで行う。

理由:
- 初回フローでは、願い入力と問い選択が一連の体験である
- MVPでは、Wish 作成API と Question 作成API を分離するとフロント実装が不必要に複雑になる
- 初版では「既存 Wish を選んで Question を追加する」運用は後回しにする

したがって、初版の `POST /api/questions` は以下をまとめて受ける。

- Wish 入力情報
- 選択した Question 文
- `purpose_focus`

サーバー側では、Wish を新規作成し、その Wish に紐づく active な Question を作成する。

### 5.4 ホーム

表示項目:
- 今の願い
- 今の問い
- 今の状態
- 最近の記録件数
- 最近の振り返り要約
- 次の一歩
- キャラクターの一言

### 5.5 記録一覧＋記録追加

- active question に紐づく記録一覧を表示
- 新規記録を追加
- その日の記録件数を表示
- 未振り返りであれば振り返り導線を表示

### 5.6 振り返り

入力:
- 今日わかったこと
- まだわからないこと
- 次にやりたいこと
- 前進感

保存後はホームへ戻る。

---

## 6. データモデル

### 6.1 Wish

- 利用者の願いを保持する
- テーマよりも動機に近い

### 6.2 Question

- Wish から切り出された、いま育てる小さな問い
- active は常に1本

### 6.3 Record

- 観察や試行の記録
- 構造化項目と自由記述を両方持つ
- 可変項目は JSONB で保持する

### 6.4 Reflection

- 日次の振り返り
- learned / unknown / next step / self progress を持つ
- `distance_delta` を内部値として持つ
- 日付は日時ではなく、1日を表す正規化済みの値として扱う

---

## 7. フィールド仕様

### 7.1 Wish

- `id`
- `user_id`
- `text`
- `reason`
- `current_state`
- `not_yet`
- `desired_state`
- `created_at`
- `updated_at`

### 7.2 Question

- `id`
- `wish_id`
- `text`
- `status` (`active` / `archived`)
- `purpose_focus` (`record` / `compare` / `relate` / `predict` / `cause` / `execute`)
- `mode_hint` (`stretch` / `challenge`) - 初版UIには出さない内部ヒント
- `created_at`
- `updated_at`

### 7.3 Record

- `id`
- `question_id`
- `recorded_at`
- `body`
- `memo`
- `kv_fields` (JSONB)
- `tags` (text array)
- `created_at`
- `updated_at`

### 7.4 RecordAttachment

- `id`
- `record_id`
- `storage_key`
- `mime_type`
- `file_size`
- `sort_order`
- `created_at`

### 7.5 Reflection

- `id`
- `question_id`
- `reflection_date` (`YYYY-MM-DD`)
- `learned`
- `unknown`
- `next_step_text`
- `self_progress_signal` (`forward` / `same` / `harder`)
- `distance_delta`
- `created_at`
- `updated_at`

---

## 8. 記録仕様

### 8.1 基本フィールド

- 日時
- 観測・実行の内容
- 自由記述メモ
- 添付画像

### 8.2 可変フィールド

可変項目は `kv_fields` に JSON で保存する。

例:

```json
{
  "result": "win",
  "opponent_character": "Mario",
  "difficult_scene": "ledge",
  "time_of_day": "night"
}
```

### 8.3 添付仕様

- 画像のみ
- 対応形式: `image/jpeg`, `image/png`, `image/webp`
- 1記録3件まで
- 1ファイル 10MB まで

---

## 9. 振り返り仕様

### 9.1 粒度

- 初版は日次固定

### 9.2 入力項目

- 今日わかったこと
- まだわからないこと
- 次にやりたいこと
- 前進感
  - `forward`: 前進した気がする
  - `same`: あまり変わらない
  - `harder`: むしろ難しくなった

### 9.3 Reflection の日付方針

振り返りは日次固定であるため、Reflection の日付は日時ではなく「1日を表す値」として扱う。

初版では、`reflection_date` は `YYYY-MM-DD` 形式の文字列、または DB 上で Date 相当の値として保存する。
少なくともアプリケーション層では、同じローカル日付の振り返りが重複しないよう正規化する。

例:
- `2026-03-28`

これにより、
- `2026-03-28T00:00:00+09:00`
- `2026-03-28T12:00:00+09:00`

のような時刻差による重複を防ぐ。

### 9.4 distance_delta ルール

`distance_delta` はユーザー入力ではなく、サーバーで決める。

- `forward` -> `30`
- `same` -> `10`
- `harder` -> `0`

### 9.5 distance_total の扱い

初版では `distance_total` は保存しない。必要なときに `SUM(distance_delta)` で集計する。

---

## 10. ホーム状態ロジック

### 10.1 基本方針

ホーム状態は**毎回都度計算**する。初版では `HomeStateCache` は持たない。

### 10.2 入力材料

- active question
- 直近5件の record
- 最新 reflection
- `SUM(distance_delta)`

### 10.3 state_label 判定

- 記録0件: `はじめの一歩`
- 記録1-2件: `記録をためる時期`
- 記録3件以上かつ reflection あり: `材料がそろってきた`
- `forward` が2回連続: `比較してみてもよさそう`

### 10.4 recent_records_summary

AIに渡す `recent_records_summary` は、active question の直近5件から以下を抽出したものとする。

- `recorded_at`
- `body`
- `memo`
- `kv_fields` の主要キー3件まで
- `tags`

### 10.5 次の一歩

記録しかできない時期は、継続型の一歩を優先する。

例:
- 次の3件は同じ観点で記録してみよう
- 次は相手キャラを必ず残そう
- 次は最初に苦しくなった場面だけ書いてみよう

---

## 11. キャラクター仕様

初版は1体のみとする。

役割:
- 続けていることを認める
- 今の状態をやさしく翻訳する
- 次の一歩を短く後押しする

表示場所:
- ホームのみ

---

## 12. AI I/O 契約

### 12.1 問い候補生成

入力:

```json
{
  "wish_text": "",
  "reason": "",
  "current_state": "",
  "not_yet": "",
  "desired_state": ""
}
```

出力:

```json
{
  "candidates": [
    {
      "text": "",
      "purpose_hint": "record|compare|relate",
      "why_this_question": ""
    }
  ]
}
```

ルール:
- 最大3件
- 一回で試せる問いにする
- 観察・記録可能であること
- 断定しない

### 12.2 記録項目候補生成

入力:

```json
{
  "question_text": "",
  "purpose_focus": "",
  "existing_kv_keys": []
}
```

出力:

```json
{
  "suggested_fields": [
    {
      "key": "",
      "label": "",
      "type": "text|number|boolean|select",
      "unit": null,
      "options": []
    }
  ]
}
```

### 12.3 ホーム要約生成

入力:

```json
{
  "wish_text": "",
  "question_text": "",
  "recent_records_summary": [],
  "latest_reflection": {
    "self_progress_signal": "",
    "learned": "",
    "unknown": "",
    "next_step_text": ""
  }
}
```

出力:

```json
{
  "state_label": "",
  "trajectory_summary": "",
  "next_step_summary": "",
  "character_message": ""
}
```

### 12.4 AI失敗時

- AI失敗時は固定文を返す
- 保存処理は止めない
- 再生成ボタンは許可する

固定文例:
- 問い候補生成失敗時: 「いまの願いから、まずは小さく記録できる問いを考えてみよう」
- 記録項目候補生成失敗時: 「まずは、いつ・何をしたか・どうだったか、の3つを残してみよう」
- ホーム要約失敗時: 「記録が少しずつたまっています。次も同じ見方で1件残してみよう」

---

## 13. Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum QuestionStatus {
  active
  archived
}

enum PurposeFocus {
  record
  compare
  relate
  predict
  cause
  execute
}

enum ModeHint {
  stretch
  challenge
}

enum SelfProgressSignal {
  forward
  same
  harder
}

model User {
  id        String   @id @default(cuid())
  name      String?
  wishes    Wish[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Wish {
  id           String    @id @default(cuid())
  userId       String
  text         String
  reason       String?
  currentState String?
  notYet       String?
  desiredState String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  questions Question[]

  @@index([userId, createdAt])
}

model Question {
  id           String         @id @default(cuid())
  wishId        String
  text          String
  status        QuestionStatus @default(active)
  purposeFocus  PurposeFocus
  modeHint      ModeHint      @default(stretch)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  wish        Wish         @relation(fields: [wishId], references: [id], onDelete: Cascade)
  records     Record[]
  reflections Reflection[]

  @@index([wishId, status, createdAt])
}

model Record {
  id         String   @id @default(cuid())
  questionId String
  recordedAt DateTime
  body       String
  memo       String?
  kvFields   Json     @default("{}")
  tags       String[] @default([])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  question    Question           @relation(fields: [questionId], references: [id], onDelete: Cascade)
  attachments RecordAttachment[]

  @@index([questionId, recordedAt])
}

model RecordAttachment {
  id         String   @id @default(cuid())
  recordId   String
  storageKey String
  mimeType   String
  fileSize   Int
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())

  record Record @relation(fields: [recordId], references: [id], onDelete: Cascade)

  @@index([recordId, sortOrder])
}

model Reflection {
  id                 String             @id @default(cuid())
  questionId         String
  reflectionDate     String             // YYYY-MM-DD
  learned            String?
  unknown            String?
  nextStepText       String?
  selfProgressSignal SelfProgressSignal
  distanceDelta      Int
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  question Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([questionId, reflectionDate])
  @@index([questionId, reflectionDate])
}
```

### 13.1 active Question の制約

初版では、1ユーザーにつき active な Question は常に1本とする。

この制約は schema の単純な定義だけでは完全には担保しにくいため、`POST /api/questions` の保存処理で以下をトランザクション実行する。

1. 固定開発ユーザーに紐づく既存 active Question を `archived` に更新する
2. 新しい Wish を作成する
3. 新しい Question を `active` で作成する

これにより、MVPではアプリケーション制御で active 1本ルールを保証する。

### 13.2 Reflection の一意性

Reflection の一意性は、`question_id` と `reflection_date` の組み合わせで担保する。

`reflection_date` は日単位に正規化された値であり、日次1件ルールを守る。
DateTime をそのまま一意制約に使わない。

---

## 14. API一覧

### 14.1 問い候補生成

#### POST `/api/questions/generate`
願い入力から問い候補を生成する。

request:
```json
{
  "wish_text": "もっと勝てるようになりたい",
  "reason": "相手を見て考えて勝てるようになりたいから",
  "current_state": "なんとなく操作している",
  "not_yet": "負ける場面が整理できていない",
  "desired_state": "苦手な場面を見つけて直せるようになりたい"
}
```

response:
```json
{
  "candidates": [
    {
      "text": "どんな相手のとき、どんな場面で苦しくなりやすいか？",
      "purpose_hint": "record",
      "why_this_question": "まず記録をそろえると、あとで比較しやすくなるから"
    }
  ]
}
```

### 14.2 問い保存

#### POST `/api/questions`
目的:
- 問い作成画面から、Wish 新規作成と Question 新規作成をまとめて行う

入力:
```json
{
  "wish_text": "もっと勝てるようになりたい",
  "reason": "相手を見て考えて勝てるようになりたいから",
  "current_state": "なんとなく操作している",
  "not_yet": "負ける場面が整理できていない",
  "desired_state": "苦手な場面を見つけて直せるようになりたい",
  "question_text": "どんな相手のとき、どんな場面で苦しくなりやすいか？",
  "purpose_focus": "record"
}
```

処理:
1. 固定開発ユーザーに紐づく既存の active Question を `archived` に更新する
2. Wish を新規作成する
3. 新しい Wish に紐づく Question を `status=active` で作成する

実装ルール:
- 上記 1〜3 は必ずトランザクションで実行する
- active な Question は常に1本となるようにする

返却:
- 作成された Wish
- 作成された Question

#### GET `/api/questions/active`
active question を取得する。

---

### 14.3 Record

#### GET `/api/records?questionId=...`
question に紐づく記録一覧を取得する。

#### POST `/api/records`
新規記録を作成する。

#### PATCH `/api/records/:id`
記録を更新する。

#### DELETE `/api/records/:id`
記録を削除する。

#### POST `/api/records/:id/attachments`
目的:
- Record に画像添付を追加する

入力形式:
- `multipart/form-data`

受け付けるもの:
- `file`
- `record_id`

制約:
- 画像のみ
- 1記録3件まで
- `jpg` / `png` / `webp`
- 1ファイル 10MB まで

初版では、事前署名URL方式や base64 受信は採用しない。
Next.js Route Handlers で `multipart/form-data` を受ける。

---

### 14.4 Reflection

#### GET `/api/reflections/today?questionId=...`
当日の振り返りを取得する。

#### POST `/api/reflections`
日次振り返りを作成または更新する。

request:
```json
{
  "question_id": "...",
  "reflection_date": "2026-03-28",
  "learned": "崖際で苦しくなりやすい",
  "unknown": "どの相手に特に弱いかはまだ不明",
  "next_step_text": "次は相手キャラを必ず記録する",
  "self_progress_signal": "forward"
}
```

サーバー側で `distance_delta` を決定する。
`reflection_date` は `YYYY-MM-DD` で受け取り、同じ question では同日1件に正規化する。

---

### 14.5 Home

#### GET `/api/home`
ホーム表示に必要な集約情報を返す。

response:
```json
{
  "wish_text": "相手を見て考えて勝てるようになりたい",
  "question_text": "どんな相手のとき、どんな場面で苦しくなりやすいか？",
  "state_label": "記録をためる時期",
  "record_count": 4,
  "trajectory_summary": "3日続けて記録している。比較に使える材料が少しずつ増えている。",
  "next_step_summary": "次の3件は、最初に苦しくなった場面だけそろえて残してみよう。",
  "character_message": "同じ見方で残せているのがいいね。あと少しで違いが見えてきそう。"
}
```

---

### 14.6 AI Support

#### POST `/api/ai/record-fields/suggest`
記録項目候補を提案する。

#### POST `/api/ai/home-summary`
ホーム用の要約文を生成する。

---

### 14.7 Health

#### GET `/api/health`
疎通確認用。

---

## 15. ログ計測

残すイベント:
- `wish_created`
- `question_candidates_generated`
- `question_selected`
- `record_created`
- `reflection_created`
- `next_step_shown`
- `next_step_clicked`
- `next_step_accepted`
- `attachment_uploaded`

### 15.1 next_step_accepted の定義

`next_step_accepted` は、**次の一歩表示後24時間以内に、その導線から記録追加が行われた**ことを意味する。

最小実装では、
- `next_step_shown`
- `next_step_clicked`
- `record_created`

の3イベントから計測する。

---

## 16. 実装順序

1. Next.js App Router の初期化
2. Prisma schema 作成
3. Docker Compose による PostgreSQL 起動
4. 固定開発ユーザーの seed 作成
5. `questions/generate` API 実装
6. `questions` 保存 API 実装
7. `records` CRUD 実装
8. `reflections` API 実装
9. `home` 集約 API 実装
10. 4画面 UI 実装
11. 画像アップロード実装
12. ログ計測実装
13. AI失敗時フォールバック実装

---

## 17. Codex実装指示

以下を Codex への実装指示として使う。

### 実装指示本文

```text
自由研究ナビ MVP を Next.js App Router + Route Handlers + Prisma + PostgreSQL で実装してください。

要件:
- 画面は 4つ: ホーム、問い作成、記録一覧+記録追加、振り返り
- active question は常に 1本
- Wish は複数可
- Reflection は question ごとに日次 1件
- 初版認証は固定開発ユーザー1件を seed し、全APIはそのユーザー前提で動かす
- 問い作成時は Wish 新規作成 + Question 新規作成を `POST /api/questions` でまとめて行う
- `POST /api/questions` は既存 active Question の archive と新規 Question 作成をトランザクションで行う
- Record の可変項目は JSONB (`kv_fields`) で保存
- 添付は画像のみ、1記録3件まで、1ファイル10MBまで
- `POST /api/records/:id/attachments` は multipart/form-data で受ける
- ホーム状態は毎回都度計算し、キャッシュは使わない
- distance_total は保存しない。Reflection.distance_delta の合計で扱う
- Reflection の `reflection_date` は `YYYY-MM-DD` の日付文字列として扱い、同日重複を防ぐ
- AI失敗時は固定文を返し、保存処理は止めない

やること:
1. Prisma schema を実装する
2. API route を実装する
3. 最低限の UI を実装する
4. OpenAI 呼び出しラッパを作る
5. ログ計測の雛形を作る

API:
- POST /api/questions/generate
- POST /api/questions
- GET /api/questions/active
- GET /api/records
- POST /api/records
- PATCH /api/records/:id
- DELETE /api/records/:id
- POST /api/records/:id/attachments
- GET /api/reflections/today
- POST /api/reflections
- GET /api/home
- POST /api/ai/record-fields/suggest
- POST /api/ai/home-summary
- GET /api/health

UI方針:
- 子ども向けにやさしい言葉
- 複雑なグラフ不要
- ホームを最重要画面にする
- 継続型の次の一歩を優先して見せる

出力形式:
- まずディレクトリ構成を示す
- 次に Prisma schema
- 次に API 実装
- 次に UI 実装
- 最後に .env.example と README を示す
```

---

## 18. 非機能要件メモ

- DB は PostgreSQL を前提にする
- 開発DBは Docker Compose で起動する
- 本番画像は S3 に保存する
- APIキーは環境変数で扱う
- 本番運用ではバックアップ前提で構成する
- 個人記録が重要なので、削除や上書きの扱いはログを残しやすい設計に寄せる

---

## 19. この v1.1 の結論

自由研究ナビのMVPは、単に問いを作るアプリではない。

MVPの本質は、

- 願いを今日の一歩に変えること
- 記録しかできない時期を前進として支えること
- 新しい問いが出ない時でも「次はこれをやろう」と言えること
- 積み上がる記録が、長期的にも比較可能な形で残ること

にある。

したがって初版は、

- 問い生成
- 記録一覧＋追加
- 拡張可能な記録構造
- 日次振り返り
- ホームでの前進の意味づけ
- 継続型の次の一歩提案

に集中する。

最初に作るべきなのは、**「まだ分かっていないけど、今やることは分かる」と思える体験**である。

## v1.1実装のUX課題一覧
### ホーム
全体的には良いが、文字だらけなので、キャラクターを追加したい。どうしたらよいか？
### 問い作成
このページは以下の３つのフローになっているが、順序と表示が整合性が取れておらず、見にくい。
1. 今の願いを続けるか、別の願いを始めるか選ぶ(A)
2. 願いの詳細を入力して、小さな問の候補を出す(B)
3. 候補を選ぶ(C)
4. 候補の目的を選ぶ(C)
5. この問を始めるボタンを押す(C)

A, B, Cは表示部品を表すが、Aが上、BとCは下で、Bが左、Cが右にある。Cの中の表示順は、選択された問いが一番上、4が次、3、そして5と続く。Bの下にCがあり、Cの中には、選択した問いが表示で分れば、わざわざ文字で別に表示する必要はない。また、３つの選択肢は、３つの目的を任意に選べるものではないように思う。選択肢を提示する時点で、その目的はどう考えて提示されているのか、AIに選択させるべきではないか？それであれば、選択肢に目的も含めて、選ぶだけにできる。
### 記録
記録を追加のセクションで、メモが１番上にあるが、オプショナルなので一番下にしたい。また、問に合わせた項目がわかりにくいことがあるので、対応する小さな問に対して、事例または説明があると良い。

また、ファイル添付は記録一覧でできるようになっているが、ボタンがわかりにくく、英語表記になっている。一覧ではなく、記録するときに、メモの下にでも「画像を追加」のほうが見やすいし、使いやすい。

### 振り返り

画面は入力メインでわかりやすい。同じ願いで次の問に進む場合、「できること」に「今日わかったこと」、「できないこと」に「まだわからないこと」、「次にやりたいこと」に「できるようになりたいこと」が自動入力されるが、対応関係を明記してはどうか？例えば、入力時に、前の入力を表示しておき、比較できるようにするなど。
