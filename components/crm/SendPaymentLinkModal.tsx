"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Check, Copy, Send, ExternalLink, Mail, Bell } from "lucide-react";

type SendPaymentLinkModalProps = {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  amount: number;
  formulaName: string;
  paymentId?: string;
  formulaId?: string;
  subscriptionId?: string;
};

export default function SendPaymentLinkModal({
  isOpen,
  onClose,
  clientId,
  amount,
  formulaName,
  paymentId,
  formulaId,
  subscriptionId,
}: SendPaymentLinkModalProps) {
  const [loading, setLoading] = useState(true);
  const [paymentUrl, setPaymentUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Client info state
  const [clientName, setClientName] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string | null>(null);

  // Sending status
  const [sendEmail, setSendEmail] = useState(false);
  const [sendApp, setSendApp] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load client details and generate Stripe link
  useEffect(() => {
    if (!isOpen || !clientId) return;

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");
      setPaymentUrl("");
      setSendSuccess(false);

      try {
        // 1. Fetch client details
        const clientRes = await fetch(`/api/clients/${clientId}`);
        if (!clientRes.ok) throw new Error("Impossible de récupérer les détails du client.");
        const clientData = await clientRes.json();
        if (!active) return;
        setClientName(`${clientData.client.first_name} ${clientData.client.last_name}`);
        setClientEmail(clientData.client.email ?? null);
        setSendEmail(!!clientData.client.email);

        // 2. Generate checkout session
        const checkoutRes = await fetch("/api/stripe/coaching/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            formula_id: formulaId,
            subscription_id: subscriptionId,
            payment_id: paymentId,
            source: "client", // Met à jour redirect URLs pour l'expérience client
          }),
        });

        const checkoutData = await checkoutRes.json();
        if (!active) return;

        if (!checkoutRes.ok) {
          throw new Error(checkoutData.error ?? "Erreur lors de la génération du lien Stripe");
        }

        setPaymentUrl(checkoutData.url);
      } catch (err: any) {
        if (active) setError(err.message ?? "Erreur réseau");
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [isOpen, clientId, formulaId, subscriptionId, paymentId]);

  if (!isOpen) return null;

  async function handleSend() {
    if (!paymentUrl) return;
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/coaching/send-payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          payment_url: paymentUrl,
          formula_name: formulaName,
          amount_eur: amount,
          send_email: sendEmail,
          send_app: sendApp,
          payment_id: paymentId,
          subscription_id: subscriptionId,
          formula_id: formulaId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors de l'envoi de la demande.");
      }

      setSendSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message ?? "Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  function handleCopy() {
    if (!paymentUrl) return;
    navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">
            Demande de règlement Stripe
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 space-y-4">
          <div className="bg-white/[0.02] border-[0.3px] border-white/[0.05] rounded-xl p-3.5 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              Destinataire
            </div>
            <div className="text-[14px] font-semibold text-white">
              {clientName || <span className="text-white/20">Chargement...</span>}
            </div>
            <div className="text-[12px] font-medium text-white/60">
              {formulaName} — <span className="font-mono text-white/90 font-bold">{amount.toFixed(2)} €</span>
            </div>
          </div>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-white/40">
              <Loader2 className="animate-spin text-[#1f8a65]" size={24} />
              <span className="text-xs font-semibold">Génération du lien Stripe sécurisé...</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
              {error}
            </div>
          ) : (
            <>
              {/* Copy URL section */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                  Lien de paiement Stripe
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={paymentUrl}
                    className="flex-1 h-9 px-3 bg-[#0a0a0a] rounded-xl text-[11px] text-white/60 font-mono outline-none border-[0.3px] border-white/[0.06]"
                  />
                  <button
                    onClick={handleCopy}
                    className="h-9 px-3.5 bg-white/[0.04] hover:bg-white/[0.08] text-white rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 border-[0.3px] border-white/[0.06]"
                  >
                    {copied ? (
                      <>
                        <Check size={12} className="text-[#1f8a65]" />
                        <span className="text-[#1f8a65]">Copié</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} className="text-white/50" />
                        <span>Copier</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action options */}
              <div className="space-y-2.5 pt-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                  Méthodes d&apos;envoi
                </label>

                <div className="space-y-2">
                  {/* Email Checkbox */}
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      sendEmail
                        ? "bg-[#1f8a65]/5 border-[#1f8a65]/20 text-white"
                        : "bg-white/[0.01] border-white/[0.04] text-white/50"
                    } ${!clientEmail ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      disabled={!clientEmail}
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                        sendEmail
                          ? "bg-[#1f8a65] border-[#1f8a65]"
                          : "border-white/20"
                      }`}
                    >
                      {sendEmail && <Check size={10} className="text-white" />}
                    </div>
                    <Mail size={14} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold">Par e-mail</div>
                      {clientEmail ? (
                        <div className="text-[10px] text-white/40 truncate">{clientEmail}</div>
                      ) : (
                        <div className="text-[10px] text-red-400/80">Aucun e-mail renseigné</div>
                      )}
                    </div>
                  </label>

                  {/* App Checkbox */}
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      sendApp
                        ? "bg-[#1f8a65]/5 border-[#1f8a65]/20 text-white"
                        : "bg-white/[0.01] border-white/[0.04] text-white/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={sendApp}
                      onChange={(e) => setSendApp(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                        sendApp
                          ? "bg-[#1f8a65] border-[#1f8a65]"
                          : "border-white/20"
                      }`}
                    >
                      {sendApp && <Check size={10} className="text-white" />}
                    </div>
                    <Bell size={14} className="shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-bold">Dans l&apos;application client</div>
                      <div className="text-[10px] text-white/40">Notification PWA Stryvr</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-3 border-t border-white/[0.05]">
                <button
                  onClick={() => window.open(paymentUrl, "_blank")}
                  className="flex-1 h-10 px-4 bg-white/[0.03] hover:bg-white/[0.06] text-white rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 border border-white/[0.05]"
                >
                  <ExternalLink size={13} className="text-white/50" />
                  Ouvrir Stripe
                </button>

                <button
                  onClick={handleSend}
                  disabled={sending || sendSuccess || (!sendEmail && !sendApp)}
                  className="flex-1 h-10 px-4 bg-[#1f8a65] hover:bg-[#217356] disabled:opacity-40 text-white rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  {sending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Envoi...</span>
                    </>
                  ) : sendSuccess ? (
                    <>
                      <Check size={13} />
                      <span>Envoyé !</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Envoyer</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
