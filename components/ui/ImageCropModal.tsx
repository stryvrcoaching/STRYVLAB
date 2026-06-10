"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X, Check, Loader2, ZoomIn, ZoomOut } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function centerSquareCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, 1, width, height),
    width,
    height,
  );
}

async function getCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  outputSize = 512,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d")!;

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas to blob failed"));
      },
      "image/jpeg",
      0.92,
    );
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ImageCropModalProps {
  file: File;
  onConfirm: (blob: Blob, filename: string) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageCropModal({
  file,
  onConfirm,
  onClose,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [processing, setProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Stable URL — must not change on re-render or crop resets via image reload
  const srcUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(srcUrl), [srcUrl]);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const initial = centerSquareCrop(width, height);
    setCrop(initial);
    // Derive pixel completedCrop immediately — enables confirm without user drag
    const pctCrop = initial as { unit: string; x: number; y: number; width: number; height: number };
    setCompletedCrop({
      unit: 'px',
      x: Math.round((pctCrop.x / 100) * width),
      y: Math.round((pctCrop.y / 100) * height),
      width: Math.round((pctCrop.width / 100) * width),
      height: Math.round((pctCrop.height / 100) * height),
    } as PixelCrop);
  }

  const handleConfirm = useCallback(async () => {
    if (!completedCrop || !imgRef.current) return;
    // Wait for image to be fully loaded before drawing to canvas
    if (!imgRef.current.complete || imgRef.current.naturalWidth === 0) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop);
      const ext = "jpg";
      onConfirm(blob, `identite-visuelle.${ext}`);
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setProcessing(false);
    }
  }, [completedCrop, onConfirm]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-[#181818] border-modal rounded-2xl w-full max-w-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white">
              Recadrer l&apos;image
            </h3>
            <p className="text-[11px] text-white/35 mt-0.5">
              Ajustez le cadre carré — faites glisser ou redimensionner
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        <div className="h-px bg-white/[0.07] shrink-0" />

        {/* Crop area */}
        <div className="flex items-center justify-center bg-[#0a0a0a] p-4 max-h-[60vh] overflow-auto">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            circularCrop={false}
            minWidth={50}
            minHeight={50}
            keepSelection
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={srcUrl}
              alt="Recadrage"
              onLoad={onImageLoad}
              style={{ maxHeight: "55vh", maxWidth: "100%", display: "block" }}
            />
          </ReactCrop>
        </div>

        <div className="h-px bg-white/[0.07] shrink-0" />

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-white/30">
            <ZoomIn size={12} />
            <span>Pincez ou faites glisser les poignées pour ajuster</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white/45 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!completedCrop || processing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#1f8a65] hover:bg-[#217356] disabled:opacity-40 transition-colors"
            >
              {processing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              {processing ? "Traitement…" : "Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
