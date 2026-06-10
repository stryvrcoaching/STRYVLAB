import React from 'react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  label?: string;
  title: string;
  description?: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeader({ label, title, description, subtitle, align = 'left', className }: HeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3", align === 'center' && "items-center text-center", className)}>
      {label && (
        <div className="text-accent text-sm font-medium uppercase tracking-wide">
          {label}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="w-6 h-[2px] bg-accent" />
        <h2 className="text-2xl md:text-3xl font-medium text-primary tracking-tight">
          {title}
        </h2>
      </div>
      {(description || subtitle) && (
        <p className="text-secondary text-sm md:text-base max-w-2xl leading-relaxed">
          {description || subtitle}
        </p>
      )}
    </div>
  );
}