import type React from 'react';
import { createContext, useContext, useRef, useState, useSyncExternalStore } from 'react';

type OverlayKey = 'none' | 'drawer' | 'profile' | 'quickAdd';

// Minimal pub/sub store so each consumer only re-renders when its
// specific boolean flips, not on every overlay state change.
function createOverlayStore() {
  let current: OverlayKey = 'none';
  const listeners = new Set<() => void>();

  return {
    get: () => current,
    set: (next: OverlayKey) => {
      if (next === current) return;
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type OverlayStore = ReturnType<typeof createOverlayStore>;

// Stable actions context: callbacks never change, so consumers that only
// need openDrawer/openProfile/openQuickAdd (= every hub screen header)
// never re-render when overlay state toggles.
interface NavigationActions {
  openDrawer: () => void;
  closeDrawer: () => void;
  openProfile: () => void;
  closeProfile: () => void;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
}

const ActionsContext = createContext<NavigationActions | undefined>(undefined);
const StoreContext = createContext<OverlayStore | undefined>(undefined);

/**
 * Steuert die drei Overlays der Navigation (#150): Hamburger-Drawer,
 * Profil-Sheet, Schnellauswahl. Bewusst nur je ein Overlay gleichzeitig
 * offen — oeffnet eines ein zweites, schliesst es das erste automatisch.
 *
 * Intern aufgeteilt in einen stabilen Actions-Context (Callbacks aendern
 * sich nie) und einen Store fuer den Overlay-State, der per
 * `useSyncExternalStore` granular subscribed wird. Hub-Screens, die nur
 * `openDrawer`/`openProfile` brauchen, re-rendern dadurch nie bei
 * Overlay-Wechseln.
 */
export function NavigationChromeProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(createOverlayStore);

  // Actions are stable refs — never cause re-renders in consumers.
  const actionsRef = useRef<NavigationActions>(null);
  if (!actionsRef.current) {
    actionsRef.current = {
      openDrawer: () => store.set('drawer'),
      closeDrawer: () => {
        if (store.get() === 'drawer') store.set('none');
      },
      openProfile: () => store.set('profile'),
      closeProfile: () => {
        if (store.get() === 'profile') store.set('none');
      },
      openQuickAdd: () => store.set('quickAdd'),
      closeQuickAdd: () => {
        if (store.get() === 'quickAdd') store.set('none');
      },
    };
  }

  return (
    <ActionsContext.Provider value={actionsRef.current}>
      <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
    </ActionsContext.Provider>
  );
}

function useStore(): OverlayStore {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useNavigationChrome muss innerhalb von NavigationChromeProvider laufen');
  }
  return store;
}

function useActions(): NavigationActions {
  const actions = useContext(ActionsContext);
  if (!actions) {
    throw new Error('useNavigationChrome muss innerhalb von NavigationChromeProvider laufen');
  }
  return actions;
}

// Selector snapshots — each returns a stable boolean that only changes
// when the specific overlay toggles, not when any other overlay does.
function selectDrawer(store: OverlayStore) {
  return () => store.get() === 'drawer';
}

function selectProfile(store: OverlayStore) {
  return () => store.get() === 'profile';
}

function selectQuickAdd(store: OverlayStore) {
  return () => store.get() === 'quickAdd';
}

/**
 * Haupthook fuer alle Consumers. Gibt den vollen Satz an Flags und
 * Actions zurueck. Durch `useSyncExternalStore` mit individuellen
 * Selektoren re-rendert der Consumer nur, wenn sich sein spezifischer
 * boolean-Wert aendert.
 */
export function useNavigationChrome() {
  const store = useStore();
  const actions = useActions();

  const isDrawerOpen = useSyncExternalStore(store.subscribe, selectDrawer(store));
  const isProfileOpen = useSyncExternalStore(store.subscribe, selectProfile(store));
  const isQuickAddOpen = useSyncExternalStore(store.subscribe, selectQuickAdd(store));

  return {
    isDrawerOpen,
    isProfileOpen,
    isQuickAddOpen,
    ...actions,
  };
}
