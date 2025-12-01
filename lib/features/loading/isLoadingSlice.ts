import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { checkAuth } from '../auth/authSlice';

interface LoadingState {
    isLoading: boolean;
}

const initialState: LoadingState = {
    isLoading: false,
};

const loadingSlice = createSlice({
    name: 'loading',
    initialState,
    reducers: {
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(checkAuth.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(checkAuth.fulfilled, (state) => {
                state.isLoading = false;
            })
            .addCase(checkAuth.rejected, (state) => {
                state.isLoading = false;
            });
    },
});

export const { setLoading } = loadingSlice.actions;
export default loadingSlice.reducer;
