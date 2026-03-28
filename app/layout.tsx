import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";

export const metadata = {
  title: "自由研究ナビ",
  description: "願いを今日の一歩に変えるためのMVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-bold text-slate-900">
              自由研究ナビ
            </Link>
            <nav className="flex gap-2 text-sm text-slate-700">
              <Link href="/" className="rounded-full px-3 py-2 hover:bg-slate-100">
                ホーム
              </Link>
              <Link href="/questions" className="rounded-full px-3 py-2 hover:bg-slate-100">
                問い作成
              </Link>
              <Link href="/records" className="rounded-full px-3 py-2 hover:bg-slate-100">
                記録
              </Link>
              <Link href="/reflection" className="rounded-full px-3 py-2 hover:bg-slate-100">
                振り返り
              </Link>
              <Link href="/family" className="rounded-full px-3 py-2 hover:bg-slate-100">
                家族設定
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
