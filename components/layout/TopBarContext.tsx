"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

type TopBarContent = {
  left?: ReactNode;
  right?: ReactNode;
};

type TopBarStore = {
  // Pages write here directly (no setState, no re-render)
  leftRef: React.MutableRefObject<ReactNode>;
  rightRef: React.MutableRefObject<ReactNode>;
  // TopBar display subscribes to this to force its own re-render
  subscribe: (cb: () => void) => () => void;
  notify: () => void;
};

const TopBarStoreContext = createContext<TopBarStore | null>(null);

export function TopBarProvider({ children }: { children: ReactNode }) {
  const leftRef = useRef<ReactNode>(undefined);
  const rightRef = useRef<ReactNode>(undefined);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const subscribe = useCallback((cb: () => void) => {
    listenersRef.current.add(cb);
    return () => { listenersRef.current.delete(cb); };
  }, []);

  const notify = useCallback(() => {
    listenersRef.current.forEach(cb => cb());
  }, []);

  const store = useRef<TopBarStore>({ leftRef, rightRef, subscribe, notify });

  return (
    <TopBarStoreContext.Provider value={store.current}>
      {children}
    </TopBarStoreContext.Provider>
  );
}

/** Used by the TopBar display component — re-renders only when notify() is called */
export function useTopBarContent() {
  const store = useContext(TopBarStoreContext);
  const [tick, forceUpdate] = useState(0);

  useEffect(() => {
    if (!store) return;
    // Subscribe and immediately force a render to pick up any content written
    // before this subscription was registered (page effects fire before TopBar effects
    // in some tree orderings).
    const unsub = store.subscribe(() => forceUpdate(n => n + 1));
    forceUpdate(n => n + 1);
    return unsub;
  }, [store]);

  // tick is read to ensure re-renders triggered by notify() actually re-read the refs
  void tick;

  return {
    left: store?.leftRef.current,
    right: store?.rightRef.current,
  };
}

/** Used by pages/hooks — writes into refs + notifies TopBar, never causes page re-render */
export function useTopBarSetter() {
  const store = useContext(TopBarStoreContext);
  return store;
}

/** @deprecated */
export function useTopBar() {
  const store = useContext(TopBarStoreContext);
  const content = useTopBarContent();
  const setTopBar = useCallback((c: TopBarContent) => {
    if (!store) return;
    store.leftRef.current = c.left;
    store.rightRef.current = c.right;
    store.notify();
  }, [store]);
  return { content, setTopBar };
}
