export default function ExportPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">データエクスポート</h1>
      <p className="text-slate-600">
        全マニュアルデータをJSON形式でダウンロードできます。<br />
        画像ファイルは <code className="rounded bg-slate-100 px-1.5 py-0.5">public/uploads/</code> に保存されています（手動でコピーしてください）。
      </p>
      <div className="space-y-2">
        <a
          href="/api/export"
          className="inline-block rounded-md bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
          download
        >
          JSONをダウンロード
        </a>
      </div>
      <div className="rounded-md border border-slate-200 bg-white p-5 text-sm">
        <h2 className="mb-2 font-bold">SEへの引き渡し手順</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>このページからJSONをダウンロード</li>
          <li><code>prisma/dev.db</code> ファイルをコピー（SQLite本体）</li>
          <li><code>public/uploads/</code> フォルダごとコピー（画像ファイル）</li>
          <li><code>prisma/schema.prisma</code> でDB構造を確認</li>
        </ol>
      </div>
    </div>
  );
}
