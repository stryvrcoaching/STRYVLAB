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
      ? process.env.CAPACITOR_SERVER_URL ?? 'https://www.stryvlab.com'
      : 'http://localhost:3000',
    // Scope to client routes only
    // The native app opens /client directly
    cleartext: !isProd, // allow HTTP on dev only
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#09090a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#09090a',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },

  ios: {
    backgroundColor: '#09090a',
    contentInset: 'never',
    // Start directly on /client
    appendUserAgent: 'STRYV-iOS',
  },

  android: {
    appendUserAgent: 'STRYV-Android',
    backgroundColor: '#09090a',
  },
}

export default config
