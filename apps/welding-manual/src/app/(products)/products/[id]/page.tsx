import { Suspense } from "react";
import View from "@/features/products/views/products/ProductDetailPage";

export const metadata = { title: "製品詳細" };

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
