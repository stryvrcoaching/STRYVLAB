'use client';

import { useState, useRef } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import type { AboutContent } from '@/types/coach-page';
import {
  COACH_PAGE_IMAGE_ACCEPT,
  uploadCoachPageImage,
} from '@/lib/coach-page/upload-image';
import {
  UploadFeedback,
  coachPageHintStyle,
} from '@/components/coach-page-builder/UploadFeedback';
import { PhotoFramePicker } from '@/components/coach-page-builder/PhotoFramePicker';
import { SectionPresentationEditor } from '@/components/coach-page-builder/SectionPresentationEditor';
import {
  FieldCharCount,
  LIMITS,
} from '@/components/coach-page-builder/FieldCharCount';

interface Props {
  content: AboutContent;
  coachId: string;
  onChange: (content: AboutContent) => void;
  onSave?: (content: AboutContent) => Promise<void>;
}

export function AboutEditor({ content, onChange, onSave }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 3200);
  };

  const persist = async (next: AboutContent, okMessage: string) => {
    onChange(next);
    if (onSave) {
      await onSave(next);
      flash(okMessage);
    } else {
      flash(`${okMessage} — clique Enregistrer pour finaliser`);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadCoachPageImage(file, 'about', file.name);
      await persist({ ...content, photo_url: url }, 'Photo enregistrée');
    } catch (err) {
      console.error('[about photo upload error]', err);
      setError(err instanceof Error ? err.message : 'Upload impossible');
    } finally {
      setUploading(false);
      e.target.value = '';
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removePhoto = async () => {
    setError(null);
    try {
      await persist({ ...content, photo_url: undefined }, 'Photo retirée');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <UploadFeedback error={error} status={status} />

      <SectionPresentationEditor
        type="about"
        value={content.presentation}
        onChange={(presentation) => onChange({ ...content, presentation })}
      />

      <div>
        <label style={labelStyle}>Présentation</label>
        <textarea
          value={content.text ?? ''}
          onChange={(e) =>
            onChange({
              ...content,
              text: e.target.value.slice(0, LIMITS.aboutText),
            })
          }
          placeholder="Parle de ton parcours, ta méthode, ta philosophie…"
          maxLength={LIMITS.aboutText}
          rows={8}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65 }}
        />
        <FieldCharCount value={content.text ?? ''} max={LIMITS.aboutText} />
      </div>

      <div>
        <label style={labelStyle}>
          Photo{' '}
          <span
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: '11px',
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            (optionnelle)
          </span>
        </label>
        {content.photo_url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '60px',
                height: '75px',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
                border: '0.3px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={content.photo_url}
                alt="À propos"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void removePhoto()}
              disabled={uploading}
              style={dangerBtnStyle}
            >
              <Trash2 size={13} /> Supprimer
            </button>
          </div>
        ) : (
          <label style={{ ...uploadLabelStyle, opacity: uploading ? 0.6 : 1 }}>
            <Upload size={14} />
            {uploading ? 'Envoi…' : 'Ajouter une photo'}
            <input
              ref={inputRef}
              type="file"
              accept={COACH_PAGE_IMAGE_ACCEPT}
              hidden
              onChange={(ev) => void handlePhotoUpload(ev)}
              disabled={uploading}
            />
          </label>
        )}
        <p style={coachPageHintStyle}>
          JPG, PNG ou WebP · jusqu’à 25 Mo (compression auto)
        </p>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Position de la photo</label>
          <select
            value={content.media_position ?? 'right'}
            onChange={(event) =>
              onChange({
                ...content,
                media_position: event.target.value as AboutContent['media_position'],
              })
            }
            style={inputStyle}
          >
            <option value="right">À droite du texte</option>
            <option value="left">À gauche du texte</option>
            <option value="top">Au-dessus du texte</option>
          </select>
        </div>
        <div style={{ marginTop: 12 }}>
          <PhotoFramePicker
            label="Cadre de la photo"
            value={content.photo_frame}
            defaultValue="portrait_4_5"
            onChange={(photo_frame) => onChange({ ...content, photo_frame })}
          />
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0a0a0a',
  border: '0.3px solid rgba(255,255,255,0.06)',
  borderRadius: '12px',
  padding: '9px 12px',
  color: '#ffffff',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
};

const uploadLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  background: 'rgba(255,255,255,0.02)',
  border: '0.3px dashed rgba(255,255,255,0.15)',
  borderRadius: '12px',
  color: 'rgba(255,255,255,0.45)',
  fontSize: '11px',
  cursor: 'pointer',
};

const dangerBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '6px 12px',
  background: 'rgba(239,68,68,0.1)',
  border: 'none',
  borderRadius: '12px',
  color: '#ef4444',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
};
