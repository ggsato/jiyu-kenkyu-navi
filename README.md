# 自由研究ナビ MVP

`spec_v1.1.md` を唯一の仕様ソースとして実装した、自由研究ナビの MVP です。

## ドキュメントの正本

現在は、次の文書構造を正本として扱います。

- 思想
  - `docs/philosophy/what-is-jiyu-kenkyu.md`
  - `docs/philosophy/jiyu-kenkyu-navi.md`
- 現行仕様の正本
  - `docs/product/mvp-design.md`
- 採用済み判断
  - `docs/product/adopted-decisions.md`
- 壊してはいけないこと
  - `docs/product/current-invariants.md`
- AI に渡す最小コンテキスト
  - `docs/process/ai-context.md`
- Codex への今後の指示・運用ルール
  - `docs/process/documentation-rules.md`

個別 Issue は意思決定ログとして残しますが、現行仕様の正本の代わりにはしません。

## セットアップ

1. `.env.example` をコピーして `.env.local` を作成します。
2. PostgreSQL を Docker Compose で起動します。
3. Prisma migration を実行します。
4. seed を流します。
5. 開発サーバーを起動します。

```bash
cp .env.example .env.local
docker compose up -d
pnpm install
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm prisma:seed
pnpm dev
```

## Docker Compose による DB 起動方法

```bash
docker compose up -d
docker compose ps
```

PostgreSQL 16 を `localhost:5432` で起動します。

## `.env.example` の使い方

最低限、以下を設定してください。

```env
DATABASE_URL="postgresql://jiyu_user:jiyu_password@localhost:5432/jiyu_kenkyu_navi?schema=public"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.4-mini"
OPENAI_MODEL_QUESTION="gpt-5.4"
OPENAI_MODEL_RECORD_FIELDS="gpt-5.4"
OPENAI_MODEL_HOME="gpt-5.4-mini"
OPENAI_TIMEOUT_MS="60000"
DEV_USER_NAME="開発ユーザー"
UPLOAD_DIR="public/uploads"
EVENT_LOG_PATH="/tmp/jiyu-kenkyu-navi-events.log"
ALLOWED_DEV_ORIGINS="localhost,127.0.0.1"
```

- `OPENAI_API_KEY` を空にすると、AI 機能は固定フォールバック文で動きます
- PostgreSQL 接続情報は `.env.local` で管理してください
- 開発時のイベントログは既定で `/tmp/jiyu-kenkyu-navi-events.log` に出ます
- `localhost` 以外の端末やローカル IP で dev サーバーにアクセスするなら `ALLOWED_DEV_ORIGINS` にホスト名または IP を追加してください
- 例: `ALLOWED_DEV_ORIGINS="localhost,127.0.0.1,192.168.11.52"`
- `http://` や `:3000` を付けた値でも動くようにしていますが、ホスト名だけで書くのを基本にしてください
- 入力文字数は UI と API の両方で制限しています。超過時は画面と API レスポンスで分かるようにしています

## Prisma migration 実行方法

```bash
pnpm prisma:generate
pnpm prisma:migrate --name init
```

## seed 実行方法

```bash
pnpm prisma:seed
```

家族向けのサンプル Family と、その中の開発ユーザー `dev-user-fixed`, `family-user-a`, `family-user-b` を用意します。初期 Wish / Question / Record / Reflection は `dev-user-fixed` に投入します。

## 開発サーバー起動方法

```bash
pnpm dev
```

アプリ本体は Docker 化せず、ホストの Node.js で起動する前提です。

## OpenAI API キー設定方法

`.env.local` に `OPENAI_API_KEY` を設定してください。

```env
OPENAI_API_KEY="sk-..."
```

未設定時でも保存処理は止まらず、以下の固定文でフォールバックします。

- 問い候補生成失敗時: 「いまの願いから、まずは小さく記録できる問いを考えてみよう」
- 記録項目候補生成失敗時: 「まずは、いつ・何をしたか・どうだったか、の3つを残してみよう」
- ホーム要約生成失敗時: 「記録が少しずつたまっています。次も同じ見方で1件残してみよう」

## 画像アップロードの保存先

開発中の画像は `public/uploads` に保存します。

## 家族内の軽量ユーザー切り替え

初版認証は未実装です。家族単位の MVP 用として `Family / FamilyMember / User` を持ち、同じ家族の中のユーザーを画面上で切り替えて使います。ユーザー選択は cookie に保持します。

## 実装済み API

- `POST /api/ai/question-candidates`
- `POST /api/questions/generate`
- `POST /api/questions`
- `GET /api/questions/active`
- `GET /api/home`
- `GET /api/records`
- `POST /api/records`
- `PATCH /api/records/:id`
- `DELETE /api/records/:id`
- `POST /api/records/:id/attachments`
- `GET /api/reflections/today`
- `POST /api/reflections`
- `PUT /api/reflections/:id`
- `POST /api/ai/record-fields/suggest`
- `POST /api/ai/home-summary`
- `GET /api/health`
- `POST /api/logs`

## 今回未実装の範囲

- 本格認証
- 本番 AWS / S3 構成
- challenge UI / stretch UI
- 高度な分析画面
- 複雑なスコアリング
- 厳密な `next_step_accepted` のセッション起点分析
- 本番向けの画像ストレージ抽象化

## 開発時の文書運用

- 重要判断が Issue で決まったら、正本文書へ反映します
- AI に改修を依頼するときは `docs/product/current-invariants.md` を先に読みます
- Codex に何を先に読ませるかは `docs/process/ai-context.md` に書いています
- Codex を含む開発エージェントへの文書運用ルールは `docs/process/documentation-rules.md` に書いています
- コーディングAIは、コード変更だけでなく、必要な文書更新まで含めて行う前提です
- 運用ルールは `docs/process/documentation-rules.md` を参照してください
