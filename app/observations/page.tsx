import Link from "next/link";
import { Card, PageShell, Pill, SectionTitle } from "@/components/ui";
import { getCurrentUserId } from "@/lib/current-user";
import { buildObservationStructurePayload, type ObservationNode } from "@/lib/observations";

export const dynamic = "force-dynamic";

function roleLabel(role: "core" | "compare" | "optional") {
  if (role === "compare") {
    return "違いを見る";
  }

  if (role === "optional") {
    return "気になったら足す";
  }

  return "まず残す";
}

function fieldTypeLabel(type: "text" | "number" | "boolean" | "select") {
  if (type === "select") {
    return "選ぶ";
  }

  if (type === "boolean") {
    return "はい/いいえ";
  }

  if (type === "number") {
    return "数で入れる";
  }

  return "短く書く";
}

function ObservationTree({
  nodes,
  depth = 0,
}: {
  nodes: ObservationNode[];
  depth?: number;
}) {
  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <div
          key={node.id}
          className={`rounded-3xl border ${node.isCurrent ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"} p-4`}
          style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 20}px` : undefined }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-900">{node.label}</p>
              <p className="mt-1 text-xs text-slate-500">
                {fieldTypeLabel(node.type)} / {roleLabel(node.role)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {node.isCurrent ? <Pill>今の問いで使う</Pill> : null}
              {node.isDefault ? <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">初期選択</span> : null}
              {node.childCount > 0 ? <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">子項目 {node.childCount}</span> : null}
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-slate-700">使った問い: {node.selectedCount}回</div>
            <div className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-slate-700">候補に出た回: {node.presentedCount}回</div>
            <div className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-slate-700">今回は使わない: {node.skippedCount}回</div>
          </div>
          {node.why ? <p className="mt-3 text-sm text-slate-700">理由: {node.why}</p> : null}
          {node.howToUse ? <p className="mt-2 text-xs text-slate-500">使い方: {node.howToUse}</p> : null}
          {node.lastSelectedQuestionText ? (
            <p className="mt-2 text-xs text-slate-500">
              最後に使った問い: {node.lastSelectedQuestionText}
              {node.lastSelectedAt ? ` (${new Date(node.lastSelectedAt).toLocaleDateString("ja-JP")})` : ""}
            </p>
          ) : null}
          {node.children.length > 0 ? (
            <div className="mt-4 border-l-2 border-amber-200 pl-2">
              <ObservationTree nodes={node.children} depth={depth + 1} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default async function ObservationsPage() {
  const userId = await getCurrentUserId();
  const payload = await buildObservationStructurePayload(userId);

  if (!payload.hasActiveWish) {
    return (
      <PageShell>
        <Card className="bg-[linear-gradient(135deg,#fff7d6,#ffffff)]">
          <p className="mb-3 text-sm text-slate-600">見方の地図</p>
          <h1 className="text-3xl font-bold text-slate-900">まだ見方の地図はありません</h1>
          <p className="mt-3 max-w-2xl text-slate-700">最初の問いを作ると、この願いで見ていく項目のまとまりがここにたまっていきます。</p>
          <div className="mt-6 flex gap-3">
            <Link href="/questions" className="btn-primary">
              問いを作る
            </Link>
            <Link href="/" className="btn-secondary">
              ホームへ戻る
            </Link>
          </div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card className="bg-[linear-gradient(135deg,#fff7d6,#ffffff)]">
        <p className="mb-3 text-sm text-slate-600">見方の地図</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-slate-900">この願いの見方の地図</h1>
            <p className="mt-3 text-slate-700">願い: {payload.wishText}</p>
            <p className="mt-2 text-sm text-slate-600">今の問い: {payload.activeQuestionText}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/" className="btn-secondary">
              ホームへ戻る
            </Link>
            <Link href="/questions?mode=continue" className="btn-primary">
              次の問いを作る
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <SectionTitle>全項目</SectionTitle>
          <p className="mt-2 text-4xl font-bold text-slate-900">{payload.stats.total}</p>
        </Card>
        <Card>
          <SectionTitle>親項目</SectionTitle>
          <p className="mt-2 text-4xl font-bold text-slate-900">{payload.stats.roots}</p>
        </Card>
        <Card>
          <SectionTitle>細分化項目</SectionTitle>
          <p className="mt-2 text-4xl font-bold text-slate-900">{payload.stats.split}</p>
        </Card>
        <Card>
          <SectionTitle>今使う項目</SectionTitle>
          <p className="mt-2 text-4xl font-bold text-slate-900">{payload.stats.current}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle>最近増えた項目</SectionTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {payload.recentAdded.length > 0 ? (
              payload.recentAdded.map((label) => (
                <span key={label} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  {label}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-600">まだありません。</p>
            )}
          </div>
        </Card>
        <Card>
          <SectionTitle>今はお休みしている項目</SectionTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {payload.resting.length > 0 ? (
              payload.resting.map((label) => (
                <span key={label} className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900">
                  {label}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-600">今はお休みしている項目はありません。</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>つながり</SectionTitle>
          <Pill>この願いで見ていく項目</Pill>
        </div>
        <p className="mt-3 text-sm text-slate-600">大きい項目から細かい項目へのつながりをたどれます。今の問いで使う項目は強調表示されます。</p>
        <div className="mt-4">
          <ObservationTree nodes={payload.tree} />
        </div>
      </Card>
    </PageShell>
  );
}
