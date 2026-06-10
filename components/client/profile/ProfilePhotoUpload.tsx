"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useClientT } from "../ClientI18nProvider";

interface Props {
  currentUrl: string | null;
  initials: string;
  compact?: boolean;
}

export default function ProfilePhotoUpload({ currentUrl, initials, compact = false }: Props) {
  const { t } = useClientT()
  const [url, setUrl] = useState<string | null>(currentUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError(t('profile.photo.error.format'));
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError(t('profile.photo.error.size'));
      return;
    }

    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/client/profile/photo", {
      method: "POST",
      body: form,
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? t('profile.photo.error.upload'));
    } else {
      setUrl(data.url);
    }
    setLoading(false);
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/client/profile/photo", { method: "DELETE" });
    if (res.ok) setUrl(null);
    else setError(t('profile.photo.error.delete'));
    setLoading(false);
  }

  if (compact) {
    return (
      <div className="relative shrink-0">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-[#f2f2f2]/10 flex items-center justify-center">
          {url ? (
            <Image src={url} alt={t('profile.photo.alt')} fill className="object-cover" />
          ) : (
            <span className="text-[16px] font-bold text-[#f2f2f2]">{initials}</span>
          )}
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="absolute bottom-0 right-0 w-5 h-5 bg-[#f2f2f2] text-[#080808] rounded-full flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? <Loader2 size={9} className="animate-spin" /> : <Camera size={9} />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-white/[0.07] flex items-center justify-center">
          {url ? (
            <Image
              src={url}
              alt={t('profile.photo.alt')}
              fill
              className="object-cover"
            />
          ) : (
            <span className="text-2xl font-bold text-white/60">{initials}</span>
          )}
        </div>

        {/* Upload overlay */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="absolute bottom-0 right-0 w-7 h-7 bg-[#f2f2f2] text-[#080808] rounded-full flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Camera size={12} />
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="text-xs text-white/60 font-medium hover:underline disabled:opacity-50"
        >
          {url ? t('profile.photo.change') : t('profile.photo.add')}
        </button>
        {url && (
          <>
            <span className="text-secondary text-xs">·</span>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="text-xs text-red-500 font-medium hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              <Trash2 size={11} />
              {t('profile.photo.delete')}
            </button>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
    </div>
  );
}
