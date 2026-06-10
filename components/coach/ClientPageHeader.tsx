"use client";

import React from "react";
import { ChevronLeft, Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/layout/NotificationBell";

interface ClientPageHeaderProps {
  firstName: string;
  lastName: string;
  email?: string;
  tabs: Array<{ key: string; label: string; Icon: React.ElementType }>;
  activeTab: string;
  onTabChange: (key: string) => void;
}

export default function ClientPageHeader({
  firstName,
  lastName,
  email,
  tabs,
  activeTab,
  onTabChange,
}: ClientPageHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 bg-dark border-b border-dark/20">
      {/* Header row — back button, client info, notifications */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-dark/20">
        {/* Back button */}
        <button
          onClick={() => router.push("/coach/clients")}
          className="flex items-center gap-2 px-2 py-1 rounded-lg text-muted hover:text-on-dark hover:bg-white/5 transition-colors"
          title="Retour à la liste"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Client info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {firstName[0]}
              {lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold text-on-dark leading-tight">
                {firstName} {lastName}
              </h1>
              {email && (
                <p className="text-[11px] text-muted truncate">{email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <NotificationBell topBarMode />
      </div>

      {/* Tabs row */}
      <nav className="px-6 py-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`flex items-center gap-2 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
              activeTab === key
                ? "text-accent border-accent"
                : "text-on-dark/50 border-transparent hover:text-on-dark/70 hover:border-on-dark/20"
            }`}
            title={label}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
