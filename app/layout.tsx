import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { NavLink } from "@/components/nav-link";
import { getCurrentUserId, listAvailableUsers } from "@/lib/current-user";
import { UserSwitcher } from "@/components/user-switcher";

export const metadata: Metadata = {
  title: "自由研究ナビ",
  description: "願いを今日の一歩に変えるためのMVP",
  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const currentUserId = await getCurrentUserId();
  const users = await listAvailableUsers(currentUserId);

  return (
    <html lang="ja">
      <body>
        <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
            <Link href="/" className="text-lg font-bold text-slate-900">
              自由研究ナビ
            </Link>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <nav className="flex flex-wrap gap-2 text-sm">
                <NavLink href="/">ホーム</NavLink>
                <NavLink href="/questions">問い作成</NavLink>
                <NavLink href="/records">記録</NavLink>
                <NavLink href="/reflection">振り返り</NavLink>
                <NavLink href="/family">家族設定</NavLink>
              </nav>
              <div className="md:w-[220px]">
                <UserSwitcher users={users} currentUserId={currentUserId} compact />
              </div>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
