import OpenAI from "openai";
import {
  HOME_SUMMARY_FALLBACK,
  QUESTION_CANDIDATE_FALLBACK,
  RECORD_FIELD_FALLBACK,
} from "@/lib/constants";
import { normalizePurposeFocus } from "@/lib/purpose-focus";
import { suggestedExistingFieldKeySchema, suggestedFieldSchema } from "@/lib/validation";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const AI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || "60000");
const questionModel = process.env.OPENAI_MODEL_QUESTION || process.env.OPENAI_MODEL || "gpt-5.4";
const recordFieldsModel = process.env.OPENAI_MODEL_RECORD_FIELDS || process.env.OPENAI_MODEL || "gpt-5.4";
const homeModel = process.env.OPENAI_MODEL_HOME || process.env.OPENAI_MODEL || "gpt-5.4-mini";

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
  const nextCuriosityText = String(input.next_curiosity_text || "").trim();
  const recordInsightSummary = String(input.record_insight_summary || "").trim();
  const result = await createJson(
    questionModel,
    [
      "あなたは子どもの自由研究を支える編集者です。",
      nextCuriosityText
        ? "次の入力から、本人が書いた『今いちばん気になること』を活かして、観察・記録可能で、一回で試せる問い候補を最大3件整えてください。"
        : "次の入力から、観察・記録可能で、一回で試せる問い候補を最大3件作ってください。",
      "断定せず、短く、子どもにも読みやすい日本語にしてください。",
      nextCuriosityText
        ? "本人が書いた言葉がある場合、AIが勝手に別の関心へ飛ばさず、近い形で整えてください。"
        : "入力に沿って、小さく試せる問いにしてください。",
      "候補には、できるだけ『見る』『試す』『続ける』の違いがにじむようにしてください。",
      "『見る』はまず何が起きているかをつかむ問いです。",
      "『試す』はやり方の違いを試し分ける問いです。",
      "『続ける』はひとつのやり方や見方を続けて確かめる問いです。",
      recordInsightSummary
        ? `最近の記録を日単位で圧縮した要約: ${recordInsightSummary}`
        : "",
      recordInsightSummary
        ? "最近の流れがある場合は、それを踏まえて次の一歩になる問いを出してください。すでに十分見えていることの言い換えは避けてください。"
        : "",
      "",
      "必ず次の JSON だけを返してください。",
      "{",
      '  "candidates": [',
      "    {",
      '      "text": "問い文",',
      '      "shape_label": "そのまま見てみる|試し方を変えてみる|続けて確かめる",',
      '      "purpose_hint": "compare|relate|predict",',
      '      "why_this_question": "この問いがよい理由"',
      "    }",
      "  ]",
      "}",
      "",
      "ルール:",
      "- 最大3件",
      "- text は40文字以内",
      "- shape_label は指定された3種類のどれかにする",
      "- why_this_question は50文字以内",
      "- 各要素に text, shape_label, purpose_hint, why_this_question を必ず含める",
      "- purpose_hint は compare, relate, predict のいずれかにする",
      "- ただ残すための問いではなく、見る・試す・続けるのどれかが見える問いにする",
      "- purpose_hint は、見るなら relate、試すなら compare、続けるなら predict を使う",
      nextCuriosityText ? "- 3件の役割は、できるだけ『そのまま見てみる』『試し方を変えてみる』『続けて確かめる』で分ける" : "- 役割が重なりすぎないようにする",
      "- JSON 以外の説明文は書かない",
      "- Markdown のコードフェンスは使わない",
    ].join("\n"),
    input,
    {
      candidates: [
        {
          text: QUESTION_CANDIDATE_FALLBACK,
          shape_label: "試し方を変えてみる",
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
        shape_label: "試し方を変えてみる",
        purpose_hint: "compare",
        why_this_question: "まずは小さく記録を始めるため",
      })),
    };
  }

  return {
    candidates: result.candidates.map((candidate) => ({
      ...candidate,
      shape_label: candidate.shape_label || "小さくする",
      purpose_hint: normalizePurposeFocus(candidate.purpose_hint),
    })),
  };
}

