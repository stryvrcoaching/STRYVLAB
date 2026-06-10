'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScanFace, Loader2, Save } from 'lucide-react';
import { QuestionCard } from '@/components/genesis/QuestionCard';
import { ProgressBar } from '@/components/genesis/ProgressBar';

interface Question {
  id: string;
  text: string;
  response_type: string;
  options?: string[];
  min?: number;
  max?: number;
  trigger_condition?: string;
  skip_condition?: string;
}

export default function IPTQuestionnaire() {
  const router = useRouter();
  
  // Génération d'un ID de session temporaire si inexistant
  const [sessionId, setSessionId] = useState<string>('');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Initialisation
  useEffect(() => {
    // Créer ou récupérer une session
    let currentSession = localStorage.getItem('stryv_session_id');
    if (!currentSession) {
      currentSession = `sess_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('stryv_session_id', currentSession);
    }
    setSessionId(currentSession);

    // Charger les questions
    async function loadQuestions() {
      try {
        const res = await fetch('/api/genesis/questions');
        const data = await res.json();
        
        if (data.success) {
          setQuestions(data.questions);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading questions:', error);
        setLoading(false);
      }
    }
    loadQuestions();
  }, []);

  // Sauvegarde automatique
  useEffect(() => {
    if (Object.keys(responses).length > 0 && Object.keys(responses).length % 5 === 0) {
      saveProgress();
    }
  }, [responses]);

  const saveProgress = async () => {
    if (!sessionId) return;
    try {
      await fetch('/api/genesis/save-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          responses,
          currentIndex,
        }),
      });
    } catch (error) {
      console.error('Auto-save error', error);
    }
  };

  const handleAnswer = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  // Logique conditionnelle (Skip logic)
  const evaluateCondition = (condition: string | undefined): boolean => {
    if (!condition) return true;
    
    const match = condition.match(/IF\s+([A-Z_0-9]+)\s+([><=!]+)\s+(.+)/i);
    if (!match) return true;
    
    const [, questionId, operator, valueStr] = match;
    const responseValue = responses[questionId];
    
    if (responseValue === undefined) return false;
    
    const targetValue = valueStr.replace(/['"]/g, '');
    const numResponse = parseFloat(responseValue);
    const numTarget = parseFloat(targetValue);
    
    if (!isNaN(numResponse) && !isNaN(numTarget)) {
      switch (operator) {
        case '>=': return numResponse >= numTarget;
        case '<=': return numResponse <= numTarget;
        case '>': return numResponse > numTarget;
        case '<': return numResponse < numTarget;
        case '==': case '=': return numResponse === numTarget;
        case '!=': return numResponse !== numTarget;
        default: return true;
      }
    }
    
    switch (operator) {
      case '==': case '=': return String(responseValue) === targetValue;
      case '!=': return String(responseValue) !== targetValue;
      default: return true;
    }
  };

  const findNextValidQuestion = (fromIndex: number): number => {
    for (let i = fromIndex + 1; i < questions.length; i++) {
      const q = questions[i];
      if (q.trigger_condition && !evaluateCondition(q.trigger_condition)) continue;
      if (q.skip_condition && evaluateCondition(q.skip_condition)) continue;
      return i;
    }
    return questions.length;
  };

  const findPreviousValidQuestion = (fromIndex: number): number => {
    for (let i = fromIndex - 1; i >= 0; i--) {
      const q = questions[i];
      if (q.trigger_condition && !evaluateCondition(q.trigger_condition)) continue;
      if (q.skip_condition && evaluateCondition(q.skip_condition)) continue;
      return i;
    }
    return 0;
  };

  const handleNext = () => {
    const nextIndex = findNextValidQuestion(currentIndex);
    if (nextIndex < questions.length) {
      setCurrentIndex(nextIndex);
    }
  };

  const handlePrevious = () => {
    const prevIndex = findPreviousValidQuestion(currentIndex);
    setCurrentIndex(prevIndex);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/genesis/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ipt', answers: responses }),
      });

      const data = await res.json();

      if (data.ipt_global !== undefined) {
        // Sauvegarde du résultat
        await fetch('/api/genesis/save-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, result: data }),
        });
        
        // Redirection vers la page de résultats
        router.push(`/results?session=${sessionId}`);
      } else {
        alert("Erreur d'analyse. Veuillez réessayer.");
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert("Erreur technique. Veuillez réessayer.");
      setSubmitting(false);
    }
  };

  // --- RENDU ---

  if (loading) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center text-secondary">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-accent" />
        <p className="text-xs font-bold uppercase tracking-widest">Initialisation VIRTUS...</p>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="w-full max-w-lg mx-auto bg-surface border border-white/60 p-8 rounded-2xl text-center space-y-8">
        <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🧬</div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-primary tracking-tight">Analyse en cours...</h2>
          <p className="text-sm text-secondary leading-relaxed font-light">Calcul IPT, détection des Root Causes et profiling Neurotype.</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return <div className="text-center p-8 text-red-500">Aucune question chargée. Vérifiez l'API.</div>;
  }

  const currentQuestion = questions[currentIndex];
  const totalAnswered = Object.keys(responses).length;
  const progress = (currentIndex / questions.length) * 100; // Progression basée sur l'index visible
  const isLastQuestion = findNextValidQuestion(currentIndex) >= questions.length;

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6 font-outfit">
        
        {/* Header */}
        <div className="bg-surface border border-white/60 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shadow-inner">
                 <ScanFace className="w-5 h-5 text-accent" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-primary">VIRTUS</span>
                <span className="text-[9px] font-bold tracking-widest uppercase text-gray-400">Analyse IPT™</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono text-accent">{Math.round(progress)}%</p>
            </div>
          </div>
          <ProgressBar progress={progress} />
        </div>

        {/* Carte Question */}
        <QuestionCard
          question={currentQuestion}
          value={responses[currentQuestion.id]}
          onAnswer={handleAnswer}
        />

        {/* Contrôles */}
        <div className="bg-surface border border-white/60 p-4 rounded-2xl flex justify-between gap-4">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-secondary bg-surface-light border border-gray-100 rounded-xl hover:bg-white hover:border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              ← Retour
            </button>

            {isLastQuestion ? (
              <button
                onClick={handleSubmit}
                disabled={!responses[currentQuestion.id]}
                className="flex-1 px-6 py-4 text-xs font-bold uppercase tracking-widest bg-accent text-white rounded-xl shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Générer le rapport
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!responses[currentQuestion.id]}
                className="flex-1 px-6 py-4 text-xs font-bold uppercase tracking-widest bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Suivant →
              </button>
            )}
        </div>

        {/* Indicateur sauvegarde */}
        {totalAnswered > 0 && totalAnswered % 5 === 0 && (
          <div className="flex justify-center animate-pulse">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 shadow-sm">
                <Save className="w-3 h-3 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Sauvegardé</span>
            </div>
          </div>
        )}
    </div>
  );
}