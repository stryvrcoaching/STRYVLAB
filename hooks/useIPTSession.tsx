import { useState, useEffect, useCallback } from 'react';

interface UseIPTSessionProps {
  email?: string;
  onSessionCreated?: (data: SessionData) => void;
  onError?: (error: string) => void;
}

interface SessionData {
  sessionId: string;
  sessionToken: string;
  userId: string;
  email: string;
}

export function useIPTSession({ email, onSessionCreated, onError }: UseIPTSessionProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Initialiser ou récupérer session au mount
  useEffect(() => {
    const initSession = async () => {
      // Vérifier localStorage
      const storedSessionId = localStorage.getItem('ipt_session_id');
      const storedToken = localStorage.getItem('ipt_session_token');

      if (storedSessionId && storedToken) {
        // Récupérer session existante
        try {
          const res = await fetch(`/api/genesis/session/${storedSessionId}`);
          const data = await res.json();

          if (data.success) {
            setSessionId(data.session.id);
            setSessionToken(storedToken);
            setUserId(data.user?.id || null);
            setProgress(data.session.progress || 0);
            return;
          }
        } catch (err) {
          console.error('Erreur récupération session:', err);
        }
      }

      // Créer nouvelle session si email fourni
      if (email && !storedSessionId) {
        await createSession(email);
      }
    };

    initSession();
  }, [email]);

  // Créer nouvelle session
  const createSession = async (userEmail: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/genesis/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          deviceInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language,
          },
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create session');
      }

      // Stocker dans localStorage
      localStorage.setItem('ipt_session_id', data.sessionId);
      localStorage.setItem('ipt_session_token', data.sessionToken);

      setSessionId(data.sessionId);
      setSessionToken(data.sessionToken);
      setUserId(data.userId);

      if (onSessionCreated) {
        onSessionCreated(data);
      }

    } catch (err: any) {
      const errorMsg = err.message;
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Sauvegarder une réponse
  const saveResponse = async (
    questionId: string,
    data: {
      questionText: string;
      questionOrder: number;
      responseValue: any;
      responseType: string;
      timeSpent?: number;
    }
  ) => {
    if (!sessionId) {
      throw new Error('No active session');
    }

    try {
      const res = await fetch('/api/genesis/response/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId,
          ...data,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setProgress(parseFloat(result.progress));
      }

      return result;
    } catch (err: any) {
      console.error('Error saving response:', err);
      throw err;
    }
  };

  // Sauvegarder batch
  const batchSave = async (responses: any[], currentIndex: number) => {
    if (!sessionId) {
      throw new Error('No active session');
    }

    try {
      const res = await fetch('/api/genesis/response/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          responses,
          currentIndex,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setProgress(parseFloat(result.progress));
        console.log('✅ Auto-save:', result.saved, 'réponses sauvegardées');
      }

      return result;
    } catch (err: any) {
      console.error('Error batch saving:', err);
      throw err;
    }
  };

  // Compléter la session
  const completeSession = async () => {
    if (!sessionId) {
      throw new Error('No active session');
    }

    try {
      const res = await fetch('/api/genesis/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const result = await res.json();

      if (result.success) {
        // Nettoyer localStorage
        localStorage.removeItem('ipt_session_id');
        localStorage.removeItem('ipt_session_token');
      }

      return result;
    } catch (err: any) {
      console.error('Error completing session:', err);
      throw err;
    }
  };

  // Récupérer session (recovery)
  const recoverSession = async (sid?: string) => {
    const targetSessionId = sid || sessionId;

    if (!targetSessionId) {
      throw new Error('No session to recover');
    }

    try {
      const res = await fetch(`/api/genesis/session/${targetSessionId}`);
      const data = await res.json();

      if (data.success) {
        setSessionId(data.session.id);
        setProgress(data.session.progress || 0);
        return data;
      }

      throw new Error('Session not found');
    } catch (err: any) {
      console.error('Error recovering session:', err);
      throw err;
    }
  };

  return {
    sessionId,
    sessionToken,
    userId,
    loading,
    error,
    progress,
    createSession,
    saveResponse,
    batchSave,
    completeSession,
    recoverSession,
  };
}

// Hook auto-save (toutes les N questions)
export function useAutoSave({
  responses,
  currentIndex,
  batchSaveFunction,
  saveInterval = 5,
}: {
  responses: any[];
  currentIndex: number;
  batchSaveFunction: (responses: any[], currentIndex: number) => Promise<any>;
  saveInterval?: number;
}) {
  useEffect(() => {
    if (responses.length > 0 && responses.length % saveInterval === 0) {
      const timer = setTimeout(() => {
        batchSaveFunction(responses, currentIndex);
      }, 2000); // Debounce 2 secondes

      return () => clearTimeout(timer);
    }
  }, [responses.length]);
}