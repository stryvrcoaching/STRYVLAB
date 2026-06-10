import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glassLevel?: 'light' | 'medium' | 'heavy';
  depth?: number;
  withGlow?: boolean;
  animation?: string;
  delay?: number;
}

export function GlassCard({
  className,
  children,
  glassLevel = 'medium',
  depth = 1,
  withGlow = false,
  animation,
  delay,
  ...props
}: GlassCardProps) {
  const glassStyles = {
    light: "bg-white/5 backdrop-blur-sm",
    medium: "bg-white/10 backdrop-blur-md",
    heavy: "bg-white/20 backdrop-blur-lg"
  };

  const depthStyles = {
    1: "border border-white/10 shadow-sm",
    2: "border border-white/20 shadow-md",
    3: "border border-white/30 shadow-lg"
  };

  return (
    <div
      className={cn(
        "rounded-card p-6",
        glassStyles[glassLevel],
        depthStyles[depth as keyof typeof depthStyles],
        withGlow && "shadow-glow-accent",
        animation && `animate-${animation}`,
        className
      )}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      {...props}
    >
      {children}
    </div>
  );
}