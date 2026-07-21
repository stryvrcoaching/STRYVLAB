'use client';

import type { FormulasContent, PublicFormula } from '@/types/coach-page';
import {
  FieldCharCount,
  LIMITS,
} from '@/components/coach-page-builder/FieldCharCount';
import { SectionPresentationEditor } from '@/components/coach-page-builder/SectionPresentationEditor';

interface Props {
  content: FormulasContent;
  formulas: PublicFormula[];
  onChange: (content: FormulasContent) => void;
  /** Called when a formula is selected so parent can set show_on_page */
  onEnsureVisible?: (formulaId: string) => void;
}

export function FormulasEditor({
  content,
  formulas,
  onChange,
  onEnsureVisible,
}: Props) {
  const selectedIds = content.formula_ids ?? [];

  const toggleFormula = (id: string) => {
    const isSelected = selectedIds.includes(id);
    const next = isSelected
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    onChange({ ...content, formula_ids: next });
    // Selecting a formula for the public page → mark show_on_page
    if (!isSelected) {
      onEnsureVisible?.(id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionPresentationEditor
        type="formulas"
        value={content.presentation}
        onChange={(presentation) => onChange({ ...content, presentation })}
      />

      {/* Formula selector */}
      <div>
        <label style={labelStyle}>
          Formules à afficher
          <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '11px', marginLeft: '6px' }}>
            (non sélectionnée = toutes affichées)
          </span>
        </label>
        {formulas.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>
            Crée d&apos;abord des formules actives dans &quot;Formules&quot;.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {formulas.map((f) => {
              const isChecked =
                selectedIds.length === 0
                  ? Boolean(f.show_on_page)
                  : selectedIds.includes(f.id);
              return (
                <label
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: isChecked
                      ? 'rgba(31,138,101,0.08)'
                      : 'rgba(255,255,255,0.02)',
                    border: isChecked
                      ? '0.3px solid rgba(31,138,101,0.25)'
                      : '0.3px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === 0
                        ? Boolean(f.show_on_page)
                        : selectedIds.includes(f.id)
                    }
                    onChange={() => {
                      if (selectedIds.length === 0) {
                        // First explicit selection: start list from this toggle
                        const next = f.show_on_page
                          ? formulas
                              .filter((x) => x.show_on_page && x.id !== f.id)
                              .map((x) => x.id)
                          : [
                              ...formulas
                                .filter((x) => x.show_on_page)
                                .map((x) => x.id),
                              f.id,
                            ];
                        onChange({ ...content, formula_ids: next });
                        if (!f.show_on_page) onEnsureVisible?.(f.id);
                      } else {
                        toggleFormula(f.id);
                      }
                    }}
                    style={{
                      accentColor: '#1f8a65',
                      width: '15px',
                      height: '15px',
                    }}
                  />
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: f.color ?? '#1f8a65',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '13px', color: '#ffffff', flex: 1 }}>
                    {f.name}
                  </span>
                  <span
                    style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}
                  >
                    {f.price_eur === 0
                      ? 'Sur devis'
                      : `${f.price_eur.toFixed(0)} €`}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA label */}
      <div>
        <label style={labelStyle}>Libellé du bouton</label>
        <input
          type="text"
          value={content.cta_label ?? ''}
          onChange={(e) =>
            onChange({
              ...content,
              cta_label: e.target.value.slice(0, LIMITS.ctaLabel),
            })
          }
          placeholder="Me contacter"
          maxLength={LIMITS.ctaLabel}
          style={inputStyle}
        />
        <FieldCharCount
          value={content.cta_label ?? ''}
          max={LIMITS.ctaLabel}
        />
      </div>

      {/* CTA URL */}
      <div>
        <label style={labelStyle}>
          URL du bouton <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', textTransform: 'none', letterSpacing: 0 }}>(optionnel — lien Cal.com, email…)</span>
        </label>
        <input
          type="url"
          value={content.cta_url ?? ''}
          onChange={e => onChange({ ...content, cta_url: e.target.value })}
          placeholder="https://cal.com/…"
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
