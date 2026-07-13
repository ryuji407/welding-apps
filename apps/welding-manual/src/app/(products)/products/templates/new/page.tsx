import { Suspense } from "react";
import View from "@/features/products/views/products/TemplateEditPage";

export const metadata = { title: "テンプレート作成" };

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
