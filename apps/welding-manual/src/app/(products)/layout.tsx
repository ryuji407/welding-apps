import Link from "next/link";

// 製品情報セクション共通レイアウト（サブナビ）
export default function ProductsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <nav className="mb-4 flex gap-2 text-sm">
        <Link
          href="/products"
          className="rounded-full border border-slate-200 bg-white px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          製品一覧
        </Link>
        <Link
          href="/products/templates"
          className="rounded-full border border-slate-200 bg-white px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          テンプレート
        </Link>
        <Link
          href="/product-notes"
          className="rounded-full border border-slate-200 bg-white px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          製品注意点
        </Link>
      </nav>
      {children}
    </div>
  );
}
