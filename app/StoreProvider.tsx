"use client";

import { useState, useEffect } from "react";
import { Provider } from "react-redux";
import { makeStore } from "../lib/store";
import { checkAuth } from "../lib/features/auth/authSlice";

import LoadingScreen from "@/components/LoadingScreen";

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [store] = useState(makeStore);

  useEffect(() => {
    store.dispatch(checkAuth());
  }, [store]);

  return (
    <Provider store={store}>
      <LoadingScreen />
      {children}
    </Provider>
  );
}
