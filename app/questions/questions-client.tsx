"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { INPUT_LIMITS, limitLabel } from "@/lib/input-limits";
import { getPrimaryPurposeFocusOption, normalizePurposeFocus } from "@/lib/purpose-focus";

type Candidate = {
  text: string;
  purpose_hint: string;
  why_this_question: string;
};

type QuestionCandidatesResponse = {
  candidates?: Candidate[];
  questions?: string[];
  error?: string;
};

type QuestionFormState = {
  wish_text: string;
  reason: string;
  current_state: string;
  not_yet: string;
  desired_state: string;
  question_text: string;
  purpose_focus: string;
};

const STORAGE_KEY_PREFIX = "jiyu-kenkyu-navi-question-form";
const CANDIDATES_STORAGE_KEY_PREFIX = "jiyu-kenkyu-navi-question-candidates";

function formStorageKey(mode: "continue" | "new") {
  return `${STORAGE_KEY_PREFIX}-${mode}`;
}

function candidateStorageKey(mode: "continue" | "new") {
  return `${CANDIDATES_STORAGE_KEY_PREFIX}-${mode}`;
}

export function QuestionsClient({
  continueTemplate,
  newTemplate,
  initialMode,
  hasActiveWish,
  forceTemplate,
  continueSummary,
}: {
  continueTemplate: QuestionFormState;
  newTemplate: QuestionFormState;
  initialMode: "continue" | "new";
  hasActiveWish: boolean;
  forceTemplate: boolean;
  continueSummary: {
    wish_text: string;
    reason: string;
    before_current_state: string;
    before_not_yet: string;
    before_desired_state: string;
    after_current_state: string;
    after_not_yet: string;
    after_desired_state: string;
  } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"continue" | "new">(initialMode);
  const [form, setForm] = useState<QuestionFormState>(() => {
    if (typeof window === "undefined") {
      return initialMode === "continue" ? continueTemplate : newTemplate;
    }

    if (forceTemplate && initialMode === "continue") {
      window.sessionStorage.setItem(formStorageKey("continue"), JSON.stringify(continueTemplate));
      window.sessionStorage.removeItem(candidateStorageKey("continue"));
      return continueTemplate;
    }

    const saved = window.sessionStorage.getItem(formStorageKey(initialMode));

    if (!saved) {
      return initialMode === "continue" ? continueTemplate : newTemplate;
    }

    try {
      return JSON.parse(saved) as QuestionFormState;
    } catch {
      window.sessionStorage.removeItem(formStorageKey(initialMode));
      return initialMode === "continue" ? continueTemplate : newTemplate;
    }
  });
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    if (forceTemplate && initialMode === "continue") {
      return [];
    }

    const saved = window.sessionStorage.getItem(candidateStorageKey(initialMode));

    if (!saved) {
      return [];
    }

    try {
      return JSON.parse(saved) as Candidate[];
    } catch {
      window.sessionStorage.removeItem(candidateStorageKey(initialMode));
      return [];
    }
  });
  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    window.sessionStorage.setItem(formStorageKey(mode), JSON.stringify(form));
  }, [form, mode]);

  useEffect(() => {
    window.sessionStorage.setItem(candidateStorageKey(mode), JSON.stringify(candidates));
  }, [candidates, mode]);

  function templateForMode(nextMode: "continue" | "new") {
    return nextMode === "continue" ? continueTemplate : newTemplate;
  }

  function updateField(key: keyof QuestionFormState, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      window.sessionStorage.setItem(formStorageKey(mode), JSON.stringify(next));
      return next;
    });
  }

  function switchMode(nextMode: "continue" | "new") {
    setMode(nextMode);
    setError("");

    const savedForm = window.sessionStorage.getItem(formStorageKey(nextMode));
    const savedCandidates = window.sessionStorage.getItem(candidateStorageKey(nextMode));

    if (savedForm) {
      try {
        setForm(JSON.parse(savedForm) as QuestionFormState);
      } catch {
        window.sessionStorage.removeItem(formStorageKey(nextMode));
        setForm(templateForMode(nextMode));
      }
    } else {
      setForm(templateForMode(nextMode));
    }

    if (savedCandidates) {
      try {
        setCandidates(JSON.parse(savedCandidates) as Candidate[]);
      } catch {
        window.sessionStorage.removeItem(candidateStorageKey(nextMode));
        setCandidates([]);
      }
    } else {
      setCandidates([]);
    }
  }

  function generateCandidates() {
    setError("");

    startGenerating(async () => {
      const response = await fetch("/api/ai/question-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as QuestionCandidatesResponse;
      const nextCandidates = Array.isArray(data.candidates)
        ? data.candidates
        : Array.isArray(data.questions)
          ? data.questions.map((question) => ({
              text: question,
              purpose_hint: "compare",
              why_this_question: "まずは問いに答える材料を集めるため",
            }))
          : [];

      setCandidates(nextCandidates);
      window.sessionStorage.setItem(candidateStorageKey(mode), JSON.stringify(nextCandidates));

      if (!form.question_text && nextCandidates[0]?.text) {
        setForm((current) => ({
          ...current,
          question_text: nextCandidates[0].text,
          purpose_focus: normalizePurposeFocus(nextCandidates[0].purpose_hint || "compare"),
        }));
      }

      if (data.error) {
        setError(data.error);
      }
    });
  }

  function saveQuestion() {
    setError("");

    startSaving(async () => {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "保存できませんでした");
        return;
      }

      window.sessionStorage.removeItem(formStorageKey(mode));
      window.sessionStorage.removeItem(candidateStorageKey(mode));
      router.push("/");
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <SectionTitle>問いを作る</SectionTitle>
        <p className="mt-2 text-sm text-slate-600">同じ願いを育てるか、別の願いを始めるかを決めてから、小さな問いを1つ選びます。</p>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>1. どこから始めるか</SectionTitle>
          <Pill>{mode === "continue" ? "今の願いを続ける" : "別の願いを始める"}</Pill>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            className={`rounded-2xl border p-4 text-left ${mode === "continue" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}
            onClick={() => switchMode("continue")}
            disabled={!hasActiveWish}
          >
            <p className="font-medium text-slate-900">今の願いを続ける</p>
            <p className="mt-1 text-sm text-slate-600">{hasActiveWish ? "前の願いと振り返りを引き継ぐ" : "続ける願いはまだありません"}</p>
          </button>
          <button
            type="button"
            className={`rounded-2xl border p-4 text-left ${mode === "new" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}
            onClick={() => switchMode("new")}
          >
            <p className="font-medium text-slate-900">別の願いを始める</p>
            <p className="mt-1 text-sm text-slate-600">新しいテーマで最初から考える</p>
          </button>
        </div>
      </Card>

      {mode === "continue" && continueSummary ? (
        <Card className="space-y-4">
          <SectionTitle>続きに入るときの引き継ぎ</SectionTitle>
          <p className="text-sm text-slate-600">振り返りで書いた内容は、そのまま次の問い作りの下書きになります。</p>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                title: "今できていること",
                before: continueSummary.before_current_state,
                after: continueSummary.after_current_state,
                note: "今日わかったことを引き継ぐ",
              },
              {
                title: "まだできていないこと",
                before: continueSummary.before_not_yet,
                after: continueSummary.after_not_yet,
                note: "まだわからないことを引き継ぐ",
              },
              {
                title: "できるようになりたいこと",
                before: continueSummary.before_desired_state,
                after: continueSummary.after_desired_state,
                note: "次にやりたいことを引き継ぐ",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="mt-2 text-xs text-slate-500">前の入力</p>
                <p className="mt-1 text-sm text-slate-700">{item.before || "まだありません"}</p>
                <p className="mt-3 text-xs text-slate-500">今回の初期値</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{item.after || "まだありません"}</p>
                <p className="mt-2 text-xs text-amber-800">{item.note}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>2. 願いの今を整理する</SectionTitle>
          <Pill>{mode === "continue" ? "引き継ぎあり" : "新しく書く"}</Pill>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">何を願っているか</label>
            <textarea maxLength={INPUT_LIMITS.wish_text} rows={3} value={form.wish_text} onChange={(event) => updateField("wish_text", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.wish_text.length, INPUT_LIMITS.wish_text)}</p>
          </div>
          <div>
            <label className="field-label">なぜそう願うのか</label>
            <textarea maxLength={INPUT_LIMITS.reason} rows={3} value={form.reason} onChange={(event) => updateField("reason", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.reason.length, INPUT_LIMITS.reason)}</p>
          </div>
          <div>
            <label className="field-label">今できていること</label>
            <textarea maxLength={INPUT_LIMITS.current_state} rows={3} value={form.current_state} onChange={(event) => updateField("current_state", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.current_state.length, INPUT_LIMITS.current_state)}</p>
          </div>
          <div>
            <label className="field-label">まだできていないこと</label>
            <textarea maxLength={INPUT_LIMITS.not_yet} rows={3} value={form.not_yet} onChange={(event) => updateField("not_yet", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.not_yet.length, INPUT_LIMITS.not_yet)}</p>
          </div>
          <div className="md:col-span-2">
            <label className="field-label">できるようになりたいこと</label>
            <textarea maxLength={INPUT_LIMITS.desired_state} rows={3} value={form.desired_state} onChange={(event) => updateField("desired_state", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.desired_state.length, INPUT_LIMITS.desired_state)}</p>
          </div>
        </div>
        <button type="button" className="btn-primary w-full md:w-auto" onClick={generateCandidates} disabled={isGenerating}>
          {isGenerating ? "問いを考え中..." : "3. 問い候補を出す"}
        </button>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>4. 問いを1つ選ぶ</SectionTitle>
          {form.question_text ? <Pill>{getPrimaryPurposeFocusOption(form.purpose_focus).label}</Pill> : null}
        </div>
        <p className="text-sm text-slate-600">候補ごとに「何を見る問いか」を入れてあります。目的も含めて1つ選びます。</p>
        <div className="space-y-3">
          {candidates.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">上の内容から候補を作ります。</p>
          ) : (
            candidates.map((candidate) => {
              const normalizedPurpose = normalizePurposeFocus(candidate.purpose_hint);
              const purpose = getPrimaryPurposeFocusOption(normalizedPurpose);
              const selected = form.question_text === candidate.text && form.purpose_focus === normalizedPurpose;

              return (
                <button
                  key={`${candidate.text}-${candidate.purpose_hint}`}
                  type="button"
                  className={`w-full rounded-2xl border p-4 text-left ${
                    selected ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50"
                  }`}
                  onClick={() => {
                    updateField("question_text", candidate.text);
                    updateField("purpose_focus", normalizedPurpose);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{candidate.text}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">{purpose.label}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{candidate.why_this_question}</p>
                  <p className="mt-2 text-xs text-slate-500">{purpose.description}</p>
                </button>
              );
            })
          )}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button type="button" className="btn-primary w-full" onClick={saveQuestion} disabled={isSaving || !form.question_text}>
          {isSaving ? "保存中..." : "5. この問いで始める"}
        </button>
      </Card>
    </>
  );
}
