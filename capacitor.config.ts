import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.charaivati.store',
  appName: 'Charaivati Store',

  webDir: 'public',

  server: {
    url: 'https://charaivati.com/app/home',
    cleartext: false,
    androidScheme: 'https',
  },
};

export default config;