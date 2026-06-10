"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import AssessmentForm from "@/components/assessments/form/AssessmentForm";
import { BlockConfig, type ResponseMap } from "@/types/assessment";

interface SubmissionData {
  id: string;
  status: string;
  filled_by: string;
  template_snapshot: BlockConfig[];
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
              : Array.isArray(r.value_json)
                ? (r.value_json as string[])
                : typeof r.value_json === "boolean"
                  ? r.value_json
                  : r.storage_path && r.storage_path.length > 0
                    ? r.storage_path
                    : r.value_text;
          if (val !== null && val !== undefined) {
            map[r.block_id][r.field_key] = val as string | number | string[] | boolean;
          }
        }
        return map;
      })()
    : undefined;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface font-sans flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface font-sans flex items-center justify-center p-6">
        <div className="bg-surface rounded-card shadow-soft-out p-10 text-center max-w-sm w-full">
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
      blocks={data.template_snapshot}
      token={token}
      clientName={`${data.client.first_name} ${data.client.last_name}`}
      isCoach={false}
      initialResponses={initialResponses}
    />
  );
}
