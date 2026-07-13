import { Suspense } from "react";
import View from "@/features/products/views/product-notes/ProductNoteDetailPage";

export const metadata = { title: "製品注意点詳細" };

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
