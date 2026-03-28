import OpenAI from "openai";
import {
  HOME_SUMMARY_FALLBACK,
  QUESTION_CANDIDATE_FALLBACK,
  RECORD_FIELD_FALLBACK,
} from "@/lib/constants";
import { normalizePurposeFocus } from "@/lib/purpose-focus";
import { suggestedFieldSchema } from "@/lib/validation";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const AI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || "60000");
const questionModel = process.env.OPENAI_MODEL_QUESTION || process.env.OPENAI_MODEL || "gpt-5.1";
const recordFieldsModel = process.env.OPENAI_MODEL_RECORD_FIELDS || process.env.OPENAI_MODEL || "gpt-5.1";
const homeModel = process.env.OPENAI_MODEL_HOME || process.env.OPENAI_MODEL || "gpt-5.1";

function parseJsonText<T>(text: string): T {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    const withoutFence = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(withoutFence) as T;
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    return JSON.parse(trimmed.slice(objectStart, objectEnd + 1)) as T;
  }

  return JSON.parse(trimmed) as T;
}

async function createJson<T>(model: string, instructions: string, input: unknown, fallback: T): Promise<T> {
  if (!client) {
    return fallback;
  }

  try {
    const response = await Promise.race([
      client.responses.create({
        model,
        input: [
          {
            role: "system",
            content: instructions,
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
        text: { format: { type: "text" } },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("OPENAI_TIMEOUT")), AI_TIMEOUT_MS);
      }),
    ]);

    const text = response.output_text;

    if (!text) {
      return fallback;
    }

    return parseJsonText<T>(text);
  } catch (error) {
    console.error("openai_error", error);
    return fallback;
  }
}

export async function generateQuestionCandidates(input: Record<string, unknown>) {
  const result = await createJson(
    questionModel,
    [
      "あなたは子どもの自由研究を支える編集者です。",
      "次の入力から、観察・記録可能で、一回で試せる問い候補を最大3件作ってください。",
      "断定せず、短く、子どもにも読みやすい日本語にしてください。",
      "",
      "必ず次の JSON だけを返してください。",
      "{",
      '  "candidates": [',
      "    {",
      '      "text": "問い文",',
      '      "purpose_hint": "compare|relate|predict",',
      '      "why_this_question": "この問いがよい理由"',
      "    }",
      "  ]",
      "}",
      "",
      "ルール:",
      "- 最大3件",
      "- text は40文字以内",
      "- why_this_question は50文字以内",
      "- 各要素に text, purpose_hint, why_this_question を必ず含める",
      "- purpose_hint は compare, relate, predict のいずれかにする",
      "- ただ残すための問いではなく、くらべる・つなげる・たしかめるのどれかが見える問いにする",
      "- JSON 以外の説明文は書かない",
      "- Markdown のコードフェンスは使わない",
    ].join("\n"),
    input,
    {
      candidates: [
        {
          text: QUESTION_CANDIDATE_FALLBACK,
          purpose_hint: "compare",
          why_this_question: "まずは小さく記録を始めるため",
        },
      ],
    },
  );

  const maybeQuestions = (result as unknown as { questions?: string[] }).questions;

  if (Array.isArray(maybeQuestions)) {
    return {
      candidates: maybeQuestions.slice(0, 3).map((text) => ({
        text,
        purpose_hint: "compare",
        why_this_question: "まずは小さく記録を始めるため",
      })),
    };
  }

  return {
    candidates: result.candidates.map((candidate) => ({
      ...candidate,
      purpose_hint: normalizePurposeFocus(candidate.purpose_hint),
    })),
  };
}

