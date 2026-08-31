import { useEffect } from 'react';
import type { AppState } from './types';

/**
 * Applies the stored preference to the root element. 'system' deliberately
 * removes the class rather than resolving it, so the OS switching at dusk is
 * picked up without the app being reopened.
 */
export function useTheme(theme: AppState['settings']['theme']) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      root.classList.toggle('dark', dark);
    };
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
