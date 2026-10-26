import { App } from '@capacitor/app';

/** Loaded only in the packaged app. Browser/PWA lifecycle stays SDK-free. */
export async function bindNativeLifecycle({ back, active }) {
  await App.addListener('backButton', () => {
    if (back() === false) App.minimizeApp().catch(() => {});
  });
  await App.addListener('appStateChange', ({ isActive }) => active(isActive));
}
