"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SECTION_IDS = ["tool-counts", "layout", "process", "video", "wagon", "notes"];

export default function EditButton({ processCode }: { processCode: string }) {
  const [currentSection, setCurrentSection] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCurrentSection(entry.target.id);
          }
        }
      },
      { threshold: 0.3 },
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const href = currentSection
    ? `/manual/${encodeURIComponent(processCode)}/edit#${currentSection}`
    : `/manual/${encodeURIComponent(processCode)}/edit`;

  return (
    <Link
      href={href}
      className="shrink-0 rounded-md bg-white px-3 py-1 text-sm font-medium text-blue-600 hover:bg-slate-100"
    >
      編集
    </Link>
  );
}
