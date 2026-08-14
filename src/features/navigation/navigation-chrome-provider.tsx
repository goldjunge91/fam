import type React from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

interface NavigationChromeContextType {
  isDrawerOpen: boolean;
  isProfileOpen: boolean;
  isQuickAddOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  openProfile: () => void;
  closeProfile: () => void;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
}

const NavigationChromeContext = createContext<NavigationChromeContextType | undefined>(undefined);

/**
 * Steuert die drei Overlays der neuen Navigation (#150, Figma "00 · Screens —
 * Übersicht & Navigation"): Hamburger-Drawer, Profil-Sheet, Schnellauswahl
 * fuer den globalen Plus-Button. Sitzt einmal in `(app)/_layout.tsx` —
 * einzelne Hub-Screens rufen nur `useNavigationChrome()` auf, ohne die
 * Overlays selbst zu kennen.
 *
 * Bewusst nur je ein Overlay gleichzeitig offen: Oeffnet eines ein zweites,
 * schliesst es das erste automatisch (siehe openX-Funktionen), statt dass
 * sich Drawer und Profil-Sheet uebereinander stapeln koennten.
 */
export function NavigationChromeProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<'none' | 'drawer' | 'profile' | 'quickAdd'>('none');

  const value = useMemo<NavigationChromeContextType>(
    () => ({
      isDrawerOpen: open === 'drawer',
      isProfileOpen: open === 'profile',
      isQuickAddOpen: open === 'quickAdd',
      openDrawer: () => setOpen('drawer'),
      closeDrawer: () => setOpen((o) => (o === 'drawer' ? 'none' : o)),
      openProfile: () => setOpen('profile'),
      closeProfile: () => setOpen((o) => (o === 'profile' ? 'none' : o)),
      openQuickAdd: () => setOpen('quickAdd'),
      closeQuickAdd: () => setOpen((o) => (o === 'quickAdd' ? 'none' : o)),
    }),
    [open],
  );

  return (
    <NavigationChromeContext.Provider value={value}>{children}</NavigationChromeContext.Provider>
  );
}

export function useNavigationChrome() {
  const context = useContext(NavigationChromeContext);
  if (!context) {
    throw new Error('useNavigationChrome muss innerhalb von NavigationChromeProvider laufen');
  }
  return context;
}
