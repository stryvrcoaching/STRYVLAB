"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import AssessmentForm from "@/components/assessments/form/AssessmentForm";
import { BlockConfig, type ResponseMap } from "@/types/assessment";
import { extractTemplateBlocks } from "@/lib/assessments/templateSnapshot";

interface SubmissionData {
  id: string;
  status: string;
  filled_by: string;
  template_snapshot: BlockConfig[] | { name?: string | null; blocks?: BlockConfig[] | null };
  client: { first_name: string; last_name: string };
  responses?: Array<{
    block_id: string;
    field_key: string;
    value_text?: string | null;
    value_number?: number | null;
    value_json?: unknown;
    storage_path?: string;
  }>;
}

export default function BilanPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<SubmissionData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/assessments/public/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Lien invalide");
        else setData(d.submission);
      })
      .catch(() => setError("Erreur réseau"))
      .finally(() => setLoading(false));
  }, [token]);

  // Build ResponseMap from responses
  const initialResponses = data?.responses
    ? (() => {
        const map: ResponseMap = {};
        for (const r of data.responses) {
          if (!map[r.block_id]) map[r.block_id] = {};
          const val =
            r.value_number !== undefined && r.value_number !== null
              ? r.value_number
              : r.value_json !== undefined && r.value_json !== null
                ? (r.value_json as ResponseMap[string][string])
                  : r.storage_path && r.storage_path.length > 0
                    ? r.storage_path
                    : r.value_text;
          if (val !== null && val !== undefined) {
            map[r.block_id][r.field_key] = val;
          }
        }
        return map;
      })()
    : undefined;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface font-sans flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <Image src="/logo/logo-stryvr-silver.png" alt="STRYVR" width={40} height={40} className="h-10 w-10 object-contain" />
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface font-sans flex items-center justify-center p-6">
        <div className="bg-surface rounded-card shadow-soft-out p-10 text-center max-w-sm w-full">
          <Image src="/logo/logo-stryvr-silver.png" alt="STRYVR" width={40} height={40} className="mx-auto mb-5 h-10 w-10 object-contain" />
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-primary mb-2">Lien invalide</h2>
          <p className="text-sm text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <AssessmentForm
      submissionId={data.id}
      blocks={extractTemplateBlocks(data.template_snapshot)}
      token={token}
      clientName={`${data.client.first_name} ${data.client.last_name}`}
      isCoach={false}
      initialResponses={initialResponses}
    />
  );
}
