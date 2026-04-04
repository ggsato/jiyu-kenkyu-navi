"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, LoadingBlock, SectionTitle } from "@/components/ui";
import { RecordVisualizationCard } from "@/components/record-visualization";
import { INPUT_LIMITS, limitLabel } from "@/lib/input-limits";
import type { RecordVisualization } from "@/lib/record-visualization";

type Reflection = {
  id: string;
  learned: string | null;
  unknown: string | null;
  nextStepText: string | null;
  selfProgressSignal: "forward" | "same" | "harder";
};

export function FlowClient({
  activeQuestionId,
  activeQuestionText,
  reflectionDate,
  initialReflection,
  visualization,
  insightSummary,
  recordCount,
  latestRecordedAt,
  previousWishState,
}: {
  activeQuestionId: string;
  activeQuestionText: string;
  reflectionDate: string;
  initialReflection: Reflection | null;
  visualization: RecordVisualization;
  insightSummary: string;
  recordCount: number;
  latestRecordedAt: string | null;
  previousWishState: {
    current_state: string;
    not_yet: string;
    desired_state: string;
  };
}) {
  const router = useRouter();
  const [learned, setLearned] = useState(initialReflection?.learned || "");
  const [unknown, setUnknown] = useState(initialReflection?.unknown || "");
  const [nextStepText, setNextStepText] = useState(initialReflection?.nextStepText || "");
  const [signal, setSignal] = useState<"forward" | "same" | "harder">(initialReflection?.selfProgressSignal || "same");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");

    startTransition(async () => {
      const response = await fetch("/api/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: activeQuestionId,
          reflection_date: reflectionDate,
          learned,
          unknown,
          next_step_text: nextStepText,
          self_progress_signal: signal,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "保存できませんでした");
        return;
      }

      router.push("/?from=flow");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionTitle>いま見えている流れ</SectionTitle>
              <p className="mt-2 text-sm text-slate-600">記録の生データではなく、差や変化として読める形を先に見ます。</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">記録 {recordCount} 件</span>
              {latestRecordedAt ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  最新 {new Date(latestRecordedAt).toLocaleDateString("ja-JP")}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-4">
            <RecordVisualizationCard visualization={visualization} />
          </div>
        </Card>

        <Card className="space-y-4">
          <SectionTitle>次の問いづくりに渡す材料</SectionTitle>
          <p className="text-sm text-slate-700">{activeQuestionText ? `${activeQuestionText} の記録から見えたことを、次の判断につながる言葉に整えます。` : "記録から見えたことを、次の判断につながる言葉に整えます。"}</p>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">圧縮メモ</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">{insightSummary || "まだ十分な記録がないため、差や流れはこれから見えてきます。"}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                title: "いまの土台",
                before: previousWishState.current_state,
                after: learned,
                note: "次の問い作成では、この欄が「今できていること」の初期入力候補になります。",
              },
              {
                title: "まだ埋まっていないこと",
                before: previousWishState.not_yet,
                after: unknown,
                note: "次の問い作成では、この欄が「まだできていないこと」の初期入力候補になります。",
              },
              {
                title: "次に試したいこと",
                before: previousWishState.desired_state,
                after: nextStepText,
                note: "次の問い作成では、この欄が「今いちばん気になること」の初期入力候補になります。",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="mt-2 text-xs text-slate-500">これまでの内容</p>
                <p className="mt-1 text-sm text-slate-700">{item.before || "まだありません"}</p>
                <p className="mt-3 text-xs text-slate-500">今回ここで整理した内容</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{item.after || "まだありません"}</p>
                <p className="mt-3 text-xs text-amber-800">{item.note}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <SectionTitle>整理メモ</SectionTitle>
        <p className="text-sm text-slate-700">自由記述は主役ではなく、上の流れを見たうえで次の問いに渡す材料を短く整えるために使います。</p>
        <div>
          <label className="field-label">今日気づいたこと</label>
          <textarea maxLength={INPUT_LIMITS.reflection_learned} rows={4} value={learned} onChange={(event) => setLearned(event.target.value)} />
          <p className="mt-1 text-xs text-slate-500">{limitLabel(learned.length, INPUT_LIMITS.reflection_learned)}</p>
        </div>
        <div>
          <label className="field-label">まだ気になること</label>
          <textarea maxLength={INPUT_LIMITS.reflection_unknown} rows={4} value={unknown} onChange={(event) => setUnknown(event.target.value)} />
          <p className="mt-1 text-xs text-slate-500">{limitLabel(unknown.length, INPUT_LIMITS.reflection_unknown)}</p>
        </div>
        <div>
          <label className="field-label">次にやってみたいこと</label>
          <textarea maxLength={INPUT_LIMITS.reflection_next_step_text} rows={4} value={nextStepText} onChange={(event) => setNextStepText(event.target.value)} />
          <p className="mt-1 text-xs text-slate-500">{limitLabel(nextStepText.length, INPUT_LIMITS.reflection_next_step_text)}</p>
        </div>
        <div>
          <label className="field-label">いまの手ごたえ</label>
          <select value={signal} onChange={(event) => setSignal(event.target.value as "forward" | "same" | "harder")}>
            <option value="forward">前に進めた気がする</option>
            <option value="same">大きくは変わらない</option>
            <option value="harder">かえってむずかしくなった</option>
          </select>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={submit} disabled={isPending || !activeQuestionId}>
          {isPending ? "保存中..." : "流れメモを保存"}
        </button>
        {isPending ? (
          <LoadingBlock
            title="流れメモを保存しています"
            description="圧縮した見え方と整理メモを、次の問いにつながる形で保存しています。"
          />
        ) : null}
      </Card>
    </div>
  );
}
