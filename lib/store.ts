import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/auth/authSlice';
import loadingReducer from './features/loading/isLoadingSlice';

export const makeStore = () => {
    return configureStore({
        reducer: {
            auth: authReducer,
            loading: loadingReducer,
        },
    });
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
