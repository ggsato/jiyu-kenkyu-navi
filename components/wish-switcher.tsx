"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type WishSummary = {
  id: string;
  text: string;
  questionId: string;
  questionText: string;
  updatedAt: string;
  isActive: boolean;
};

export function WishSwitcher({ wishes }: { wishes: WishSummary[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingWishId, setPendingWishId] = useState("");
  const [isPending, startTransition] = useTransition();

  function switchWish(wishId: string) {
    setPendingWishId(wishId);
    setError("");

    startTransition(async () => {
      const response = await fetch(`/api/wishes/${wishId}/switch`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "願いを切り替えられませんでした");
        return;
      }

      router.refresh();
    });
  }

  if (wishes.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        まだ願いはありません。最初の問いを作ると、ここに並びます。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {wishes.map((wish) => (
        <div key={wish.id} className={`rounded-2xl border p-4 ${wish.isActive ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">{wish.text}</p>
              <p className="mt-1 text-sm text-slate-600">{wish.questionText}</p>
              <p className="mt-2 text-xs text-slate-500">{new Date(wish.updatedAt).toLocaleDateString("ja-JP")} に更新</p>
            </div>
            {wish.isActive ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">いま見ている</span>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => switchWish(wish.id)} disabled={isPending && pendingWishId === wish.id}>
                {isPending && pendingWishId === wish.id ? "切り替え中..." : "この願いに切り替える"}
              </button>
            )}
          </div>
        </div>
      ))}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