export async function generateRecordFieldSuggestions(input: Record<string, unknown>) {
  const normalizedPurposeFocus = normalizePurposeFocus(String(input.purpose_focus || "compare"));
  const result = await createJson(
    recordFieldsModel,
    [
      "あなたは記録フォーム設計者です。",
      "次の入力から、扱いやすい記録項目候補を最大3件作ってください。",
      "特定の題材に寄せすぎず、どんな自由研究テーマでも使える考え方で作ってください。",
      "ただし question_text と wish_text に書かれていない具体物を勝手に足してはいけません。",
      "項目と選択肢は、入力された問いと願いの文脈に直接対応している必要があります。",
      "問いに答えるために本当に必要な観測値だけを出してください。",
      "あとで比べたり数えたりしやすいように、自由入力より select と boolean を優先してください。",
      "text は本当に自由記述が必要なときだけ使ってください。",
      "select を使うときは options を必ず 2件以上入れてください。",
      "",
      `この問いの目的は ${normalizedPurposeFocus} です。`,
      normalizedPurposeFocus === "compare"
        ? "違いが見えるように、条件や結果をそろえて比べられる項目を優先してください。"
        : normalizedPurposeFocus === "relate"
          ? "何と何がいっしょに起きるかが見えるように、状況と結果をつなげられる項目を優先してください。"
          : "予想と実際を見比べられるように、見立てを確かめるための項目を優先してください。",
      "",
      "",
      "必ず次の JSON だけを返してください。",
      "{",
      '  "suggested_fields": [',
      "    {",
      '      "key": "field_key",',
      '      "label": "表示名",',
      '      "type": "text|number|boolean|select",',
      '      "unit": null,',
      '      "options": []',
      "    }",
      "  ]",
      "}",
      "",
      "ルール:",
      "- 最大3件",
      "- key は英数字と underscore を使う",
      "- label は12文字以内の短い日本語にする",
      "- 入力にない具体物や題材を勝手に作らない",
      "- 項目と選択肢は question_text と wish_text の語に沿わせる",
      "- まず select を検討し、次に boolean を検討する",
      "- text は最後の手段にする",
      "- できるだけ後で集計しやすい軸にする",
      "- 主観ではなく、目で見たり数えたり選んだりできる独立した観測値にする",
      "- 抽象語や体感語ではなく、何を見れば答えられるかがすぐ分かる項目にする",
      "- 良い悪い、高い低い、うまくいった、命中率のような評価項目は出さない",
      "- 項目同士は独立した観測値にする",
      "- ある項目から計算で分かる派生項目は出さない",
      "- 回数を出すなら、回数帯や全成功のような派生項目は出さない",
      "- 割合や成功率を知りたい問いでは、割合そのものではなく、分子と分母になる独立した観測値を出す",
      "- yes/no の評価ではなく、あとで計算や比較に使える元の観測値を優先する",
      "- options の各項目は12文字以内にする",
      "- JSON 以外の説明文は書かない",
      "- Markdown のコードフェンスは使わない",
    ].join("\n"),
    input,
    {
      suggested_fields: [
        { key: "result", label: "どうだった", type: "select", unit: null, options: ["できた", "もう少し", "むずかしい"] },
        { key: "target", label: "何を見た", type: "select", unit: null, options: ["相手", "場面", "動き"] },
        { key: "noticed", label: "気づきがあった", type: "boolean", unit: null, options: [] },
      ],
      fallback_message: RECORD_FIELD_FALLBACK,
    },
  );

  const suggestedFields = Array.isArray((result as { suggested_fields?: unknown[] }).suggested_fields)
    ? (result as { suggested_fields: unknown[] }).suggested_fields
        .map((field) => suggestedFieldSchema.safeParse(field))
        .filter((field) => field.success)
        .map((field) => field.data)
        .slice(0, 3)
    : [];

  if (suggestedFields.length > 0) {
    return { suggested_fields: suggestedFields };
  }

  return {
    suggested_fields: [
      { key: "result", label: "どうだった", type: "select", unit: null, options: ["できた", "もう少し", "むずかしい"] },
      { key: "target", label: "何を見た", type: "select", unit: null, options: ["相手", "場面", "動き"] },
      { key: "noticed", label: "気づきがあった", type: "boolean", unit: null, options: [] },
    ],
    fallback_message: RECORD_FIELD_FALLBACK,
  };
}

export async function generateHomeSummary(input: Record<string, unknown>) {
  return createJson(
    homeModel,
    [
      "あなたはやさしい伴走者です。",
      "ホーム画面用の短い文を作ってください。",
      "",
      "必ず次の JSON だけを返してください。",
      "{",
      '  "state_label": "状態ラベル",',
      '  "trajectory_summary": "ここまでの流れの要約",',
      '  "next_step_summary": "次の一歩",',
      '  "character_message": "キャラクターのひとこと"',
      "}",
      "",
      "ルール:",
      "- state_label は18文字以内",
      "- trajectory_summary は70文字以内",
      "- next_step_summary は70文字以内",
      "- character_message は50文字以内",
      "- 全て短い日本語にする",
      "- 子ども向けにやさしくする",
      "- JSON 以外の説明文は書かない",
      "- Markdown のコードフェンスは使わない",
    ].join("\n"),
    input,
    {
      state_label: "記録をためる時期",
      trajectory_summary: "記録が少しずつたまっています。",
      next_step_summary: HOME_SUMMARY_FALLBACK,
      character_message: "同じ見方で、もう1件残してみよう。",
    },
  );
}
