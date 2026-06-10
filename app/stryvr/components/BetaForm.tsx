'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState, useTransition } from 'react';
import { joinWaitlist, WaitlistResult } from '../actions';

type FormState =
  | { type: 'idle' }
  | { type: 'success'; firstName: string; alreadyExists: boolean }
  | { type: 'error'; message: string };

export function BetaForm() {
  const [state, setState] = useState<FormState>({ type: 'idle' });
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const firstName = (formData.get('first_name') as string)?.trim() ?? '';
    startTransition(async () => {
      const result: WaitlistResult = await joinWaitlist(formData);
      if (result.success) {
        setState({ type: 'success', firstName, alreadyExists: result.alreadyExists });
      } else {
        setState({ type: 'error', message: result.error });
      }
    });
  }

  if (state.type === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          border: '1px solid rgba(245,216,0,0.3)',
          backgroundColor: 'rgba(245,216,0,0.06)',
          borderRadius: 0,
          padding: '20px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F5D800', marginBottom: 6 }}>
          {state.alreadyExists ? 'Déjà enregistré' : `Accès confirmé`}
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, margin: 0 }}>
          {state.alreadyExists
            ? 'Tu seras parmi les premiers contactés au lancement.'
            : `${state.firstName} — tu es sur la liste. On te contacte en premier.`}
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Inputs row */}
      <div style={{ display: 'flex', gap: 1, backgroundColor: 'rgba(255,255,255,0.06)' }}>
        <input
          name="first_name"
          type="text"
          required
          minLength={2}
          placeholder="PRÉNOM"
          style={{
            flex: 1,
            height: 52,
            backgroundColor: '#161616',
            border: 'none',
            outline: 'none',
            padding: '0 16px',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: '#ffffff',
            fontFamily: 'inherit',
          }}
          onFocus={e => { e.currentTarget.style.backgroundColor = '#1e1e1e'; }}
          onBlur={e => { e.currentTarget.style.backgroundColor = '#161616'; }}
        />
        <input
          name="email"
          type="email"
          required
          placeholder="EMAIL"
          style={{
            flex: 1,
            height: 52,
            backgroundColor: '#161616',
            border: 'none',
            outline: 'none',
            padding: '0 16px',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: '#ffffff',
            fontFamily: 'inherit',
          }}
          onFocus={e => { e.currentTarget.style.backgroundColor = '#1e1e1e'; }}
          onBlur={e => { e.currentTarget.style.backgroundColor = '#161616'; }}
        />
      </div>

      <AnimatePresence>
        {state.type === 'error' && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, letterSpacing: '0.06em', padding: '8px 0 0', margin: 0 }}
          >
            {state.message}
          </motion.p>
        )}
      </AnimatePresence>

      {/* CTA */}
      <button
        type="submit"
        disabled={isPending}
        style={{
          height: 52,
          width: '100%',
          backgroundColor: isPending ? 'rgba(245,216,0,0.7)' : '#F5D800',
          border: 'none',
          cursor: isPending ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px 0 24px',
          marginTop: 1,
          transition: 'background-color 0.15s',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => { if (!isPending) e.currentTarget.style.backgroundColor = '#ffe040'; }}
        onMouseLeave={e => { if (!isPending) e.currentTarget.style.backgroundColor = '#F5D800'; }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#0a0a0a' }}>
          {isPending ? 'Inscription...' : 'Rejoindre la liste bêta'}
        </span>
        <span style={{ fontSize: 18, color: '#0a0a0a', lineHeight: 1 }}>›</span>
      </button>

      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em', textAlign: 'center', marginTop: 10 }}>
        ZÉRO SPAM — DÉSABONNEMENT EN 1 CLIC
      </p>
    </form>
  );
}
