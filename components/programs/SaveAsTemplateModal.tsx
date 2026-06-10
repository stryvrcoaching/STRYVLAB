"use client";

import { useState } from "react";
import { X, BookmarkPlus, CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  programId: string;
  programName: string;
  onClose: () => void;
  onSaved?: (templateId: string) => void;
}

export default function SaveAsTemplateModal({ programId, programName, onClose, onSaved }: Props) {
  const [name, setName] = useState(programName);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/programs/${programId}/save-as-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      const d = await res.json();
      if (d.template_id) {
        setSuccess(true);
        onSaved?.(d.template_id);
        setTimeout(onClose, 1200);
      } else {
        setError(d.error ?? "Erreur lors de la création du template");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl p-6 w-full max-w-sm">
        {success ? (
          <div className="flex flex-col items-center py-6">
            <CheckCircle2 size={36} className="text-[#1f8a65] mb-3" />
            <p className="font-bold text-[#1f8a65] text-[15px]">Template créé !</p>
            <p className="text-[12px] text-white/40 mt-1">Disponible dans le Studio</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1f8a65]/10 flex items-center justify-center">
                  <BookmarkPlus size={14} className="text-[#1f8a65]" />
                </div>
                <p className="text-[14px] font-bold text-white">Enregistrer comme template</p>
              </div>
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-all"
              >
                <X size={13} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 block mb-1.5">
                  Nom du template
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 h-10 bg-[#0a0a0a] rounded-xl text-[13px] text-white outline-none focus:ring-1 focus:ring-[#1f8a65]/40 placeholder:text-white/20"
                  placeholder="Nom du template…"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 block mb-1.5">
                  Description <span className="text-white/20 normal-case tracking-normal font-normal">(optionnel)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-[#0a0a0a] rounded-xl text-[13px] text-white outline-none focus:ring-1 focus:ring-[#1f8a65]/40 placeholder:text-white/20 resize-none"
                  placeholder="Description courte…"
                />
              </div>

              {error && (
                <p className="text-[11px] text-red-400">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 h-9 rounded-xl bg-white/[0.04] text-[12px] font-medium text-white/50 hover:text-white/70 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={!name.trim() || saving}
                  className="flex-1 h-9 rounded-xl bg-[#1f8a65] text-white text-[12px] font-bold hover:bg-[#217356] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <BookmarkPlus size={13} />}
                  {saving ? "Création…" : "Créer le template"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
