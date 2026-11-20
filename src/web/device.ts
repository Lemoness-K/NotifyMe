import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type DeviceStatus = {
  signedIn: boolean;
  installationId: string;
  installationName: string;
  notifications: boolean;
  exactAlarms: boolean;
  location: boolean;
  timeChannel: boolean;
  locationChannel: boolean;
};
export type DeviceSetting = 'notification' | 'exact' | 'location' | 'timeChannel' | 'locationChannel';
type NativeResponse = { status: number; body?: unknown };
export type NativeFailure = { code?: string; data?: { status?: number; retryAfter?: string; body?: { code?: string; details?: Record<string, unknown> } } };

const plugin = registerPlugin<{
  status(): Promise<DeviceStatus>;
  bind(): Promise<DeviceStatus>;
  signIn(options: { invitation?: { code: string; key: string } }): Promise<DeviceStatus>;
  clearSession(): Promise<void>;
  takeReminder(): Promise<{ reminderId?: string }>;
  request(options: { method: string; path: string; body?: unknown; key?: string; revision?: string }): Promise<NativeResponse>;
  openSettings(options: { kind: DeviceSetting }): Promise<void>;
  locale(options: { locale: 'ko' | 'en' }): Promise<void>;
  addListener(event: 'capabilitiesChanged' | 'reminderOpened', callback: () => void): Promise<PluginListenerHandle>;
}>('NotifyDevice');

export function androidDevice() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('NotifyDevice') ? plugin : undefined;
}
