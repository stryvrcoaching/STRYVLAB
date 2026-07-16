"use client";

import { useState, useEffect, useRef, type ChangeEvent, type DragEvent } from "react";
import { Loader2, Plus, Edit2, Trash2, X, Check, HelpCircle, Upload, Image as ImageIcon, Clock3, Zap } from "lucide-react";
import useTimedActionFeedback from "@/components/ui/useTimedActionFeedback";
import ActionFeedbackBadge from "@/components/ui/ActionFeedbackBadge";

type Reward = {
  id: string;
  title: string;
  description: string | null;
  cost_points: number;
  icon_name: string | null;
  image_url: string | null;
  is_active: boolean;
  reward_type: "digital" | "physical";
  fulfillment_mode: "manual" | "automatic";
  delivery_url: string | null;
};

type Redemption = {
  id: string;
  redeemed_at: string;
  coach_rewards: { title: string; cost_points: number } | null;
  coach_clients: { first_name: string | null; last_name: string | null } | null;
  shipping_recipient_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_postal_code: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  shipping_phone: string | null;
};

const inputCls = "w-full h-11 px-4 bg-[#0a0a0a] border-input rounded-xl text-sm text-white outline-none placeholder:text-white/20 transition-colors";
const labelCls = "block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-1.5";

const EMOJI_LIBRARY = ["🎁", "🏆", "👕", "🥤", "👟", "🎫", "🏋️‍♂️", "🧘‍♀️", "🥗", "🔋", "📘", "🎒", "🔥", "💎"];
const POINTS_GUIDE = [
  { icon: "🏋️‍♂️", title: "Entraînement prescrit", value: "≈ 45%", detail: "la part est répartie entre les séances prévues" },
  { icon: "🥗", title: "Journée nutritionnelle", value: "≈ 45%", detail: "selon la cohérence avec les objectifs du jour" },
  { icon: "☀️", title: "Check-in", value: "≈ 10%", detail: "petit bonus, jamais déterminant" },
  { icon: "📝", title: "Bilan demandé", value: "+25 pts", detail: "lorsqu’il est complété, même en retard" },
];
const SHOP_STEPS = [
  "Le client suit les actions réellement prévues dans son accompagnement.",
  "STRYVR attribue des points selon l’adhérence, pas au nombre de clics.",
  "Le client consulte la boutique dans son profil.",
  "Il échange ses points contre le cadeau configuré par le coach, avec validation ou accès instantané.",
];

