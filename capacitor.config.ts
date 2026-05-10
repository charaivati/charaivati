import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.charaivati.store',
  appName: 'Charaivati Store',
  webDir: 'out',
  server: {
    url: 'https://charaivati.com',
    cleartext: false,
  },
};

export default config;