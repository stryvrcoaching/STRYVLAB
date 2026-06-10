import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      // ─── CURSOR DASHBOARD (réf. capture) ─────────────────────────────────
      // Fond #0E0E0E · cartes #161616 · bordures #2A2A2A · accent vert #1F8A65
      colors: {
        // ── DS v4.0 client gray scale ──────────────────────────
        "c-bg":         "#080808",
        "c-surface-1":  "#111111",
        "c-surface-2":  "#1a1a1a",
        "c-surface-3":  "#222222",
        "c-hover":      "#2e2e2e",
        "c-active":     "#404040",
        "c-icon-off":   "#5a5a5a",
        "c-text-muted": "#808080",
        "c-text-body":  "#b0b0b0",
        "c-text-head":  "#e0e0e0",
        "c-text-emph":  "#f2f2f2",
        // ── DS v4.0 data colors (charts only) ─────────────────
        "data-copper":  "#9d7052",
        "data-gold":    "#a89060",
        "data-petrol":  "#3d7070",
        // ── DS v2.0 coach tokens (keep — used by /coach) ───────
        background: "#121212",
        surface: "#141414",
        "surface-alt": "#141414",
        "surface-light": "#141414",
        "surface-raised": "#141414",
        dark: "#141414",
        primary: "#EDEDED",
        main: "var(--text-main)",
        "on-dark": "#FFFFFF",
        secondary: "#8A8A8A",
        muted: "#8A8A8A",
        accent: "#1F8A65",
        "accent-hover": "#217356",
        "accent-secondary": "#217356",
        "accent-tertiary": "#1F4637",
        subtle: "#2A2A2A",
        active: "#3F3F3F",
        success: "#1F8A65",
        danger: "#ef4444",
        warning: "#f59e0b",
      },

      borderRadius: {
        card: "12px",
        "card-lg": "16px",
        "card-sm": "8px",
        btn: "6px",
        pill: "9999px",
        input: "6px",
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
        barlow: ["var(--font-barlow)", "sans-serif"],
        "barlow-condensed": ["var(--font-barlow-condensed)", "sans-serif"],
      },

      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset",
        elevated: "0 8px 24px rgba(0,0,0,0.45)",
        modal: "0 16px 48px rgba(0,0,0,0.55)",
        "focus-field": "0 0 0 1px #1F8A65",
        "glow-accent": "0 0 0 1px rgba(31,138,101,0.4)",
        "inset-surface": "inset 0 1px 0 rgba(255,255,255,0.04)",
        "soft-out": "none",
        "soft-in": "none",
      },
    },
  },

  plugins: [],
};

export default config;
