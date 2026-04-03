"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function UserSwitcher({
  users,
  currentUserId,
  compact = false,
}: {
  users: Array<{ id: string; name: string | null }>;
  currentUserId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function switchUser(nextUserId: string) {
    setSelectedUserId(nextUserId);
    setError("");

    startTransition(async () => {
      const response = await fetch("/api/users/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: nextUserId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "ユーザーを切り替えられませんでした");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className={compact ? "min-w-[180px]" : "rounded-2xl border border-slate-200 bg-white p-4"}>
      <label className={compact ? "mb-1 block text-xs font-medium text-slate-500" : "field-label"}>{compact ? "使う人" : "だれが使うか"}</label>
      <select value={selectedUserId} onChange={(event) => switchUser(event.target.value)} disabled={isPending}>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name || "表示名未設定"}
          </option>
        ))}
      </select>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
