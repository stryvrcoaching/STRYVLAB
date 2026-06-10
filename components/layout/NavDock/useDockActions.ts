"use client";

import { useEffect } from "react";
import { registerDockAction, unregisterDockAction } from "./dockActionRegistry";

export function useDockActions(actions: Record<string, () => void>) {
  useEffect(() => {
    Object.entries(actions).forEach(([key, handler]) => {
      registerDockAction(key, handler);
    });
    return () => {
      Object.keys(actions).forEach((key) => {
        unregisterDockAction(key);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
