import type { CapacitorConfig } from '@capacitor/cli'

const isProd = process.env.NODE_ENV === 'production'

const config: CapacitorConfig = {
  appId: 'com.stryvlab.client',
  appName: 'STRYV',
  // webDir is unused in remote-URL mode but required by Capacitor CLI
  webDir: 'out',

  server: {
    // In production: point to the hosted Next.js app
    // In dev: point to local dev server for live reload
    url: isProd
      ? process.env.CAPACITOR_SERVER_URL ?? 'https://genesis-system.vercel.app'
      : 'http://localhost:3000',
    // Scope to client routes only
    // The native app opens /client directly
    cleartext: !isProd, // allow HTTP on dev only
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#ededed',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'Default',
      backgroundColor: '#ededed',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },

  ios: {
    contentInset: 'automatic',
    // Start directly on /client
    appendUserAgent: 'STRYV-iOS',
  },

  android: {
    appendUserAgent: 'STRYV-Android',
    backgroundColor: '#ededed',
  },
}

export default config
