'use client';

import { useState, useRef } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import type { HeroContent } from '@/types/coach-page';
import {
  DEFAULT_COVER_FADE_START,
  DEFAULT_COVER_OPACITY,
  resolveCoverFadeStart,
  resolveCoverOpacity,
} from '@/types/coach-page';
import ImageCropModal from '@/components/ui/ImageCropModal';
import {
  COACH_PAGE_IMAGE_ACCEPT,
  uploadCoachPageImage,
} from '@/lib/coach-page/upload-image';
import {
  UploadFeedback,
  coachPageHintStyle,
} from '@/components/coach-page-builder/UploadFeedback';
import {
  PhotoFramePicker,
} from '@/components/coach-page-builder/PhotoFramePicker';
import {
  resolveCoverHeight,
} from '@/lib/coach-page/photo-frame';
import {
  FieldCharCount,
  LIMITS,
} from '@/components/coach-page-builder/FieldCharCount';

interface Props {
  content: HeroContent;
  coachId: string;
  /**
   * Fallback shown as placeholder when display_name is empty
   * (brand_name || full_name from Profil Pro).
   */
  profileDefaultName?: string;
  onChange: (content: HeroContent) => void;
  onSave?: (content: HeroContent) => Promise<void>;
}

export function HeroEditor({
  content,
  profileDefaultName,
  onChange,
  onSave,
}: Props) {
  const [uploading, setUploading] = useState<'profile' | 'cover' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const defaultNameHint =
    profileDefaultName?.trim() || "Nom de marque ou nom complet (Profil Pro)";

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 3200);
  };

  const persist = async (next: HeroContent, okMessage: string) => {
    onChange(next);
    if (onSave) {
      await onSave(next);
      flash(okMessage);
    } else {
      flash(`${okMessage} — clique Enregistrer pour finaliser`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      setError(null);
      setCropFile(file);
    }
  };

  const handleCropConfirm = async (blob: Blob, filename: string) => {
    setCropFile(null);
    setUploading('profile');
    setError(null);
    try {
      const url = await uploadCoachPageImage(blob, 'profile', filename);
      await persist(
        { ...content, profile_photo_url: url },
        'Photo de profil enregistrée',
      );
    } catch (err) {
      console.error('[hero profile upload error]', err);
      setError(err instanceof Error ? err.message : 'Upload profil impossible');
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading('cover');
    setError(null);
    try {
      const url = await uploadCoachPageImage(file, 'cover', file.name);
      await persist(
        { ...content, cover_photo_url: url },
        'Photo de couverture enregistrée',
      );
    } catch (err) {
      console.error('[hero cover upload error]', err);
      setError(
        err instanceof Error ? err.message : 'Upload couverture impossible',
      );
    } finally {
      setUploading(null);
      e.target.value = '';
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const removeProfile = async () => {
    setError(null);
    try {
      await persist(
        { ...content, profile_photo_url: undefined },
        'Photo de profil retirée',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  const removeCover = async () => {
    setError(null);
    try {
      await persist(
        { ...content, cover_photo_url: undefined },
        'Couverture retirée',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  const busy = uploading !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <UploadFeedback error={error} status={status} />

      {/* Profile photo */}
      <div>
        <label style={labelStyle}>Photo de profil</label>
        {content.profile_photo_url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
                border: '0.3px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={content.profile_photo_url}
                alt="Profil"
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
              onClick={() => void removeProfile()}
              disabled={busy}
              style={dangerBtnStyle}
            >
              <Trash2 size={13} /> Supprimer
            </button>
          </div>
        ) : (
          <label style={{ ...uploadLabelStyle, opacity: busy ? 0.6 : 1 }}>
            <Upload size={14} />
            {uploading === 'profile' ? 'Envoi…' : 'Choisir & Recadrer'}
            <input
              type="file"
              accept={COACH_PAGE_IMAGE_ACCEPT}
              hidden
              onChange={handleFileSelect}
              ref={fileInputRef}
              disabled={busy}
            />
          </label>
        )}
        <p style={coachPageHintStyle}>
          JPG, PNG ou WebP · jusqu’à 25 Mo (compression auto)
        </p>
        <div style={{ marginTop: 12 }}>
          <PhotoFramePicker
            label="Cadre photo de profil"
            value={content.profile_frame}
            defaultValue="rounded"
            allowed={['circle', 'rounded', 'square', 'portrait_4_5', 'portrait_3_4']}
            onChange={(profile_frame) =>
              onChange({ ...content, profile_frame })
            }
          />
        </div>
      </div>

      {/* Display name (H1 under photo) — page-level override of Profil Pro */}
      <div>
        <label style={labelStyle}>Nom principal</label>
        <input
          type="text"
          value={content.display_name ?? ''}
          onChange={(e) =>
            onChange({
              ...content,
              display_name: e.target.value.slice(0, LIMITS.heroDisplayName),
            })
          }
          placeholder={defaultNameHint}
          maxLength={LIMITS.heroDisplayName}
          style={inputStyle}
          className="focus-visible:border-[#1f8a65]/50 focus-visible:shadow-[0_0_0_3px_rgba(31,138,101,0.2)]"
          autoComplete="organization"
        />
        <FieldCharCount
          value={content.display_name ?? ''}
          max={LIMITS.heroDisplayName}
        />
        <p style={coachPageHintStyle}>
          Affiché en grand sous la photo. Laisse vide pour reprendre le nom de
          marque (ou le nom complet) du Profil Pro
          {profileDefaultName?.trim()
            ? ` — actuellement « ${profileDefaultName.trim()} »`
            : ""}
          . Personnalise ici sans modifier les paramètres du compte.
        </p>
      </div>

      {/* Tagline */}
      <div>
        <label style={labelStyle}>Titre / Spécialité</label>
        <input
          type="text"
          value={content.tagline ?? ''}
          onChange={(e) =>
            onChange({
              ...content,
              tagline: e.target.value.slice(0, LIMITS.heroTagline),
            })
          }
          placeholder="Coach sportif & nutrition"
          maxLength={LIMITS.heroTagline}
          style={inputStyle}
          className="focus-visible:border-[#1f8a65]/50 focus-visible:shadow-[0_0_0_3px_rgba(31,138,101,0.2)]"
        />
        <FieldCharCount
          value={content.tagline ?? ''}
          max={LIMITS.heroTagline}
        />
      </div>

      {/* Subtitle */}
      <div>
        <label style={labelStyle}>Sous-titre</label>
        <textarea
          value={content.subtitle ?? ''}
          onChange={(e) =>
            onChange({
              ...content,
              subtitle: e.target.value.slice(0, LIMITS.heroSubtitle),
            })
          }
          placeholder="Une courte phrase qui résume ton approche…"
          maxLength={LIMITS.heroSubtitle}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          className="focus-visible:border-[#1f8a65]/50 focus-visible:shadow-[0_0_0_3px_rgba(31,138,101,0.2)]"
        />
        <FieldCharCount
          value={content.subtitle ?? ''}
          max={LIMITS.heroSubtitle}
        />
      </div>

      {/* Cover photo */}
      <div>
        <label style={labelStyle}>
          Photo de couverture{' '}
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
        {content.cover_photo_url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '80px',
                height: '40px',
                borderRadius: '6px',
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
                border: '0.3px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={content.cover_photo_url}
                alt="Couverture"
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
              onClick={() => void removeCover()}
              disabled={busy}
              style={dangerBtnStyle}
            >
              <Trash2 size={13} /> Supprimer
            </button>
          </div>
        ) : (
          <label style={{ ...uploadLabelStyle, opacity: busy ? 0.6 : 1 }}>
            <Upload size={14} />
            {uploading === 'cover' ? 'Envoi…' : 'Choisir une image'}
            <input
              type="file"
              accept={COACH_PAGE_IMAGE_ACCEPT}
              hidden
              onChange={(ev) => void handleCoverUpload(ev)}
              ref={coverInputRef}
              disabled={busy}
            />
          </label>
        )}
        <p style={coachPageHintStyle}>
          JPG, PNG ou WebP · jusqu’à 25 Mo (compression auto)
        </p>
        {content.cover_photo_url ? (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle} htmlFor="cover-opacity">
                Opacité de la photo
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  id="cover-opacity"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={resolveCoverOpacity(content)}
                  onChange={(e) =>
                    onChange({
                      ...content,
                      cover_opacity: Number(e.target.value),
                    })
                  }
                  style={{
                    flex: 1,
                    accentColor: '#1f8a65',
                    cursor: 'pointer',
                  }}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={resolveCoverOpacity(content)}
                  aria-label="Opacité de la photo de couverture"
                />
                <span
                  style={{
                    minWidth: 40,
                    textAlign: 'right',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.7)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {resolveCoverOpacity(content)}%
                </span>
              </div>
              <p style={coachPageHintStyle}>
                Force globale de la photo : 0&nbsp;% = invisible ·{' '}
                {DEFAULT_COVER_OPACITY}&nbsp;% = défaut · 100&nbsp;% = pleine
                intensité. Indépendant du fondu bas.
              </p>
            </div>

            <div>
              <label style={labelStyle} htmlFor="cover-fade-start">
                Début du fondu bas
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  id="cover-fade-start"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={resolveCoverFadeStart(content)}
                  onChange={(e) =>
                    onChange({
                      ...content,
                      cover_fade_start: Number(e.target.value),
                    })
                  }
                  style={{
                    flex: 1,
                    accentColor: '#1f8a65',
                    cursor: 'pointer',
                  }}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={resolveCoverFadeStart(content)}
                  aria-label="Hauteur de début du dégradé de couverture"
                />
                <span
                  style={{
                    minWidth: 40,
                    textAlign: 'right',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.7)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {resolveCoverFadeStart(content)}%
                </span>
              </div>
              <p style={coachPageHintStyle}>
                Jusqu’à ce % depuis le haut, la photo reste nette. En dessous,
                elle fond vers le fond de page. 100&nbsp;% = aucun fondu (photo
                entière) · {DEFAULT_COVER_FADE_START}&nbsp;% = défaut · 0&nbsp;%
                = fondu dès le haut.
              </p>
            </div>
          </div>
        ) : null}
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle} htmlFor="cover-height">
            Hauteur de la couverture
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <input
              id="cover-height"
              type="range"
              min={0}
              max={100}
              step={1}
              value={resolveCoverHeight(content.cover_frame)}
              onChange={(e) =>
                onChange({
                  ...content,
                  cover_frame: Number(e.target.value),
                })
              }
              style={{
                flex: 1,
                accentColor: '#1f8a65',
                cursor: 'pointer',
              }}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={resolveCoverHeight(content.cover_frame)}
              aria-label="Hauteur de la couverture"
            />
            <span
              style={{
                minWidth: 40,
                textAlign: 'right',
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.7)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {resolveCoverHeight(content.cover_frame) === 100
                ? "Total"
                : `${resolveCoverHeight(content.cover_frame)}%`}
            </span>
          </div>
          <p style={coachPageHintStyle}>
            Proportion de la section accueil occupée par la couverture : 0&nbsp;% = masquée ·{' '}
            60&nbsp;% = moyen (défaut) · 100&nbsp;% = total (pleine hauteur).
          </p>
        </div>
      </div>

      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onConfirm={(blob, filename) => void handleCropConfirm(blob, filename)}
          onClose={() => setCropFile(null)}
        />
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.5)',
  marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0a0a0a',
  border: '0.3px solid rgba(255,255,255,0.06)',
  borderRadius: '12px',
  padding: '10px 12px',
  color: '#ffffff',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
};

const uploadLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: 40,
  padding: '8px 14px',
  background: 'rgba(255,255,255,0.02)',
  border: '0.3px dashed rgba(255,255,255,0.15)',
  borderRadius: '12px',
  color: 'rgba(255,255,255,0.5)',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 150ms ease, border-color 150ms ease, transform 150ms ease',
};

const dangerBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  minHeight: 36,
  padding: '6px 12px',
  background: 'rgba(239,68,68,0.1)',
  border: 'none',
  borderRadius: '12px',
  color: '#ef4444',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 150ms ease, transform 150ms ease',
};