export async function generateRecordFieldSuggestions(input: Record<string, unknown>) {
  const normalizedPurposeFocus = normalizePurposeFocus(String(input.purpose_focus || "compare"));
  const recordInsightSummary = String(input.record_insight_summary || "").trim();
  const existingKeys = Array.isArray(input.existing_kv_keys)
    ? (input.existing_kv_keys as unknown[]).map((key) => String(key)).filter(Boolean)
    : [];
  const existingFields = Array.isArray(input.existing_fields)
    ? (input.existing_fields as Array<Record<string, unknown>>).map((field) => ({
        key: String(field.key || ""),
        label: String(field.label || ""),
        type: String(field.type || ""),
        unit: field.unit == null ? null : String(field.unit),
        options: Array.isArray(field.options) ? field.options.map((option) => String(option)) : [],
        role: String(field.role || ""),
        why: String(field.why || ""),
        how_to_use: String(field.how_to_use || ""),
        selected_count: Number(field.selected_count || 0),
        presented_count: Number(field.presented_count || 0),
        is_currently_selected: Boolean(field.is_currently_selected),
      })).filter((field) => field.key && field.label)
    : [];
  const result = await createJson(
    recordFieldsModel,
    [
      "あなたは記録フォーム設計者です。",
      "次の入力から、その願いに向かって今回どんな試し方や見方を使うか、そして何を残すと次の一歩につながるかを提案してください。",
      "特定の題材に寄せすぎず、どんな自由研究テーマでも使える考え方で作ってください。",
      "ただし question_text と wish_text に書かれていない具体物を勝手に足してはいけません。",
      "項目と選択肢は、入力された問いと願いの文脈に直接対応している必要があります。",
      existingFields.length > 0
        ? `この願いの既存項目は ${existingFields.map((field) => `${field.key}:${field.label}:${field.type}${field.unit ? `:${field.unit}` : ""}${field.options.length > 0 ? `:${field.options.join("/")}` : ""}:selected=${field.selected_count}:presented=${field.presented_count}:current=${field.is_currently_selected ? "yes" : "no"}`).join(", ")} です。まずこの中で今回使う項目を選び、足りないときだけ新しい項目を提案してください。`
        : "まだ既存の項目はありません。長く使えそうな試し方や見方の軸を優先してください。",
      existingFields.length > 0
        ? "同じ意味の項目を出し直すのではなく、既存項目の unit/type/options/how_to_use をできるだけ引き継いでください。長く使われている項目ほど優先してください。"
        : "",
      existingFields.length > 0
        ? "必要なら、既存項目のうちどれを細かく分けるとよいかも提案してください。"
        : "",
      "項目は、できるだけ『今回何を試したか』『どんな状況だったか』『結果どうだったか』が残るようにしてください。",
      "問いに答えるために本当に必要な観測値だけを出してください。",
      "あとで比べたり数えたりしやすいように、自由入力より select と boolean を優先してください。",
      "text は本当に自由記述が必要なときだけ使ってください。",
      "select を使うときは options を必ず 2件以上入れてください。",
      "",
      `この問いの目的は ${normalizedPurposeFocus} です。`,
      normalizedPurposeFocus === "compare"
        ? "やり方の違いを試し分けられるように、今回何を試し分けるかが一目で分かる主項目を1つ作り、その項目はできるだけ select で選択肢も入れてください。"
        : normalizedPurposeFocus === "relate"
          ? "まず何が起きているかをつかめるように、状況と結果の流れが分かる項目を優先してください。"
          : "ひとつのやり方や見方を続けて確かめられるように、同じ軸で変化を追える項目を優先してください。",
      recordInsightSummary
        ? `最近の記録を日単位で圧縮した要約: ${recordInsightSummary}`
        : "",
      recordInsightSummary
        ? "最近の流れだけで足りないところを埋める項目を優先し、同じ意味の項目を増やしすぎないでください。"
        : "",
      "",
      "",
      "必ず次の JSON だけを返してください。",
      "{",
      '  "selected_existing_keys": ["existing_key"],',
      '  "split_existing_keys": ["existing_key"],',
      '  "suggested_fields": [',
      "    {",
      '      "key": "field_key",',
      '      "label": "表示名",',
      '      "type": "text|number|boolean|select",',
      '      "unit": null,',
      '      "options": [],',
      '      "role": "core|compare|optional",',
      '      "why": "この項目を見る理由",',
      '      "how_to_use": "あとでどう使うか",',
      '      "is_default": true,',
      '      "derived_from_key": null',
      "    }",
      "  ]",
      "}",
      "",
      "ルール:",
      "- 最大10件",
      "- selected_existing_keys は既存項目から 1〜6 件まで",
      "- split_existing_keys は『細かく分けるとよい既存項目』だけを 0〜3 件まで",
      "- split_existing_keys の各要素は selected_existing_keys に含めてよい",
      "- key は英数字と underscore を使う",
      "- label は12文字以内の短い日本語にする",
      "- 入力にない具体物や題材を勝手に作らない",
      "- 項目と選択肢は question_text と wish_text の語に沿わせる",
      "- existing_kv_keys と重なる項目は重複して出さない",
      "- selected_existing_keys と split_existing_keys は existing_kv_keys に含まれる key だけを使う",
      "- まず select を検討し、次に boolean を検討する",
      "- text は最後の手段にする",
      "- できるだけ後で集計しやすい軸にする",
      "- 主観ではなく、目で見たり数えたり選んだりできる独立した観測値にする",
      "- 抽象語や体感語ではなく、何を見れば答えられるかがすぐ分かる項目にする",
      "- role は core, compare, optional のいずれかにする",
      "- core は『まず決める』項目で 1〜3 件まで",
      "- compare は『試し分けに使う』項目で 0〜3 件まで",
      normalizedPurposeFocus === "compare" ? "- compare は基本的に 1 件にし、その1件で今回何を試すかが分かるようにする" : "",
      normalizedPurposeFocus === "compare" ? "- compare の項目は、できるだけ type=select にして options を2件以上入れる" : "",
      "- optional は『気になったら足す』項目で 0〜4 件まで",
      "- why は40文字以内で、その項目を見る理由を短く書く",
      "- how_to_use は40文字以内で、あとでどう比べたり見返したりするかを書く",
      "- is_default は core だけ true にしてよい",
      "- 既存項目を細かく分ける意図で新規項目を出すときだけ derived_from_key に既存項目の key を入れる",
      "- derived_from_key は existing_kv_keys に含まれる key だけにする",
      "- 良い悪い、高い低い、うまくいった、命中率のような評価項目は出さない",
      "- 勝率、成功率、平均、合計、スコア、評価、割合、差 のような集計項目は出さない",
      "- 集計したくなる場合も、1回ごとに直接記録できる元の観測値に分解する",
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
      selected_existing_keys: existingKeys.slice(0, 2),
      split_existing_keys: [],
      suggested_fields: [
        { key: "trying", label: "試すこと", type: "select", unit: null, options: ["やり方A", "やり方B"], role: "compare", why: "今回何を試したかを分けるため", how_to_use: "試すことごとに見返す", is_default: false, derived_from_key: null },
        { key: "scene", label: "場面", type: "select", unit: null, options: ["はじめ", "途中", "おわり"], role: "core", why: "どんな状況だったか残すため", how_to_use: "近い場面どうしで見返す", is_default: true, derived_from_key: null },
        { key: "what_happened", label: "結果", type: "text", unit: null, options: [], role: "core", why: "どうだったかを短く残すため", how_to_use: "試すこととの違いを見返す", is_default: true, derived_from_key: null },
      ],
      fallback_message: RECORD_FIELD_FALLBACK,
    },
  );

  const selectedExistingKeys = Array.isArray((result as { selected_existing_keys?: unknown[] }).selected_existing_keys)
    ? (result as { selected_existing_keys: unknown[] }).selected_existing_keys
        .map((key) => suggestedExistingFieldKeySchema.safeParse(key))
        .filter((key) => key.success)
        .map((key) => key.data)
        .filter((key) => existingKeys.includes(key))
        .slice(0, 6)
    : [];

  const splitExistingKeys = Array.isArray((result as { split_existing_keys?: unknown[] }).split_existing_keys)
    ? (result as { split_existing_keys: unknown[] }).split_existing_keys
        .map((key) => suggestedExistingFieldKeySchema.safeParse(key))
        .filter((key) => key.success)
        .map((key) => key.data)
        .filter((key) => existingKeys.includes(key))
        .slice(0, 3)
    : [];

  const suggestedFields = Array.isArray((result as { suggested_fields?: unknown[] }).suggested_fields)
    ? (result as { suggested_fields: unknown[] }).suggested_fields
        .map((field) => suggestedFieldSchema.safeParse(field))
        .filter((field) => field.success)
        .map((field) => field.data)
        .slice(0, 10)
    : [];

  if (suggestedFields.length > 0) {
    return {
      selected_existing_keys: selectedExistingKeys,
      split_existing_keys: splitExistingKeys,
      suggested_fields: suggestedFields,
    };
  }

  return {
    selected_existing_keys: existingKeys.slice(0, 2),
    split_existing_keys: [],
    suggested_fields: [
      { key: "trying", label: "試すこと", type: "select", unit: null, options: ["やり方A", "やり方B"], role: "compare", why: "今回何を試したかを分けるため", how_to_use: "試すことごとに見返す", is_default: false, derived_from_key: null },
      { key: "scene", label: "場面", type: "select", unit: null, options: ["はじめ", "途中", "おわり"], role: "core", why: "どんな状況だったか残すため", how_to_use: "近い場面どうしで見返す", is_default: true, derived_from_key: null },
      { key: "what_happened", label: "結果", type: "text", unit: null, options: [], role: "core", why: "どうだったかを短く残すため", how_to_use: "試すこととの違いを見返す", is_default: true, derived_from_key: null },
    ],
    fallback_message: RECORD_FIELD_FALLBACK,
  };
}

