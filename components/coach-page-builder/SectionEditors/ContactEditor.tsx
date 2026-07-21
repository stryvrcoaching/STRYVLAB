'use client';

import type { ContactContent } from '@/types/coach-page';
import { PhoneCountryField } from '@/components/ui/PhoneCountryField';
import {
  FieldCharCount,
  LIMITS,
} from '@/components/coach-page-builder/FieldCharCount';
import { SectionPresentationEditor } from '@/components/coach-page-builder/SectionPresentationEditor';

interface Props {
  content: ContactContent;
  onChange: (content: ContactContent) => void;
}

export function ContactEditor({ content, onChange }: Props) {
  const set = (field: keyof ContactContent, value: string) =>
    onChange({ ...content, [field]: value || undefined });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <SectionPresentationEditor
        type="contact"
        value={content.presentation}
        onChange={(presentation) => onChange({ ...content, presentation })}
      />

      <div>
        <label style={labelStyle}>Lien de réservation / Calendrier</label>
        <input
          type="url"
          value={content.cal_url ?? ''}
          onChange={e => set('cal_url', e.target.value)}
          placeholder="https://calendly.com/..., https://cal.com/..."
          style={inputStyle}
        />
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px', lineHeight: 1.4 }}>
          Lien vers ton outil de réservation (Calendly, Cal.com, Zoom Scheduler, Google Meet, etc.)
        </p>
      </div>

      <div>
        <label style={labelStyle}>Libellé du bouton principal</label>
        <input
          type="text"
          value={content.custom_cta_label ?? ''}
          onChange={(e) =>
            set(
              'custom_cta_label',
              e.target.value.slice(0, LIMITS.ctaLabel),
            )
          }
          placeholder="Réserver un appel"
          maxLength={LIMITS.ctaLabel}
          style={inputStyle}
        />
        <FieldCharCount
          value={content.custom_cta_label ?? ''}
          max={LIMITS.ctaLabel}
        />
      </div>

      <div>
        <label style={labelStyle}>Email professionnel</label>
        <input
          type="email"
          value={content.email ?? ''}
          onChange={e => set('email', e.target.value)}
          placeholder="coach@exemple.com"
          style={inputStyle}
        />
      </div>

      <PhoneCountryField
        variant="builder"
        label="WhatsApp / Téléphone"
        value={content.whatsapp}
        defaultCountryIso="BE"
        placeholder="470 12 34 56"
        onChange={(e164) => set('whatsapp', e164 ?? '')}
        hint="Choisis l’indicatif (BE +32, FR +33…) puis le numéro national. Stocké en format international."
      />

      <div>
        <label style={labelStyle}>Instagram <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', textTransform: 'none', letterSpacing: 0 }}>(@handle ou URL)</span></label>
        <input
          type="text"
          value={content.instagram ?? ''}
          onChange={e => set('instagram', e.target.value)}
          placeholder="@moncoach"
          style={inputStyle}
        />
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
