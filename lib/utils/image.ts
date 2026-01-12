/**
 * Compresses an image file using Canvas API.
 * @param file The original File object
 * @param maxWidth Max width of the resulting image
 * @param maxHeight Max height of the resulting image
 * @param quality Compression quality (0 to 1)
 * @returns A promise that resolves to a base64 string
 */
export async function compressImage(
    file: File,
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8
): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                // Maintain aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                // Return as base64 jpeg
                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error("Failed to load image for compression"));
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
    });
}
