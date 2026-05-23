import type { CapacitorConfig } from '@capacitor/cli';

  const config: CapacitorConfig = {
    appId: 'com.archibald.titan',
    appName: 'Archibald Titan',
    webDir: 'dist/public',
    server: {
      androidScheme: 'https',
      allowNavigation: [
        'bridge-ai-app-production.up.railway.app',
        // '*.replit.app' wildcard removed — too broad. Add explicit domains as needed.
      ],
    },
    android: {
      buildOptions: {
        releaseType: 'AAB',
      },
    },
    plugins: {
      CapacitorHttp: {
        enabled: true,
      },
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
  