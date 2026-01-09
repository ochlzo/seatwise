"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/lib/hooks";
import { setLoading } from "@/lib/features/loading/isLoadingSlice";

export function ProfileContent() {
    const dispatch = useAppDispatch();

    useEffect(() => {
        // Clear loading state when the profile page has mounted/rendered
        dispatch(setLoading(false));
    }, [dispatch]);

    return null;
}
