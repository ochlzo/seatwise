"use client";

import { useRef, useEffect } from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "../lib/store";
import { checkAuth } from "../lib/features/auth/authSlice";

import LoadingScreen from "@/components/LoadingScreen";

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    // Create the store instance the first time this renders
    storeRef.current = makeStore();
  }

  useEffect(() => {
    if (storeRef.current) {
      storeRef.current.dispatch(checkAuth());
    }
  }, []);

  return (
    <Provider store={storeRef.current}>
      <LoadingScreen />
      {children}
    </Provider>
  );
}
