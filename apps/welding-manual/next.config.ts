import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 社内IP（192.168.1.235:3000）からアクセスした際、Next.js 16 が開発用アセットを
  // クロスオリジン扱いでブロックしハイドレーションが失敗するのを防ぐ。
  // これがないとスケジュールアプリ経由で開いたフォームのボタンが反応しない。
  allowedDevOrigins: ["192.168.1.235"],
  experimental: {
    serverBodySizeLimit: "100mb",
  },
};

export default nextConfig;
