'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowUp, 
  X, 
  RotateCcw, 
  Minimize2
} from 'lucide-react';
import { CalendlyButton } from './CalendlyButton';
import { chatWithGenesis } from '@/app/_actions/genesis';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

interface GenesisAssistantProps {
  onStartIPT?: () => void;
}

export default function GenesisAssistant({ onStartIPT }: GenesisAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. MESSAGE D'ACCUEIL (Modifié pour "Expert" et non "Médecin")
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('stryv-chat-history');
      return saved ? JSON.parse(saved) : [
        { role: 'assistant', content: "Je vous attendais.\n\nDerrière chaque stagnation, il y a une logique biologique. Je suis ici pour analyser vos données.\n\nQuel est votre objectif principal ?" }
      ];
    }
    return [{ role: 'assistant', content: "Je vous attendais.\nQuel est votre objectif principal ?" }];
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputValue]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'; 
      scrollToBottom();
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
    if (typeof window !== 'undefined') {
      localStorage.setItem('stryv-chat-history', JSON.stringify(messages));
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMsg = inputValue.trim();
    setInputValue('');
    setIsLoading(true);
    
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const newHistory = [...messages, { role: 'user', content: userMsg } as Message];
    setMessages(newHistory);

    try {
      const result = await chatWithGenesis(userMsg, messages);
      if (result.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Connexion interrompue. Le système redémarre..." }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur critique du noyau." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearHistory = () => {
    setMessages([{ role: 'assistant', content: "Reprenons l'analyse. Je vous écoute." }]);
    localStorage.removeItem('stryv-chat-history');
  };

  // PARSEUR (LIENS + GRAS + LISTES)
  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => (
      <p key={i} className={`min-h-[1em] ${line.startsWith('-') || line.startsWith('•') ? 'pl-4 mb-1' : 'mb-2 last:mb-0'}`}>
        {line.split(' ').map((word, j) => {
          if (word.includes('/outils/')) {
            const cleanLink = word.replace(/[()]/g, ''); 
            return (
              <React.Fragment key={j}>
                <Link 
                    href={cleanLink} 
                    className="text-accent font-medium underline underline-offset-4 hover:text-primary transition-colors cursor-pointer"
                    onClick={() => setIsOpen(false)}
                >
                    {cleanLink}
                </Link>
                {' '}
              </React.Fragment>
            );
          }
          if (word.includes('**')) {
             const parts = word.split('**');
             return (
               <React.Fragment key={j}>
                 {parts.map((part, k) => (
                   k % 2 === 1 
                     ? <strong key={k} className="font-bold text-primary">{part}</strong> 
                     : <span key={k}>{part}</span>
                 ))}
                 {' '}
               </React.Fragment>
             );
          }
          return <span key={j}>{word} </span>;
        })}
      </p>
    ));
  };

  const renderMessageContent = (content: string) => {
    let cleanContent = content
      .replace('[BOUTON_CALENDLY]', '')
      .replace('[BOUTON_IPT]', '')
      .trim();

    return (
      <div className="flex flex-col gap-3">
        <div className="text-sm leading-relaxed">
            {formatText(cleanContent)}
        </div>
        
        {content.includes('[BOUTON_CALENDLY]') && (
           <CalendlyButton 
             text="PRENDRE RENDEZ-VOUS" 
             className="w-full text-center text-white text-[10px] font-bold tracking-widest px-5 py-3 rounded-lg bg-accent hover:bg-accent/90 shadow-sm transition-all uppercase mt-2"
           />
        )}

        {content.includes('[BOUTON_IPT]') && onStartIPT && (
           <button 
             onClick={() => { setIsOpen(false); onStartIPT(); }}
             className="w-full text-center text-white text-[10px] font-bold tracking-widest px-5 py-3 rounded-lg bg-primary hover:bg-primary/90 shadow-sm transition-all uppercase mt-2"
           >
             LANCER L'AUDIT (IPT)
           </button>
        )}
      </div>
    );
  };

  return (
    <>
      {/* BOUTON FLOTTANT */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-4">
          <button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ease-out hover:scale-105 active:scale-95 bg-accent text-white group"
            aria-label="STRYV AI"
          >
            <div className="flex items-start leading-none font-bold font-outfit">
              <span className="text-xl tracking-tighter">G</span>
              <span className="text-[9px] mt-0.5 ml-0.5 opacity-90 font-outfit tracking-wide">AI</span>
            </div>
          </button>
        </div>
      )}

      {/* INTERFACE */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] md:inset-auto md:bottom-24 md:right-6 md:w-[400px] md:h-[650px] flex flex-col">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm md:hidden" />

          <div className="relative flex flex-col w-full h-full md:rounded-card bg-[#f8f8f8] shadow-2xl md:border-none md:border border-white/50 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
            
            {/* HEADER */}
            <div className="px-5 py-4 border-b border-gray-200/50 flex justify-between items-center bg-white/90 backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-white shadow-lg">
                    <div className="flex items-start leading-none font-bold font-outfit">
                      <span className="text-xl tracking-tighter">G</span>
                      <span className="text-[9px] mt-0.5 ml-0.5 opacity-90 font-outfit tracking-wide">AI</span>
                    </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-widest text-primary uppercase font-sans">
                    STRYV AI
                  </span>
                  <span className="flex items-center gap-1.5 mt-0.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                    </span>
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                  <button onClick={clearHistory} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Réinitialiser">
                    <RotateCcw size={18} />
                  </button>
                  <button onClick={() => setIsOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-primary transition-colors">
                    <span className="md:hidden"><X size={22} /></span>
                    <span className="hidden md:block"><Minimize2 size={20} /></span>
                  </button>
              </div>
            </div>

            {/* MESSAGES (SANS LABELS) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#f4f4f4]">
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  {/* LABEL SUPPRIMÉ ICI */}

                  <div className={`
                    max-w-[85%] px-5 py-3.5 text-sm font-sans shadow-sm
                    ${msg.role === 'user' 
                      ? 'bg-primary text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-white text-primary border border-white/60 rounded-2xl rounded-tl-sm shadow-sm'} 
                  `}>
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              ))}
              
              {/* LOADING (SANS TEXTE) */}
              {isLoading && (
                <div className="flex flex-col items-start animate-pulse">
                  {/* LABEL "RÉFLEXION" SUPPRIMÉ ICI */}
                  <div className="bg-white px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm flex gap-1.5">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-0" />
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-150" />
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-300" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* INPUT */}
            <form className="p-4 bg-white border-t border-gray-200/50 shrink-0 pb-safe">
              <div className="relative flex items-end gap-2 bg-background rounded-2xl p-2 shadow-inner">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Dites-moi tout..."
                  disabled={isLoading}
                  rows={1}
                  className="w-full bg-transparent text-sm text-primary placeholder:text-gray-400 focus:outline-none resize-none py-3 px-3 max-h-[150px] overflow-y-auto leading-relaxed font-sans"
                  style={{ minHeight: '44px' }}
                />
                <button 
                  onClick={(e) => handleSendMessage(e)}
                  disabled={!inputValue.trim() || isLoading}
                  className="mb-1 p-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex-shrink-0"
                >
                  <ArrowUp size={20} strokeWidth={2.5} />
                </button>
              </div>
              <div className="text-[9px] text-center text-gray-400 mt-3 font-medium tracking-wide uppercase font-sans">
                STRYV AI v1.1 • Protected by STRYV lab
              </div>
            </form>

          </div>
        </div>
      )}
    </>
  );
}