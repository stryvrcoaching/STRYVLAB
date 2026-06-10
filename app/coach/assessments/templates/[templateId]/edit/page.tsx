"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TemplateBuilder from "@/components/assessments/builder/TemplateBuilder";
import { Skeleton } from "@/components/ui/skeleton";
import { AssessmentTemplate } from "@/types/assessment";

export default function EditTemplatePage() {
  const params = useParams();
  const [template, setTemplate] = useState<AssessmentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/assessments/templates/${params.templateId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.template) setTemplate(d.template);
        else setError("Template introuvable");
      })
      .catch(() => setError("Erreur réseau"))
      .finally(() => setLoading(false));
  }, [params.templateId]);

  if (loading)
    return (
      <main className="min-h-screen bg-[#121212] font-sans">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="bg-[#181818] border-subtle rounded-xl p-6 space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-96" />
              </div>
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>

            {/* Modules skeleton */}
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white/[0.02] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2].map((j) => (
                      <Skeleton key={j} className="h-10 w-full rounded-lg" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  if (error)
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  if (!template) return null;

  return <TemplateBuilder initialTemplate={template} />;
}
