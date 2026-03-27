import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/auth/authSlice.ts';
import loadingReducer from './features/loading/isLoadingSlice.ts';
import seatmapReducer from './features/seatmap/seatmapSlice.ts';
import ticketTemplateReducer from './features/ticketTemplate/ticketTemplateSlice.ts';

export const makeStore = () => {
    return configureStore({
        reducer: {
            auth: authReducer,
            loading: loadingReducer,
            seatmap: seatmapReducer,
            ticketTemplate: ticketTemplateReducer,
        },
    });
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
