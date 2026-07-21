'use client';

import { useState } from 'react';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import type { GalleryContent } from '@/types/coach-page';
import {
  COACH_PAGE_IMAGE_ACCEPT,
  COACH_PAGE_MAX_SOURCE_BYTES,
  uploadCoachPageImage,
} from '@/lib/coach-page/upload-image';
import {
  UploadFeedback,
  coachPageHintStyle,
} from '@/components/coach-page-builder/UploadFeedback';
import { PhotoFramePicker } from '@/components/coach-page-builder/PhotoFramePicker';
import { SectionPresentationEditor } from '@/components/coach-page-builder/SectionPresentationEditor';

interface Props {
  content: GalleryContent;
  coachId: string;
  onChange: (content: GalleryContent) => void;
  onSave?: (content: GalleryContent) => Promise<void>;
}

const MAX_PHOTOS = 6;

export function GalleryEditor({ content, onChange, onSave }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const photos = content.photo_urls ?? [];

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 3500);
  };

  const persist = async (next: GalleryContent) => {
    onChange(next);
    if (onSave) {
      try {
        await onSave(next);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Photos visibles ici mais non enregistrées — clique Enregistrer.',
        );
        throw err;
      }
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_PHOTOS} photos.`);
      e.target.value = '';
      return;
    }

    const toUpload = files.slice(0, remaining);
    setUploading(true);
    setError(null);
    setStatus(null);

    const newUrls: string[] = [];
    const failures: string[] = [];

    try {
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        setStatus(`Envoi ${i + 1}/${toUpload.length}…`);
        try {
          if (file.size > COACH_PAGE_MAX_SOURCE_BYTES) {
            throw new Error(
              `trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo, max 25 Mo)`,
            );
          }
          const url = await uploadCoachPageImage(file, 'gallery', file.name);
          newUrls.push(url);
        } catch (err) {
          failures.push(
            `${file.name || 'Photo'} : ${err instanceof Error ? err.message : 'échec'}`,
          );
        }
      }

      if (newUrls.length > 0) {
        await persist({ ...content, photo_urls: [...photos, ...newUrls] });
        flash(
          newUrls.length === 1
            ? 'Photo ajoutée et enregistrée'
            : `${newUrls.length} photos ajoutées et enregistrées`,
        );
      }

      if (failures.length > 0) {
        setError(failures.join(' · '));
      } else if (newUrls.length === 0) {
        setError('Aucune photo n’a pu être ajoutée.');
      }
    } catch (err) {
      console.error('[gallery upload error]', err);
      if (!error) {
        setError(
          err instanceof Error
            ? err.message
            : 'Erreur réseau pendant l’upload. Réessaie.',
        );
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = async (idx: number) => {
    setError(null);
    try {
      const next = photos.filter((_, i) => i !== idx);
      await persist({ ...content, photo_urls: next });
      flash('Photo retirée');
    } catch {
      /* error already set in persist */
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionPresentationEditor
        type="gallery"
        value={content.presentation}
        onChange={(presentation) => onChange({ ...content, presentation })}
      />

      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
        {photos.length} / {MAX_PHOTOS} photos
      </p>
      <p style={{ ...coachPageHintStyle, margin: 0 }}>
        JPG, PNG ou WebP · jusqu’à 25 Mo par image (compression auto)
      </p>

      <PhotoFramePicker
        label="Cadre des photos (toutes)"
        value={content.photo_frame}
        defaultValue="portrait_4_5"
        onChange={(photo_frame) => {
          const next = { ...content, photo_frame };
          onChange(next);
          void onSave?.(next);
        }}
      />

      <UploadFeedback error={error} status={status} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
        }}
      >
        {photos.map((url, i) => (
          <div
            key={`${url.slice(0, 48)}-${i}`}
            style={{
              position: 'relative',
              aspectRatio: '1',
              borderRadius: '12px',
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.02)',
              border: '0.3px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <button
              type="button"
              onClick={() => void removePhoto(i)}
              disabled={uploading}
              style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                background: 'rgba(0,0,0,0.65)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px',
                cursor: 'pointer',
                color: '#ffffff',
                display: 'flex',
              }}
              title="Supprimer"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <label
            style={{
              aspectRatio: '1',
              borderRadius: '12px',
              border: '0.3px dashed rgba(255,255,255,0.15)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: uploading ? 'wait' : 'pointer',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '11px',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            {uploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={20} />
            )}
            <span>{uploading ? 'Envoi…' : 'Ajouter'}</span>
            <input
              type="file"
              accept={COACH_PAGE_IMAGE_ACCEPT}
              multiple
              hidden
              onChange={(ev) => void handleUpload(ev)}
              disabled={uploading}
            />
          </label>
        )}
      </div>
    </div>
  );
}
