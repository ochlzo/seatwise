declare module 'use-image' {
    export default function useImage(
        url: string,
        crossOrigin?: string,
        referrerpolicy?: string
    ): [HTMLImageElement | undefined, string | undefined];
}