export default function CoachRewardsSection() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [pace, setPace] = useState<'fast' | 'balanced' | 'demanding'>('balanced');
  const [savingPace, setSavingPace] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<"device" | "url">("device");
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [costPoints, setCostPoints] = useState<number | "">(100);
  const [iconName, setIconName] = useState("🎁");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [rewardType, setRewardType] = useState<"digital" | "physical">("digital");
  const [fulfillmentMode, setFulfillmentMode] = useState<"manual" | "automatic">("manual");
  const [deliveryUrl, setDeliveryUrl] = useState("");
  
  const [saving, setSaving] = useState(false);
  const { feedback: toast, pushFeedback: pushToast } = useTimedActionFeedback<null>(3500);

  async function uploadFile(file: File) {
    if (!file) return;

    setUploadingFile(true);
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/coach/rewards/upload-image", {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        setImageUrl(data.url);
        pushToast(null, "success", "Image téléversée avec succès");
      } else {
        const errorData = await res.json().catch(() => ({}));
        pushToast(null, "error", errorData.error || "Erreur lors du téléversement");
      }
    } catch (err) {
      console.error(err);
      pushToast(null, "error", "Erreur réseau");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = "";
  }

  async function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  useEffect(() => {
    fetchRewards();
    fetchRedemptions();
    fetch('/api/coach/rewards/settings').then((res) => res.ok ? res.json() : null).then((data) => {
      if (data?.settings?.pace) setPace(data.settings.pace);
    }).catch(() => undefined);
  }, []);

  async function updatePace(nextPace: 'fast' | 'balanced' | 'demanding') {
    if (nextPace === pace || savingPace) return;
    setSavingPace(true);
    const res = await fetch('/api/coach/rewards/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pace: nextPace }),
    });
    if (res.ok) {
      setPace(nextPace);
      pushToast(null, 'success', 'Rythme de progression mis à jour');
    } else {
      const data = await res.json().catch(() => ({}));
      pushToast(null, 'error', data.error || 'Le rythme ne peut pas encore être modifié');
    }
    setSavingPace(false);
  }

  async function fetchRewards() {
    setLoading(true);
    const res = await fetch("/api/coach/rewards");
    if (res.ok) {
      const { rewards } = await res.json();
      setRewards(rewards ?? []);
    }
    setLoading(false);
  }

  async function fetchRedemptions() {
    const res = await fetch('/api/coach/rewards/redemptions', { cache: 'no-store' });
    if (res.ok) {
      const { redemptions: next } = await res.json();
      setRedemptions(next ?? []);
    }
  }

  async function resolveRedemption(id: string, status: 'fulfilled' | 'cancelled') {
    const res = await fetch('/api/coach/rewards/redemptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      pushToast(null, 'success', status === 'fulfilled' ? 'Récompense validée' : 'Demande refusée, points recrédités');
      await fetchRedemptions();
    } else {
      const data = await res.json().catch(() => ({}));
      pushToast(null, 'error', data.error || 'Impossible de traiter la demande');
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setCostPoints(100);
    setIconName("🎁");
    setImageUrl("");
    setIsActive(true);
    setRewardType("digital");
    setFulfillmentMode("manual");
    setDeliveryUrl("");
    setEditingId(null);
    setShowForm(false);
    setUploadingFile(false);
  }

  function handleEdit(r: Reward) {
    setTitle(r.title);
    setDescription(r.description || "");
    setCostPoints(r.cost_points);
    setIconName(r.icon_name || "🎁");
    setImageUrl(r.image_url || "");
    setIsActive(r.is_active);
    setRewardType(r.reward_type || "digital");
    setFulfillmentMode(r.fulfillment_mode || "manual");
    setDeliveryUrl(r.delivery_url || "");
    setEditingId(r.id);
    setShowForm(true);
  }

  async function handleSave() {
    const finalCost = costPoints === "" ? 0 : Number(costPoints);
    if (!title || finalCost < 0) return;
    setSaving(true);
    
    const payload = {
      title,
      description: description || null,
      cost_points: finalCost,
      icon_name: iconName || null,
      image_url: imageUrl || null,
      is_active: isActive,
      reward_type: rewardType,
      fulfillment_mode: fulfillmentMode,
      delivery_url: fulfillmentMode === "automatic" ? deliveryUrl.trim() || null : null,
    };

    const url = "/api/coach/rewards";
    const method = editingId ? "PATCH" : "POST";
    const body = editingId ? { id: editingId, ...payload } : payload;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (res.ok) {
      pushToast(null, "success", editingId ? "Récompense modifiée" : "Récompense ajoutée");
      await fetchRewards();
      resetForm();
    } else {
      pushToast(null, "error", "Erreur lors de la sauvegarde");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette récompense ?")) return;
    const res = await fetch(`/api/coach/rewards?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      pushToast(null, "success", "Récompense supprimée");
      await fetchRewards();
    } else {
      pushToast(null, "error", "Erreur lors de la suppression");
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-white/30" /></div>;
  }

  const isDeliveryUrlValid = (() => {
    if (fulfillmentMode !== "automatic") return true;
    if (!deliveryUrl.trim()) return true;
    try {
      const url = new URL(deliveryUrl.trim());
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  })();
  const isFormInvalid = !title || costPoints === "" || Number(costPoints) < 0 || !isDeliveryUrlValid;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#1f8a65]/20 bg-[linear-gradient(135deg,rgba(31,138,101,0.12),rgba(255,255,255,0.03))] overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white">
              <HelpCircle size={16} className="text-[#7ee2bb]" />
              <p className="text-sm font-semibold">Comment fonctionne la boutique de récompenses ?</p>
            </div>
            <p className="max-w-2xl text-[12px] leading-relaxed text-white/68">
              Les clients gagnent des points automatiquement dans STRYVR, puis les échangent contre les cadeaux que vous définissez ici. Pour un accès digital, vous pouvez leur remettre le lien automatiquement.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] text-white/55">
              <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">Points ajoutés automatiquement</span>
              <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">Coût défini par le coach</span>
              <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">Échange depuis l&apos;app client</span>
              <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">Validation manuelle ou automatique</span>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="rounded-xl border border-[#1f8a65]/30 bg-[#1f8a65]/12 px-3 py-2 text-[11px] font-semibold text-[#b7f4dc] transition-colors hover:bg-[#1f8a65]/18"
            >
              Guide complet
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-white">Rythme de progression</p><p className="mt-1 text-[11px] leading-relaxed text-white/50">Ajuste tous les gains futurs, sans modifier l’historique. Modification possible toutes les 4 semaines.</p></div>
          <div className="flex rounded-xl border border-white/[0.08] bg-black/20 p-1">
            {([
              ['fast', 'Rapide', '×1,15'], ['balanced', 'Équilibré', '×1'], ['demanding', 'Exigeant', '×0,85'],
            ] as const).map(([value, label, multiplier]) => <button key={value} type="button" disabled={savingPace} onClick={() => updatePace(value)} className={`rounded-lg px-2.5 py-1.5 text-left transition-colors ${pace === value ? 'bg-[#1f8a65] text-white' : 'text-white/50 hover:text-white'}`}><span className="block text-[10px] font-semibold">{label}</span><span className="block text-[9px] opacity-70">{multiplier}</span></button>)}
          </div>
        </div>
      </section>

      {redemptions.length > 0 && (
        <section className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Clock3 size={16} className="text-amber-300" /><h3 className="text-sm font-semibold text-white">Demandes à traiter</h3></div>
            <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[10px] font-bold text-amber-200">{redemptions.length}</span>
          </div>
          <div className="mt-3 grid gap-2">
            {redemptions.map((redemption) => {
              const clientName = [redemption.coach_clients?.first_name, redemption.coach_clients?.last_name].filter(Boolean).join(' ') || 'Client';
              const shippingAddress = [
                redemption.shipping_recipient_name,
                redemption.shipping_address_line1,
                redemption.shipping_address_line2,
                [redemption.shipping_postal_code, redemption.shipping_city].filter(Boolean).join(' '),
                redemption.shipping_country,
              ].filter(Boolean).join(' · ');
              return (
                <div key={redemption.id} className="flex flex-col gap-3 rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="text-[13px] font-medium text-white">{clientName} · {redemption.coach_rewards?.title ?? 'Récompense'}</p><p className="mt-1 text-[11px] text-white/45">{redemption.coach_rewards?.cost_points ?? 0} points débités · en attente de validation</p>{shippingAddress && <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-[#b7f4dc]">Livraison : {shippingAddress}{redemption.shipping_phone ? ` · ${redemption.shipping_phone}` : ''}</p>}</div>
                  <div className="flex shrink-0 gap-2"><button type="button" onClick={() => resolveRedemption(redemption.id, 'cancelled')} className="rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] font-medium text-white/65 hover:bg-white/[0.06]">Refuser</button><button type="button" onClick={() => resolveRedemption(redemption.id, 'fulfilled')} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-black hover:bg-white/90"><Check size={13} /> Valider</button></div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!showForm ? (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border-button hover:bg-white/[0.10] text-xs font-semibold text-white/70 hover:text-white transition-colors"
            >
              <Plus size={14} /> Ajouter un cadeau
            </button>
          </div>

          {rewards.length === 0 ? (
            <div className="text-center py-8 rounded-xl bg-white/[0.02] border-subtle">
              <p className="text-sm text-white/40">Aucune récompense configurée.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {rewards.map((r) => (
                <div key={r.id} className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${r.is_active ? 'bg-[#0a0a0a] border-white/[0.06]' : 'bg-transparent border-white/[0.03] opacity-50'}`}>
                  <div className="flex items-center gap-4">
                    {r.image_url ? (
                      <div className="relative w-12 h-12 rounded-xl border border-white/10 overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                        <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="text-3xl shrink-0">{r.icon_name || "🎁"}</div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        {r.title} {!r.is_active && <span className="text-[9px] uppercase tracking-wider text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded border border-red-400/20">Inactif</span>}
                      </p>
                      {r.description && <p className="text-[11px] text-white/50 mt-0.5">{r.description}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-[12px] font-semibold text-[#ffd700]">{r.cost_points} pts</p>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/48">{r.reward_type === "physical" ? "Physique" : "Digital"}</span>
                        {r.fulfillment_mode === "automatic" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#1f8a65]/25 bg-[#1f8a65]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#a8f1d3]">
                            <Zap size={10} /> Validation auto
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(r)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="p-5 rounded-2xl bg-white/[0.02] border-subtle space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white">{editingId ? "Modifier le cadeau" : "Nouveau cadeau"}</h3>
            <button onClick={resetForm} className="text-white/40 hover:text-white p-1"><X size={16}/></button>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <label className={labelCls}>Nom du cadeau</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="T-shirt STRYVR" className={inputCls} />
            </div>
            <div className="col-span-1">
              <label className={labelCls}>Emoji</label>
              <input value={iconName} onChange={e => setIconName(e.target.value)} placeholder="🎁" className={`${inputCls} text-center text-lg`} />
            </div>
          </div>

          <div>
            <span className="text-[9px] uppercase tracking-wider text-white/30 block mb-1">Bibliothèque d'icônes</span>
            <div className="flex flex-wrap gap-1.5 p-2 bg-[#050505] rounded-xl border border-white/5">
              {EMOJI_LIBRARY.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIconName(emoji)}
                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all hover:bg-white/10 active:scale-90 ${iconName === emoji ? 'bg-white/10 border border-white/10 scale-105' : ''}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Image personnalisée (Optionnel)</label>
            <div className="space-y-3">
              {imageUrl ? (
                <div className="flex items-center gap-4 p-3 bg-black/45 rounded-xl border border-white/10">
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                    <img src={imageUrl} alt="Prévisualisation" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <p className="text-[10px] text-white/50 truncate max-w-[250px] sm:max-w-[400px]">
                      {imageUrl}
                    </p>
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="text-[11px] font-bold text-red-400 hover:text-red-300 text-left transition-colors"
                    >
                      Supprimer l'image
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setImageInputMode("device")}
                    className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors ${imageInputMode === "device" ? "bg-[#1f8a65]/14 text-[#a8f1d3] border border-[#1f8a65]/25" : "bg-white/[0.04] text-white/58 border border-white/[0.06] hover:bg-white/[0.07]"}`}
                  >
                    Depuis mon appareil
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInputMode("url")}
                    className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors ${imageInputMode === "url" ? "bg-[#1f8a65]/14 text-[#a8f1d3] border border-[#1f8a65]/25" : "bg-white/[0.04] text-white/58 border border-white/[0.06] hover:bg-white/[0.07]"}`}
                  >
                    Depuis une URL
                  </button>
                </div>

                {imageInputMode === "device" ? (
                  <div className="mt-3 space-y-3">
                    <label
                      onClick={() => {
                        if (!uploadingFile) galleryInputRef.current?.click();
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                      className={`flex min-h-[152px] flex-col items-center justify-center rounded-2xl border border-dashed px-4 text-center transition-all ${dragActive ? "border-[#7ee2bb] bg-[#1f8a65]/10" : "border-white/10 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.03]"} ${uploadingFile ? "pointer-events-none opacity-75" : "cursor-pointer"}`}
                    >
                      {uploadingFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 size={18} className="animate-spin text-[#1f8a65]" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Import en cours...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                            <Upload size={18} className="text-white/55" />
                          </div>
                          <p className="text-[12px] font-semibold text-white">Importer depuis votre téléphone ou votre ordinateur</p>
                          <p className="max-w-md text-[11px] leading-relaxed text-white/45">
                            Touchez pour choisir une image, ou glissez-déposez un fichier depuis votre ordinateur.
                          </p>
                          <p className="text-[10px] text-white/28">JPEG, PNG, WebP ou GIF, jusqu&apos;à 10 Mo</p>
                        </div>
                      )}
                    </label>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={uploadingFile}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[11px] font-semibold text-white/72 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                      >
                        <ImageIcon size={14} />
                        Choisir dans l&apos;appareil
                      </button>
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={uploadingFile}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[11px] font-semibold text-white/72 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                      >
                        <Upload size={14} />
                        Prendre ou ajouter une photo
                      </button>
                    </div>

                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col justify-center rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Coller le lien d&apos;une image</span>
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/image.png"
                      className="w-full h-10 px-3 bg-[#0a0a0a] border border-white/5 rounded-lg text-xs text-white outline-none placeholder:text-white/20 focus:border-white/10 transition-colors"
                    />
                    <p className="text-[10px] leading-relaxed text-white/30">
                      Utilisez cette option uniquement si l&apos;image est déjà hébergée en ligne.
                    </p>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-white/30 leading-normal">
                L&apos;import local est recommandé pour ajouter rapidement une image depuis un téléphone ou un ordinateur. L&apos;URL reste disponible si vous utilisez une image déjà hébergée.
              </p>
            </div>
          </div>

          <div>
            <label className={labelCls}>Description (optionnel)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Taille au choix, livraison offerte..." className={inputCls} />
          </div>

          <fieldset>
            <legend className={labelCls}>Type de récompense</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setRewardType("digital")} className={`rounded-xl border p-3 text-left transition-colors ${rewardType === "digital" ? "border-[#1f8a65]/35 bg-[#1f8a65]/[0.08]" : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                <p className="text-[12px] font-semibold text-white">Digital</p><p className="mt-1 text-[10px] leading-relaxed text-white/48">Accès, document, code ou contenu en ligne.</p>
              </button>
              <button type="button" onClick={() => { setRewardType("physical"); setFulfillmentMode("manual"); }} className={`rounded-xl border p-3 text-left transition-colors ${rewardType === "physical" ? "border-[#1f8a65]/35 bg-[#1f8a65]/[0.08]" : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                <p className="text-[12px] font-semibold text-white">Physique</p><p className="mt-1 text-[10px] leading-relaxed text-white/48">Objet à envoyer : le client confirme son adresse au moment de la demande.</p>
              </button>
            </div>
          </fieldset>

          <div className={`rounded-xl border p-3 transition-colors ${fulfillmentMode === "automatic" ? "border-[#1f8a65]/35 bg-[#1f8a65]/[0.08]" : "border-white/[0.07] bg-white/[0.02]"}`}>
            <label className="flex cursor-pointer items-start justify-between gap-4" htmlFor="reward-automatic-validation">
              <span>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white"><Zap size={13} className="text-[#7ee2bb]" /> Validation automatique</span>
                <span className="mt-1 block text-[10px] leading-relaxed text-white/50">{rewardType === "physical" ? "Les récompenses physiques nécessitent une confirmation de livraison et restent à valider par le coach." : "Le client obtient cette récompense dès l'échange de ses points. Désactivez cette option pour garder votre approbation."}</span>
              </span>
              <input
                id="reward-automatic-validation"
                type="checkbox"
                checked={fulfillmentMode === "automatic"}
                onChange={(event) => setFulfillmentMode(event.target.checked ? "automatic" : "manual")}
                disabled={rewardType === "physical"}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 bg-black accent-[#1f8a65]"
              />
            </label>
          </div>

          {rewardType === "digital" && fulfillmentMode === "automatic" && (
            <div className="rounded-xl border border-[#1f8a65]/20 bg-[#1f8a65]/[0.06] p-3">
              <label className={labelCls}>Lien de remise immédiate (optionnel)</label>
              <input
                type="url"
                value={deliveryUrl}
                onChange={(e) => setDeliveryUrl(e.target.value)}
                placeholder="https://votre-site.com/acces-produit"
                className={inputCls}
                aria-describedby="automatic-delivery-help"
              />
              <p id="automatic-delivery-help" className="mt-2 text-[10px] leading-relaxed text-white/48">
                Dès que le client échange ses points, STRYVR valide la récompense. Si vous ajoutez ce lien, il lui est aussi affiché immédiatement. Sans lien, la récompense est simplement obtenue sans attendre votre approbation.
              </p>
              {!isDeliveryUrlValid && <p className="mt-2 text-[10px] font-medium text-red-300">Ajoutez une URL valide commençant par http:// ou https://.</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Coût (Points)</label>
              <input 
                type="number" 
                min="0" 
                value={costPoints} 
                onChange={e => setCostPoints(e.target.value === "" ? "" : Number(e.target.value))} 
                className={inputCls} 
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-6">
              <span className="text-[12px] font-bold text-white/70">Activer ?</span>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative w-10 h-6 rounded-full transition-colors ${isActive ? "bg-[#1f8a65]" : "bg-white/[0.10]"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isActive ? "left-5" : "left-1"}`} />
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4 gap-2 border-t border-white/[0.05]">
            <button onClick={resetForm} className="px-4 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] text-sm text-white/70 transition-colors">
              Annuler
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving || isFormInvalid} 
              className="flex items-center gap-2 px-6 h-10 rounded-xl bg-[#1f8a65] hover:bg-[#217356] text-white text-sm font-bold disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <ActionFeedbackBadge tone={toast.tone} message={toast.message} className="px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-md" />
        </div>
      )}

      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#101010] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7ee2bb]">Guide coach</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Comprendre la boutique de récompenses</h3>
                <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-white/52">
                  Ce module permet de transformer les actions du client en points, puis les points en cadeaux que vous décidez.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 text-white/45 transition-colors hover:text-white hover:bg-white/[0.07]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-5 py-5">
              <section className="grid gap-3 md:grid-cols-4">
                {SHOP_STEPS.map((step, index) => (
                  <div key={step} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7ee2bb]">Étape {index + 1}</p>
                    <p className="mt-2 text-[12px] leading-relaxed text-white/72">{step}</p>
                  </div>
                ))}
              </section>

              <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">Barème indicatif visible par le coach</p>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {POINTS_GUIDE.map((item) => (
                    <div key={item.title} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
                      <span className="text-lg">{item.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[12px] font-semibold text-white">{item.title}</p>
                          <span className="text-[11px] font-bold text-[#ffd700]">{item.value}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-white/48">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">Conseil de configuration</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/68">
                    Fixez un coût cohérent avec la fréquence d&apos;engagement attendue. Un cadeau simple peut être accessible rapidement, tandis qu&apos;un cadeau premium doit demander plusieurs semaines de régularité.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">Images des cadeaux</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/68">
                    Vous pouvez importer une image directement depuis le téléphone ou l&apos;ordinateur du coach, ou coller une URL si l&apos;image existe déjà en ligne.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1f8a65]/20 bg-[#1f8a65]/[0.05] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8f1d3]">Validation automatique</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/68">
                    Cochez cette option lorsque vous ne souhaitez pas valider chaque demande. Pour un produit digital, ajoutez aussi son lien afin qu&apos;il soit remis au client immédiatement.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
