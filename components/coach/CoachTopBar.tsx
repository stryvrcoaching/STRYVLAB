"use client";

import React from "react";
import { Menu } from "lucide-react";
import NotificationBell from "@/components/layout/NotificationBell";

interface CoachTopBarProps {
  tabs: Array<{ key: string; label: string; Icon: React.ElementType }>;
  activeTab: string;
  onTabChange: (key: string) => void;
  clientName?: string;
  clientInitial?: string;
}

export default function CoachTopBar({
  tabs,
  activeTab,
  onTabChange,
  clientName,
  clientInitial = "S",
}: CoachTopBarProps) {
  return (
    <header className="top-bar">
      {/* Logo pill */}
      <div className="w-7 h-7 rounded-pill bg-surface-raised flex items-center justify-center mr-2 shrink-0">
        <span className="text-xs font-bold text-primary">S</span>
      </div>
      <div className="w-px h-4 bg-white/10 mx-2 shrink-0" />

      {/* Nav items — tabs horizontales */}
      <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto no-scrollbar">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`top-bar-tab ${activeTab === key ? "active" : ""}`}
            title={label}
          >
            <Icon size={12} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      {/* Actions droite */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <button className="text-on-dark/60 hover:text-on-dark transition-colors p-1">
          <Menu size={16} />
        </button>
        <NotificationBell topBarMode />
        <div className="w-7 h-7 rounded-pill bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {clientInitial}
        </div>
      </div>
    </header>
  );
}
