import { Suspense } from "react";
import View from "@/features/products/views/products/ProductNewPage";

export const metadata = { title: "製品登録" };

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
