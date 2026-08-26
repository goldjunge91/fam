import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

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

export function NavigationChromeProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<OverlayStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createOverlayStore();
  }
  const store = storeRef.current;

  const [actions] = useState<NavigationActions>(() => ({
    openDrawer: () => store.set('drawer'),
    closeDrawer: () => store.set('none'),
    openProfile: () => store.set('profile'),
    closeProfile: () => store.set('none'),
    openQuickAdd: () => store.set('quickAdd'),
    closeQuickAdd: () => store.set('none'),
  }));

  return (
    <StoreContext.Provider value={store}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </StoreContext.Provider>
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

export function useNavigationChrome() {
  const store = useStore();
  const actions = useActions();

  const getDrawer = useCallback(() => store.get() === 'drawer', [store]);
  const getProfile = useCallback(() => store.get() === 'profile', [store]);
  const getQuickAdd = useCallback(() => store.get() === 'quickAdd', [store]);

  const isDrawerOpen = useSyncExternalStore(store.subscribe, getDrawer);
  const isProfileOpen = useSyncExternalStore(store.subscribe, getProfile);
  const isQuickAddOpen = useSyncExternalStore(store.subscribe, getQuickAdd);

  return {
    isDrawerOpen,
    isProfileOpen,
    isQuickAddOpen,
    ...actions,
  };
}
