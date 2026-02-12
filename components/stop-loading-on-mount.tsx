"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/lib/hooks";
import { setLoading } from "@/lib/features/loading/isLoadingSlice";

export default function StopLoadingOnMount() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setLoading(false));
  }, [dispatch]);

  return null;
}

