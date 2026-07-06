import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'so.denis.voice.client',
  appName: 'Denis Voice',
  webDir: 'dist',
  ios: {
    scheme: 'Denis Voice',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
  },
  server: {
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
