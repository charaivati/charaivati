import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.charaivati.store',
  appName: 'Charaivati Store',

  server: {
    url: 'https://charaivati.com/app/home',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      'charaivati.com',
      '*.charaivati.com',
    ],
  },

  android: {
    backgroundColor: '#000000',
    allowMixedContent: true,
  },

  plugins: {
    StatusBar: {
      style: 'DARK',
      overlaysWebView: false,
      backgroundColor: '#000000',
    },
  },
};

export default config;