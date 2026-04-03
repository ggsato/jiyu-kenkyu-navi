"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, LoadingBlock, Pill, SectionTitle } from "@/components/ui";
import { INPUT_LIMITS, limitLabel } from "@/lib/input-limits";

type Member = {
  userId: string;
  name: string;
  role: "owner" | "member";
};

export function FamilySettingsClient({
  family,
  members,
}: {
  family: { id: string; name: string };
  members: Member[];
}) {
  const router = useRouter();
  const [familyName, setFamilyName] = useState(family.name);
  const [newMemberName, setNewMemberName] = useState("");
  const [memberNames, setMemberNames] = useState<Record<string, string>>(
    Object.fromEntries(members.map((member) => [member.userId, member.name])),
  );
  const [familyError, setFamilyError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<"family" | "add-member" | "rename-member" | "">("");
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function updateFamilyName() {
    setFamilyError("");
    setSuccessMessage("");

    startTransition(async () => {
      setPendingAction("family");
      const response = await fetch("/api/family", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: familyName }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFamilyError(data.error || "家族名を更新できませんでした");
        setPendingAction("");
        return;
      }

      setSuccessMessage("家族名を更新しました。");
      setPendingAction("");
      refresh();
    });
  }

  function addMember() {
    setMemberError("");
    setSuccessMessage("");

    startTransition(async () => {
      setPendingAction("add-member");
      const response = await fetch("/api/family/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMemberName }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMemberError(data.error || "メンバーを追加できませんでした");
        setPendingAction("");
        return;
      }

      setNewMemberName("");
      setSuccessMessage("メンバーを追加しました。");
      setPendingAction("");
      refresh();
    });
  }

  function renameMember(userId: string) {
    setMemberError("");
    setSuccessMessage("");

    startTransition(async () => {
      setPendingAction("rename-member");
      const response = await fetch(`/api/family/members/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: memberNames[userId] || "" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMemberError(data.error || "表示名を更新できませんでした");
        setPendingAction("");
        return;
      }

      setSuccessMessage("表示名を更新しました。");
      setPendingAction("");
      refresh();
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
      <Card className="space-y-4">
        <SectionTitle>家族の名前</SectionTitle>
        <div>
          <label className="field-label">家族名</label>
          <input maxLength={INPUT_LIMITS.family_name} value={familyName} onChange={(event) => setFamilyName(event.target.value)} />
          <p className="mt-1 text-xs text-slate-500">{limitLabel(familyName.length, INPUT_LIMITS.family_name)}</p>
        </div>
        {familyError ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{familyError}</p> : null}
        {successMessage && pendingAction !== "add-member" && pendingAction !== "rename-member" ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</p>
        ) : null}
        <button type="button" className="btn-primary w-full" onClick={updateFamilyName} disabled={isPending}>
          家族名を更新
        </button>
        {isPending && pendingAction === "family" ? (
          <LoadingBlock
            title="家族名を更新しています"
            description="この家族で使う表示名を保存しています。"
          />
        ) : null}

        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          今は同じ家族の中でユーザーを切り替えて使います。削除や招待はまだ入れていません。
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionTitle>家族メンバー</SectionTitle>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="field-label">新しいメンバーを追加</label>
          <input maxLength={INPUT_LIMITS.user_name} value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} placeholder="表示名" />
          <p className="mt-1 text-xs text-slate-500">{limitLabel(newMemberName.length, INPUT_LIMITS.user_name)}</p>
          <button type="button" className="btn-primary mt-3 w-full md:w-auto" onClick={addMember} disabled={isPending}>
            メンバーを追加
          </button>
        </div>

        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.userId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-medium text-slate-900">{member.name}</p>
                <Pill>{member.role === "owner" ? "家族の管理役" : "家族メンバー"}</Pill>
              </div>
              <label className="field-label">表示名</label>
              <input
                maxLength={INPUT_LIMITS.user_name}
                value={memberNames[member.userId] || ""}
                onChange={(event) =>
                  setMemberNames((current) => ({
                    ...current,
                    [member.userId]: event.target.value,
                  }))
                }
              />
              <p className="mt-1 text-xs text-slate-500">{limitLabel((memberNames[member.userId] || "").length, INPUT_LIMITS.user_name)}</p>
              <button type="button" className="btn-secondary mt-3 w-full md:w-auto" onClick={() => renameMember(member.userId)} disabled={isPending}>
                表示名を更新
              </button>
            </div>
          ))}
        </div>
        {memberError ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{memberError}</p> : null}
        {successMessage && pendingAction !== "family" ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</p>
        ) : null}
        {isPending && pendingAction !== "family" ? (
          <LoadingBlock
            title={pendingAction === "add-member" ? "メンバーを追加しています" : "表示名を更新しています"}
            description={pendingAction === "add-member" ? "家族の切り替え候補に新しいメンバーを追加しています。" : "この家族で使う表示名を保存しています。"}
          />
        ) : null}
      </Card>
    </div>
  );
}
