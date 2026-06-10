"use client";

import { useEffect, useRef, ReactNode } from "react";
import { useTopBarSetter } from "@/components/layout/TopBarContext";

export function useSetTopBar(left: ReactNode, right?: ReactNode) {
  const store = useTopBarSetter();
  const prevLeftRef = useRef<ReactNode>(undefined);
  const prevRightRef = useRef<ReactNode>(undefined);
  // Track what THIS instance last wrote so cleanup can guard against clobbering
  const ownedLeftRef = useRef<ReactNode>(undefined);
  const ownedRightRef = useRef<ReactNode>(undefined);

  // Write into store refs every render — zero setState, zero re-renders.
  if (store) {
    store.leftRef.current = left;
    store.rightRef.current = right;
    ownedLeftRef.current = left;
    ownedRightRef.current = right;
  }

  // Notify TopBar only when left/right actually changed reference.
  // Avoids re-rendering TopBar on every keystroke in a page with an input.
  useEffect(() => {
    if (prevLeftRef.current !== left || prevRightRef.current !== right) {
      prevLeftRef.current = left;
      prevRightRef.current = right;
      store?.notify();
    }
  });

  useEffect(() => {
    store?.notify();
    return () => {
      if (store) {
        // Only clear if we still own the TopBar — another page may have already written
        // its content (mount fires before unmount cleanup in React 18 concurrent mode).
        if (
          store.leftRef.current === ownedLeftRef.current &&
          store.rightRef.current === ownedRightRef.current
        ) {
          store.leftRef.current = undefined;
          store.rightRef.current = undefined;
          store.notify();
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
