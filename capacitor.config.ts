import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.archibald.titan',
  appName: 'Archibald Titan',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
  },
  android: {
    buildOptions: {
      releaseType: 'AAB',
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#000000',
    },
  },
};

export default config;
