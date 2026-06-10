'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  label?: string;
  className?: string;
}

export const BackButton = ({ label = 'Retour', className = '' }: BackButtonProps) => {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className={`
        group inline-flex items-center gap-2 
        text-[13px] font-medium text-secondary 
        transition-colors duration-200 
        hover:text-primary 
        ${className}
      `}
    >
      {/* Flèche SVG minimaliste (Stroke 1.5px) */}
      <svg 
        width="16" height="16" viewBox="0 0 24 24" fill="none" 
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        className="transition-transform duration-200 group-hover:-translate-x-1"
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  );
};