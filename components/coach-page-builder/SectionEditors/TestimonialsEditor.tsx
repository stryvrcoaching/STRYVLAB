'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { TestimonialsContent, TestimonialItem } from '@/types/coach-page';
import {
  FieldCharCount,
  LIMITS,
} from '@/components/coach-page-builder/FieldCharCount';
import { SectionPresentationEditor } from '@/components/coach-page-builder/SectionPresentationEditor';

interface Props {
  content: TestimonialsContent;
  onChange: (content: TestimonialsContent) => void;
}

const MAX_ITEMS = 4;

export function TestimonialsEditor({ content, onChange }: Props) {
  const items = content.items ?? [];

  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    const newItem: TestimonialItem = {
      id: crypto.randomUUID(),
      name: '',
      text: '',
    };
    onChange({ ...content, items: [...items, newItem] });
  };

  const updateItem = (id: string, patch: Partial<TestimonialItem>) => {
    onChange({
      ...content,
      items: items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  };

  const removeItem = (id: string) => {
    onChange({ ...content, items: items.filter((item) => item.id !== id) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionPresentationEditor
        type="testimonials"
        value={content.presentation}
        onChange={(presentation) => onChange({ ...content, presentation })}
      />

      <p
        style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.4)',
          margin: 0,
          lineHeight: 1.45,
        }}
      >
        Jusqu’à {MAX_ITEMS} témoignages · nom {LIMITS.testimonialName} car. ·
        texte {LIMITS.testimonialText} car. (~
        {Math.round(LIMITS.testimonialText / 6)} mots)
      </p>

      {items.map((item, i) => (
        <div
          key={item.id}
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '0.3px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.45)',
                fontWeight: 600,
              }}
            >
              TÉMOIGNAGE {i + 1}
            </span>
            <button
              onClick={() => removeItem(item.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(239,68,68,0.7)',
                padding: '2px',
                display: 'flex',
                transition: 'all 150ms',
              }}
              title="Supprimer"
              type="button"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div>
            <input
              type="text"
              value={item.name}
              onChange={(e) =>
                updateItem(item.id, {
                  name: e.target.value.slice(0, LIMITS.testimonialName),
                })
              }
              placeholder="Nom du client"
              maxLength={LIMITS.testimonialName}
              style={inputStyle}
            />
            <FieldCharCount
              value={item.name}
              max={LIMITS.testimonialName}
            />
          </div>
          <div>
            <textarea
              value={item.text}
              onChange={(e) =>
                updateItem(item.id, {
                  text: e.target.value.slice(0, LIMITS.testimonialText),
                })
              }
              placeholder="Son témoignage…"
              maxLength={LIMITS.testimonialText}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
            />
            <FieldCharCount value={item.text} max={LIMITS.testimonialText} />
          </div>
        </div>
      ))}

      {items.length < MAX_ITEMS && (
        <button onClick={addItem} style={addBtnStyle} type="button">
          <Plus size={14} />
          Ajouter un témoignage
        </button>
      )}

      {items.length === 0 && (
        <p
          style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          Clique sur le bouton ci-dessus pour ajouter un premier témoignage.
        </p>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0a0a0a',
  border: '0.3px solid rgba(255,255,255,0.06)',
  borderRadius: '12px',
  padding: '8px 12px',
  color: '#ffffff',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
};

const addBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  justifyContent: 'center',
  padding: '10px',
  background: 'rgba(255,255,255,0.02)',
  border: '0.3px dashed rgba(255,255,255,0.15)',
  borderRadius: '12px',
  color: 'rgba(255,255,255,0.45)',
  fontSize: '13px',
  cursor: 'pointer',
  transition: 'all 150ms',
};
