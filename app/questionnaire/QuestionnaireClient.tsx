'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { QuestionCard } from '@/components/genesis/QuestionCard';
import { Loader2 } from 'lucide-react';

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

export default function QuestionnairePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [visibleQuestions, setVisibleQuestions] = useState<number[]>([0]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
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
      }
    }
    loadQuestions();
  }, []);

  useEffect(() => {
    if (Object.keys(responses).length > 0 && Object.keys(responses).length % 5 === 0) {
      saveProgress();
    }
  }, [responses]);

  const saveProgress = async () => {
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
      console.error('Error saving progress:', error);
    }
  };

  const handleAnswer = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

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
        case '==':
        case '=': return numResponse === numTarget;
        case '!=': return numResponse !== numTarget;
        default: return true;
      }
    }
    
    switch (operator) {
      case '==':
      case '=': return String(responseValue) === targetValue;
      case '!=': return String(responseValue) !== targetValue;
      default: return true;
    }
  };

  const findNextValidQuestion = (fromIndex: number): number => {
    for (let i = fromIndex + 1; i < questions.length; i++) {
      const question = questions[i];
      
      if (question.trigger_condition && !evaluateCondition(question.trigger_condition)) {
        continue;
      }
      
      if (question.skip_condition && evaluateCondition(question.skip_condition)) {
        continue;
      }
      
      return i;
    }
    return questions.length;
  };

  const findPreviousValidQuestion = (fromIndex: number): number => {
    for (let i = fromIndex - 1; i >= 0; i--) {
      const question = questions[i];
      
      if (question.trigger_condition && !evaluateCondition(question.trigger_condition)) {
        continue;
      }
      
      if (question.skip_condition && evaluateCondition(question.skip_condition)) {
        continue;
      }
      
      return i;
    }
    return 0;
  };

  const handleNext = () => {
    const nextIndex = findNextValidQuestion(currentIndex);
    
    if (nextIndex < questions.length) {
      setCurrentIndex(nextIndex);
      if (!visibleQuestions.includes(nextIndex)) {
        setVisibleQuestions(prev => [...prev, nextIndex]);
      }
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
        body: JSON.stringify({
          mode: 'ipt',
          answers: responses,
        }),
      });

      const data = await res.json();

      if (data.ipt_global !== undefined) {
        await fetch('/api/genesis/save-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            result: data,
          }),
        });
        
        router.push(`/results?session=${sessionId}`);
      } else {
        console.error('Analysis failed:', data);
        alert('Erreur lors de l\'analyse. Veuillez réessayer.');
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Error submitting analysis:', error);
      alert('Erreur lors de l\'analyse. Veuillez réessayer.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-widget bg-surface shadow-soft-out flex items-center justify-center mx-auto mb-6">
             <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
          <p className="text-sm font-medium text-secondary">Chargement du système...</p>
        </div>
      </main>
    );
  }

  if (submitting) {
    return (
      <main className="min-h-screen w-full bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-8">
          
          {/* Spinner */}
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🧬</div>
          </div>
          
          {/* Message */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-primary">Analyse en cours</h2>
            <p className="text-sm text-secondary leading-relaxed max-w-xs mx-auto">
              Calcul IPT sur {Object.keys(responses).length} points de données
            </p>
          </div>
          
          {/* Progress bar */}
          <div className="w-full max-w-xs mx-auto">
            <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div className="bg-accent h-full rounded-full animate-pulse w-3/4 transition-all duration-500"></div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const currentQuestion = questions[currentIndex];
  const totalAnswered = Object.keys(responses).length;
  const progress = (totalAnswered / questions.length) * 100;
  const isLastQuestion = findNextValidQuestion(currentIndex) >= questions.length;

  return (
    <main className="min-h-screen w-full bg-background flex items-center justify-center p-6">
      
      <div className="w-full max-w-2xl space-y-12">

        {/* HEADER MINIMAL */}
        <div className="text-center space-y-4">
          
          {/* Logo/Titre */}
          <div>
            <h1 className="text-2xl font-bold text-primary mb-1">STRYV lab</h1>
            <p className="text-xs text-secondary uppercase tracking-widest">Analyse IPT™</p>
          </div>
          
          {/* Progress */}
          <div className="max-w-md mx-auto space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-secondary">{totalAnswered} / {questions.length}</span>
              <span className="text-accent font-bold">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-accent h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

        </div>

        {/* QUESTION CARD (sans wrapper) */}
        <QuestionCard
          question={currentQuestion}
          value={responses[currentQuestion.id]}
          onAnswer={handleAnswer}
        />

        {/* NAVIGATION NEUMORPHIQUE */}
        <div className="flex justify-between gap-4 max-w-md mx-auto">
          
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="px-6 py-3 text-sm font-medium text-secondary bg-surface rounded-full shadow-soft-out hover:shadow-soft-in active:shadow-soft-in disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            Retour
          </button>

          {isLastQuestion ? (
            <button
              onClick={handleSubmit}
              disabled={!responses[currentQuestion.id]}
              className="flex-1 px-6 py-3 text-sm font-bold text-primary bg-surface rounded-full shadow-soft-out hover:shadow-soft-in active:shadow-soft-in disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              Générer le rapport
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!responses[currentQuestion.id]}
              className="flex-1 px-6 py-3 text-sm font-bold text-primary bg-surface rounded-full shadow-soft-out hover:shadow-soft-in active:shadow-soft-in disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              Suivant
            </button>
          )}
        </div>

        {/* AUTO-SAVE INDICATOR (discret) */}
        {totalAnswered > 0 && totalAnswered % 5 === 0 && (
          <div className="text-center">
            <p className="text-xs text-accent">● Sauvegardé</p>
          </div>
        )}

       {/* =========================================
          8. FOOTER (Invisible Spacer)
          ========================================= */}
      <footer className="mt-0 border-none bg-transparent pt-0 pb-40
      ">
        {/* Ce footer est intentionnellement vide pour créer de l'espace */}
      </footer>
      
      </div>
    </main>
  );
}