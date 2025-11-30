import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient'
import { useRouter } from 'next/navigation';

export function useGoogleLogin() {
    const router = useRouter();

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);

        const firebaseUser = result.user;
        const idToken = await firebaseUser.getIdToken();

        // send token to your backend
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        });

        if (response.ok) {
            router.push('/dashboard');
        }

        return firebaseUser;
    };

    return { signInWithGoogle };
}
