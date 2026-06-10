'use client';
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  items: { title: string; content: string }[];
}

export function Accordion({ items }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div 
          key={index} 
          className="bg-surface rounded-btn overflow-hidden transition-all"
        >
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <span className="font-medium text-primary">{item.title}</span>
            <ChevronDown 
              size={18} 
              className={`text-secondary transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`}
            />
          </button>
          
          <div 
            className={`
              overflow-hidden transition-all duration-300 ease-in-out
              ${openIndex === index ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}
            `}
          >
            <p className="px-6 pb-6 text-sm text-secondary leading-relaxed border-t border-gray-100/50 pt-4">
              {item.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}