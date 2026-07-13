import { Suspense } from "react";
import View from "@/features/products/views/products/TemplateListPage";

export const metadata = { title: "テンプレート" };

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
