import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.notifyme.client',
  appName: 'Notify Me',
  webDir: 'dist/web',
  android: { allowMixedContent: false },
};

export default config;
