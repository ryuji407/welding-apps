import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 社内IP（192.168.1.235:3000）からアクセスした際、Next.js 16 が開発用アセットを
  // クロスオリジン扱いでブロックしハイドレーションが失敗するのを防ぐ。
  // これがないとスケジュールアプリ経由で開いたフォームのボタンが反応しない。
  allowedDevOrigins: ["192.168.1.235"],
  // ffmpeg-static/fluent-ffmpeg はビルド時のファイルトレースでバイナリパスが壊れる
  // （\ROOT\... という不正パスになり ENOENT になる）ため、バンドル対象から除外し
  // 実行時に node_modules から直接 require させる。
  serverExternalPackages: ["ffmpeg-static", "fluent-ffmpeg"],
};

export default nextConfig;
