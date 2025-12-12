"use client";
import { LoginForm } from "@/components/login-form";
import { useAppDispatch } from "@/lib/hooks";
import { setLoading } from "@/lib/features/loading/isLoadingSlice";
import LoadingPage from "../LoadingPage";

export default function LoginPage() {
  const dispatch = useAppDispatch();

  const handleLoginStart = () => {
    dispatch(setLoading(true));
  };

  const handleLoginError = () => {
    dispatch(setLoading(false));
  };

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoadingPage />
        <LoginForm
          imageSrc="/login_image.jpg"
          onLoginStart={handleLoginStart}
          onLoginError={handleLoginError}
        />
      </div>
    </div>
  );
}
