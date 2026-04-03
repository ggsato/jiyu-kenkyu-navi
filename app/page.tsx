import Link from "next/link";
import { buildHomePayload } from "@/lib/home";
import { Card, PageShell, Pill, SectionTitle } from "@/components/ui";
import { getCurrentUserId, listAvailableUsers } from "@/lib/current-user";
import { UserSwitcher } from "@/components/user-switcher";
import { WishSwitcher } from "@/components/wish-switcher";
import { formatDateTimeInAppTimeZone } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string }>;
}) {
  const params = (await searchParams) || {};
  const currentUserId = await getCurrentUserId();
  const [home, users] = await Promise.all([buildHomePayload(currentUserId), listAvailableUsers(currentUserId)]);

  if (!home.has_active_question) {
    return (
      <PageShell>
        <UserSwitcher users={users} currentUserId={currentUserId} />
        <Card className="bg-[linear-gradient(135deg,#fff7d6,#ffffff)]">
          <p className="mb-3 text-sm text-slate-600">今の状態</p>
          <h1 className="text-3xl font-bold text-slate-900">最初の問いを作ろう</h1>
          <p className="mt-3 max-w-2xl text-slate-700">願いを書いて、何を見ていくかを決める小さな問いを1つ選ぶところから始めます。</p>
          <Link href="/questions" className="btn-primary mt-6">
            問いを作る
          </Link>
        </Card>
        <Card>
          <SectionTitle>願い一覧</SectionTitle>
          <p className="mt-2 text-sm text-slate-600">家族ごとに願いを持てます。あとでここから切り替えます。</p>
          <div className="mt-4">
            <WishSwitcher wishes={home.wishes} />
          </div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <UserSwitcher users={users} currentUserId={currentUserId} />
      <Card className="bg-[linear-gradient(135deg,#fff7d6,#ffffff)]">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-3 text-sm text-slate-600">今どこにいて、次に何をするか</p>
            <h1 className="text-3xl font-bold text-slate-900">{home.state_label}</h1>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="text-xs text-slate-500">今の願い</p>
                <p className="mt-1 text-base font-medium text-slate-900">{home.wish_text}</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="text-xs text-slate-500">今の問い</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{home.question_text}</p>
              </div>
            </div>

            <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <SectionTitle>次にするとよいこと</SectionTitle>
                <Pill>次の一歩</Pill>
              </div>
              {params.from === "reflection" ? <p className="mt-3 text-sm font-medium text-amber-800">振り返りで見えてきたことをもとに、今の願いを続けるか、別の願いを始めるか決めよう。</p> : null}
              <p className="mt-3 text-slate-700">{home.next_step_summary}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link href={`/records?source=next_step&questionId=${home.active_question_id}`} className="btn-primary">
                  記録を1件追加
                </Link>
                <Link href="/reflection" className="btn-secondary">
                  振り返る
                </Link>
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Link href={`/questions?mode=continue${params.from === "reflection" ? "&from=reflection" : ""}`} className="btn-secondary">
                  今の願いの次の問い
                </Link>
                <Link href="/questions?mode=new" className="btn-secondary">
                  別の願いを始める
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">いまのナビ</p>
              <div className="mt-3 flex items-start gap-4">
                <div className="relative h-20 w-20 shrink-0 rounded-[2rem] bg-[radial-gradient(circle_at_35%_30%,#fff7d6,#ffd166_55%,#ffb703)] shadow-sm">
                  <div className="absolute left-4 top-6 h-2.5 w-2.5 rounded-full bg-slate-800" />
                  <div className="absolute right-4 top-6 h-2.5 w-2.5 rounded-full bg-slate-800" />
                  <div className="absolute left-1/2 top-11 h-5 w-9 -translate-x-1/2 rounded-b-[999px] border-2 border-slate-800 border-t-0" />
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3">
                  <p className="max-w-xs text-sm font-medium text-slate-800">{home.character_message}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">今: {home.state_label}</div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">次: 記録を1件足すか、振り返る</div>
              </div>
              <p className="mt-4 text-sm text-slate-700">{home.trajectory_summary}</p>
              {home.recent_reflection_summary ? <p className="mt-2 text-sm text-slate-600">この前の気づき: {home.recent_reflection_summary}</p> : null}
            </div>

            <div className="rounded-3xl bg-white/80 p-4 shadow-sm">
              <SectionTitle>最近の記録</SectionTitle>
              <div className="mt-3 space-y-3">
                {home.recent_records.length === 0 ? (
                  <p className="text-slate-600">まだ記録はありません。</p>
                ) : (
                  home.recent_records.slice(0, 3).map((record) => (
                    <article key={record.id} className="rounded-2xl bg-white p-3">
                      <p className="text-xs text-slate-600">{"recordedAtLabel" in record ? record.recordedAtLabel : formatDateTimeInAppTimeZone(record.recordedAt)}</p>
                      <p className="mt-1 font-medium text-slate-900">{record.body}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-lg font-semibold text-slate-900">見方のまとまりを見る</summary>
        <p className="mt-3 text-sm text-slate-600">今見ている項目や、お休み中の項目は必要なときにここから見返せます。</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <SectionTitle>今見ている項目</SectionTitle>
              <Link href="/observations" className="text-sm font-medium text-amber-900 underline-offset-2 hover:underline">
                見方の地図を見る
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {home.observation_summary.current.length > 0 ? (
                home.observation_summary.current.map((label) => (
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
            <SectionTitle>よく見る項目</SectionTitle>
            <div className="mt-3 space-y-2">
              {home.observation_summary.frequent.length > 0 ? (
                home.observation_summary.frequent.map((item) => (
                  <div key={item.label} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {item.label} {item.count}回
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">まだたまりはありません。</p>
              )}
            </div>
          </Card>
          <Card>
            <SectionTitle>今はお休みしている項目</SectionTitle>
            <div className="mt-3 space-y-2">
              {home.observation_summary.resting.length > 0 ? (
                home.observation_summary.resting.map((label) => (
                  <div key={label} className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {label}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">今はお休みしている項目はありません。</p>
              )}
            </div>
            {home.observation_summary.recentAdded.length > 0 ? (
              <p className="mt-4 text-xs text-slate-600">最近ふえた項目: {home.observation_summary.recentAdded.join(" / ")}</p>
            ) : null}
          </Card>
        </div>
      </details>

      <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-lg font-semibold text-slate-900">願い一覧を見る</summary>
        <div className="mt-4">
          <WishSwitcher wishes={home.wishes} />
        </div>
      </details>
    </PageShell>
  );
}
