"use client";

import { useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useAppDispatch } from "@/lib/hooks";
import { setUser } from "@/lib/features/auth/authSlice";
import { useEmailPass, getAuthErrorMessage } from "@/hooks/useEmail&Pass";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm({
  className,
  imageSrc,
  onLoginStart,
  onLoginError,
  callbackUrl,
  ...props
}: React.ComponentProps<"div"> & {
  imageSrc?: string;
  onLoginStart?: () => void;
  onLoginError?: () => void;
  callbackUrl?: string;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const dispatch = useAppDispatch();
  const { signInWithEmail, resetPassword } = useEmailPass();

  const safeRedirect =
    callbackUrl &&
    callbackUrl.startsWith("/admin") &&
    !callbackUrl.startsWith("//") &&
    !callbackUrl.includes("://")
      ? callbackUrl
      : "/admin";

  const parseApiResponse = async <T,>(response: Response): Promise<T> => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }

    const text = await response.text();
    throw new Error(
      text.includes("<!DOCTYPE")
        ? "Server returned HTML instead of JSON. Check API route/server logs."
        : text || "Unexpected response format from server.",
    );
  };

  const resolveEmailFromIdentifier = async () => {
    const trimmed = identifier.trim();
    if (!trimmed) return "";
    if (trimmed.includes("@")) return trimmed;

    const response = await fetch(`/api/auth/admin-email?username=${encodeURIComponent(trimmed)}`);
    const data = await parseApiResponse<{ success?: boolean; email?: string; error?: string }>(
      response,
    );
    if (!response.ok || !data.success || !data.email) {
      throw new Error(data.error || "Admin account not found.");
    }
    return data.email;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (isForgotPassword) {
      setIsSubmitting(true);
      try {
        const resolvedEmail = await resolveEmailFromIdentifier();
        if (!resolvedEmail) {
          throw new Error("Enter your username or email first.");
        }
        await resetPassword(resolvedEmail);
        setResetEmailSent(true);
      } catch (error) {
        setValidationError(getAuthErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters.");
      return;
    }

    onLoginStart?.();
    setIsSubmitting(true);
    try {
      const resolvedEmail = await resolveEmailFromIdentifier();
      const user = await signInWithEmail(resolvedEmail, password, safeRedirect);
      dispatch(setUser(user));
    } catch (error) {
      setValidationError(getAuthErrorMessage(error));
      onLoginError?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6 max-w-md mx-auto", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8 flex flex-col gap-6" onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">
                  {isForgotPassword ? "Reset Admin Password" : "Admin Login"}
                </h1>
                <p className="text-muted-foreground text-balance">
                  {isForgotPassword
                    ? "Enter your admin email to receive a reset link."
                    : "Sign in with your admin credentials."}
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="identifier">Username or Email</FieldLabel>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="admin_username or admin@seatwise.app"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </Field>

              {!isForgotPassword && (
                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <button
                      type="button"
                      className="ml-auto text-xs underline-offset-2 hover:underline"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setResetEmailSent(false);
                        setValidationError(null);
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
              )}

              {validationError && (
                <p className="text-sm text-red-500 mt-1">{validationError}</p>
              )}

              {resetEmailSent && (
                <p className="text-sm text-green-600">Reset email sent. Please check your inbox.</p>
              )}

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin" /> : isForgotPassword ? "Send Reset Link" : "Login"}
              </Button>

              {isForgotPassword && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setValidationError(null);
                  }}
                >
                  Back to login
                </Button>
              )}
            </FieldGroup>
          </form>

          <div className="bg-muted relative hidden md:block">
            <Image
              src={imageSrc || "/placeholder.svg"}
              alt=""
              fill
              sizes="(max-width: 768px) 0px, 50vw"
              className="absolute inset-0 object-cover dark:brightness-[0.2] dark:grayscale"
              priority
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Admin access only.
      </FieldDescription>
    </div>
  );
}
