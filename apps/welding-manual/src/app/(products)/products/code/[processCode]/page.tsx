import { Suspense } from "react";
import View from "@/features/products/views/products/ProductCodeResolver";

export const metadata = { title: "製品情報" };

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
