"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download, Loader2, QrCode } from "lucide-react";
import QRCode from "qrcode";

/**
 * Client-side QR generation (data URL).
 * Avoids external qrserver.com which is blocked by the app CSP img-src.
 */
export function QrShareCard({
  pageUrl,
  accentColor,
}: {
  pageUrl: string;
  accentColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !pageUrl) return;

    let cancelled = false;
    setError(null);

    QRCode.toDataURL(pageUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: "#f2f2f2",
        light: "#121212",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setQrSrc(url);
      })
      .catch(() => {
        if (!cancelled) {
          setQrSrc(null);
          setError("Impossible de générer le QR code");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, pageUrl]);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0a0a0a] p-3.5">
      <button
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg text-left transition-colors duration-150 hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 active:scale-[0.99]"
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-white/50">
          <QrCode className="h-3.5 w-3.5" style={{ color: accentColor }} aria-hidden />
          QR code
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-white/35">
          {open ? "Masquer" : "Afficher"}
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col items-center gap-3">
          {error ? (
            <p className="text-center text-[11px] text-red-400/80">{error}</p>
          ) : !qrSrc ? (
            <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-white/[0.08] bg-[#121212]">
              <Loader2 className="h-5 w-5 animate-spin text-white/30" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`QR code vers ${pageUrl}`}
              className="h-40 w-40 rounded-xl border border-white/[0.08] bg-[#121212] p-2"
              height={160}
              src={qrSrc}
              width={160}
            />
          )}
          {qrSrc && (
            <a
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] font-medium text-white/60 transition-colors hover:text-white"
              download="stryv-page-qr.png"
              href={qrSrc}
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger
            </a>
          )}
          <p className="text-center text-[10px] leading-4 text-white/30">
            À mettre en story, en bas de mail ou en salle.
          </p>
        </div>
      )}
    </div>
  );
}
