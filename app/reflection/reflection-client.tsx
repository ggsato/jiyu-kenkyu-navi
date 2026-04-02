"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { INPUT_LIMITS, limitLabel } from "@/lib/input-limits";

type Reflection = {
  id: string;
  learned: string | null;
  unknown: string | null;
  nextStepText: string | null;
  selfProgressSignal: "forward" | "same" | "harder";
};

export function ReflectionClient({
  activeQuestionId,
  reflectionDate,
  initialReflection,
  previousWishState,
}: {
  activeQuestionId: string;
  reflectionDate: string;
  initialReflection: Reflection | null;
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

      router.push("/?from=reflection");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
      <Card className="space-y-4">
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
          <label className="field-label">今日の進み方</label>
          <select value={signal} onChange={(event) => setSignal(event.target.value as "forward" | "same" | "harder")}>
            <option value="forward">前に進めた気がする</option>
            <option value="same">大きくは変わらない</option>
            <option value="harder">かえってむずかしくなった</option>
          </select>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={submit} disabled={isPending || !activeQuestionId}>
          {isPending ? "保存中..." : "振り返りを保存"}
        </button>
      </Card>

      <Card className="space-y-4">
        <p className="text-sm font-medium text-slate-900">次の問い作りに引き継がれる内容</p>
        <p className="text-sm text-slate-600">保存すると、今の願いを続けるときの下書きが下の対応で更新されます。</p>
        {[
          {
            title: "今できていること",
            before: previousWishState.current_state,
            after: learned,
            note: "今日気づいたこと",
          },
          {
            title: "まだできていないこと",
            before: previousWishState.not_yet,
            after: unknown,
            note: "まだ気になること",
          },
          {
            title: "できるようになりたいこと",
            before: previousWishState.desired_state,
            after: nextStepText,
            note: "次にやってみたいこと",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">{item.title}</p>
            <p className="mt-2 text-xs text-slate-500">前の入力</p>
            <p className="mt-1 text-sm text-slate-700">{item.before || "まだありません"}</p>
            <p className="mt-3 text-xs text-slate-500">今回の入力</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{item.after || "まだありません"}</p>
            <p className="mt-2 text-xs text-amber-800">{item.note} がここに入ります。</p>
          </div>
        ))}
      </Card>
    </div>
  );
}
