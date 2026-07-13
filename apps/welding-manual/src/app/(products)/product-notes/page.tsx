import { Suspense } from "react";
import View from "@/features/products/views/product-notes/ProductNoteListPage";

export const metadata = { title: "製品注意点" };

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