export async function generateSplitFieldSuggestions(input: Record<string, unknown>) {
  const existingKeys = Array.isArray(input.existing_kv_keys)
    ? (input.existing_kv_keys as unknown[]).map((key) => String(key)).filter(Boolean)
    : [];
  const parentFieldKey = String(input.parent_field_key || "").trim();
  const parentFieldLabel = String(input.parent_field_label || "").trim();
  const parentFieldType = String(input.parent_field_type || "text").trim();
  const result = await createJson(
    recordFieldsModel,
    [
      "あなたは記録フォーム設計者です。",
      "次の入力から、既存の項目をより細かく残すための子項目候補を 2〜4 件提案してください。",
      "子項目は、親項目を置き換えるのではなく、親項目の中の違いや内訳を残しやすくするためのものにしてください。",
      "question_text と wish_text に書かれていない具体物を勝手に足してはいけません。",
      `今回細かく分ける親項目は ${parentFieldKey}:${parentFieldLabel} (${parentFieldType}) です。`,
      existingKeys.length > 0 ? `既存項目は ${existingKeys.join(", ")} です。重複する key は出さないでください。` : "",
      "",
      "必ず次の JSON だけを返してください。",
      "{",
      '  "split_candidates": [',
      "    {",
      '      "key": "field_key",',
      '      "label": "表示名",',
      '      "type": "text|number|boolean|select",',
      '      "unit": null,',
      '      "options": [],',
      '      "role": "core|compare|optional",',
      '      "why": "この項目を見る理由",',
      '      "how_to_use": "あとでどう使うか",',
      '      "is_default": false,',
      `      "derived_from_key": "${parentFieldKey}"`,
      "    }",
      "  ]",
      "}",
      "",
      "ルール:",
      "- 2〜4件",
      "- 親項目そのものと同じ意味の項目は出さない",
      "- 選択肢を増やすだけの言い換えではなく、何を見分けるかが変わる子項目だけを出す",
      "- 親項目の options を言い換えで並べ直しただけの案は出さない",
      "- why には、何の違いが見えるようになるかを書く",
      "- how_to_use には、その子項目であとでどう比べるかを書く",
      "- derived_from_key は必ず親項目の key にする",
      "- 既存 key と重複する key は出さない",
      "- label は12文字以内",
      "- 1回ごとに直接記録できるものにする",
      "- select を使うときは options を2件以上入れる",
      "- JSON 以外の説明文は書かない",
      "- Markdown のコードフェンスは使わない",
    ].join("\n"),
    input,
    {
      split_candidates: [
        {
          key: `${parentFieldKey}_detail`,
          label: `${parentFieldLabel}内訳`,
          type: "select",
          unit: null,
          options: ["はじめ", "途中", "おわり"],
          role: "optional",
          why: `${parentFieldLabel}を細かく見るため`,
          how_to_use: "内訳ごとに見返す",
          is_default: false,
          derived_from_key: parentFieldKey,
        },
      ],
    },
  );

  const splitCandidates = Array.isArray((result as { split_candidates?: unknown[] }).split_candidates)
    ? (result as { split_candidates: unknown[] }).split_candidates
        .map((field) => suggestedFieldSchema.safeParse(field))
        .filter((field) => field.success)
        .map((field) => field.data)
        .filter((field) => field.derived_from_key === parentFieldKey)
        .filter((field) => !existingKeys.includes(field.key))
        .filter((field) => {
          const normalizedParent = parentFieldLabel.replace(/\s+/g, "");
          const normalizedLabel = field.label.replace(/\s+/g, "");

          if (normalizedParent === normalizedLabel || normalizedParent.includes(normalizedLabel) || normalizedLabel.includes(normalizedParent)) {
            return false;
          }

          if ((field.why || "").trim().length === 0 || (field.how_to_use || "").trim().length === 0) {
            return false;
          }

          return true;
        })
        .slice(0, 4)
    : [];

  return { split_candidates: splitCandidates };
}

export async function generateHomeSummary(input: Record<string, unknown>) {
  const flowSummary = typeof input.flow_summary === "object" && input.flow_summary !== null
    ? input.flow_summary as {
        record_insight_summary?: string;
        learned?: string | null;
        unknown?: string | null;
        next_step_text?: string | null;
      }
    : null;
  return createJson(
    homeModel,
    [
      "あなたはやさしい伴走者です。",
      "ホーム画面用の短い文を作ってください。",
      flowSummary?.record_insight_summary
        ? `記録の圧縮要約: ${flowSummary.record_insight_summary}`
        : "",
      flowSummary?.learned
        ? `流れを見るで整理した気づき: ${flowSummary.learned}`
        : "",
      flowSummary?.unknown
        ? `流れを見るで整理した未解決: ${flowSummary.unknown}`
        : "",
      flowSummary?.next_step_text
        ? `流れを見るで整理した次の一歩候補: ${flowSummary.next_step_text}`
        : "",
      flowSummary
        ? "生の記録の羅列よりも、圧縮要約と流れメモを優先して現在地と次の一歩をまとめてください。"
        : "",
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
