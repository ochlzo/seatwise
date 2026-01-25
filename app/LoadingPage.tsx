"use client";

import { useEffect } from 'react';
import { useAppDispatch } from '@/lib/hooks';
import { setLoading } from '@/lib/features/loading/isLoadingSlice';
import { usePathname } from 'next/navigation';

export default function LoadingPage() {
    const dispatch = useAppDispatch();
    const pathname = usePathname();

    useEffect(() => {
        dispatch(setLoading(false));
    }, [dispatch, pathname]);

    return null;
}
