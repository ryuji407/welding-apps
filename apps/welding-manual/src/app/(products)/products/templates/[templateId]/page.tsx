import { Suspense } from "react";
import View from "@/features/products/views/products/TemplateEditPage";

export const metadata = { title: "テンプレート編集" };

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
