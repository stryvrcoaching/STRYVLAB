"use client";

import React from "react";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface ClientSubHeaderProps {
  firstName: string;
  lastName: string;
  email?: string;
  onBack?: () => void;
}

export default function ClientSubHeader({
  firstName,
  lastName,
  email,
  onBack,
}: ClientSubHeaderProps) {
  const router = useRouter();

  return (
    <div className="bg-background px-6 py-4 border-b border-subtle shrink-0">
      <div className="flex items-center gap-4 max-w-4xl mx-auto">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-pill bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
          {firstName[0]}
          {lastName[0]}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-primary tracking-tight leading-tight">
            {firstName} {lastName}
          </h1>
          {email && <p className="text-xs text-muted mt-0.5">{email}</p>}
        </div>

        {/* Actions droite */}
        <button
          onClick={onBack || (() => router.push("/coach/clients"))}
          className="btn-secondary shrink-0"
        >
          <ChevronLeft size={13} />
          Retour
        </button>
      </div>
    </div>
  );
}
