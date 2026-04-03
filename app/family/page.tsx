import { PageShell, Card, SectionTitle } from "@/components/ui";
import { getCurrentFamily, getCurrentUserId } from "@/lib/current-user";
import { FamilySettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const currentUserId = await getCurrentUserId();
  const family = await getCurrentFamily(currentUserId);

  return (
    <PageShell>
      <Card>
        <SectionTitle>家族設定</SectionTitle>
        <p className="mt-2 text-sm text-slate-600">同じ家族の中で使う人を増やしたり、名前を整えたりします。本格認証はまだ入れていません。</p>
      </Card>
      <FamilySettingsClient
        family={{
          id: family?.id || "",
          name: family?.name || "",
        }}
        members={(family?.members || []).map((member) => ({
          userId: member.user.id,
          name: member.user.name || "",
          role: member.role,
        }))}
      />
    </PageShell>
  );
}
