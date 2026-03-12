"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebaseClient";
import { useAppDispatch } from "@/lib/hooks";
import { setUser } from "@/lib/features/auth/authSlice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

type InviteInfo = {
  inviteId: string;
  email: string;
  teamName: string | null;
  targetRole: "TEAM_ADMIN" | "SUPERADMIN";
  expiresAt: number;
  otpVerified: boolean;
};

type Step = "confirm" | "otp" | "profile";

type Props = {
  token: string;
};

type FormErrors = {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  password: string | null;
};

type UsernameState = "idle" | "checking" | "available" | "taken";

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const EMPTY_ERRORS: FormErrors = {
  firstName: null,
  lastName: null,
  username: null,
  password: null,
};

export function AdminInviteOnboarding({ token }: Props) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null);
  const [invite, setInvite] = React.useState<InviteInfo | null>(null);
  const [step, setStep] = React.useState<Step>("confirm");
  const [otp, setOtp] = React.useState("");
  const [formData, setFormData] = React.useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = React.useState<FormErrors>(EMPTY_ERRORS);
  const [usernameState, setUsernameState] = React.useState<UsernameState>("idle");
  const [showPassword, setShowPassword] = React.useState(false);

  const parseResponse = async <T,>(response: Response): Promise<T> => {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Unexpected server response.");
    }
    return (await response.json()) as T;
  };

  const checkUsernameAvailability = React.useCallback(
    async (username: string) => {
      const response = await fetch("/api/admin/access/invite/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username }),
      });
      const data = await parseResponse<{ taken?: boolean; error?: string }>(response);
      if (!response.ok) {
        throw new Error(data.error || "Failed to validate username.");
      }
      return Boolean(data.taken);
    },
    [token],
  );

  React.useEffect(() => {
    const validateInvite = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/access/invite/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await parseResponse<{
          success?: boolean;
          error?: string;
          invite?: InviteInfo;
        }>(response);

        if (!response.ok || !data.success || !data.invite) {
          throw new Error(data.error || "Invalid or expired invite.");
        }

        setInvite(data.invite);
        setStep(data.invite.otpVerified ? "profile" : "confirm");
      } catch (inviteError) {
        setError(
          inviteError instanceof Error ? inviteError.message : "Invalid or expired invite.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void validateInvite();
  }, [token]);

  React.useEffect(() => {
    if (step !== "profile") {
      return;
    }

    const username = formData.username.trim();

    if (username.length === 0) {
      setUsernameState("idle");
      setFieldErrors((prev) => ({ ...prev, username: null }));
      return;
    }

    if (username.length < 2) {
      setUsernameState("idle");
      setFieldErrors((prev) => ({
        ...prev,
        username: "Username must be at least 2 characters.",
      }));
      return;
    }

    if (username.length > 20) {
      setUsernameState("idle");
      setFieldErrors((prev) => ({
        ...prev,
        username: "Username must be at most 20 characters.",
      }));
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setUsernameState("checking");

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/access/invite/check-username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, username }),
          signal: controller.signal,
        });
        const data = await parseResponse<{ taken?: boolean; error?: string }>(response);
        if (cancelled) return;

        if (!response.ok) {
          throw new Error(data.error || "Failed to validate username.");
        }

        if (data.taken) {
          setUsernameState("taken");
          setFieldErrors((prev) => ({ ...prev, username: "Username is already taken." }));
          return;
        }

        setUsernameState("available");
        setFieldErrors((prev) => ({ ...prev, username: null }));
      } catch (usernameError) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setUsernameState("idle");
        setFieldErrors((prev) => ({
          ...prev,
          username:
            usernameError instanceof Error
              ? usernameError.message
              : "Failed to validate username.",
        }));
      }
    }, 500);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [formData.username, step, token]);

  const handleSendOtp = async () => {
    setIsSubmitting(true);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch("/api/admin/access/invite/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await parseResponse<{ success?: boolean; error?: string }>(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send OTP.");
      }

      setInfoMessage("OTP sent to your email.");
      setStep("otp");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send OTP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    setIsSubmitting(true);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch("/api/admin/access/invite/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, otp }),
      });
      const data = await parseResponse<{ success?: boolean; error?: string }>(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to verify OTP.");
      }

      setInfoMessage("OTP verified. Complete your profile.");
      setStep("profile");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Failed to verify OTP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);

    const nextErrors: FormErrors = { ...EMPTY_ERRORS };
    let hasErrors = false;

    if (!formData.firstName.trim()) {
      nextErrors.firstName = "First name is required.";
      hasErrors = true;
    }

    if (!formData.lastName.trim()) {
      nextErrors.lastName = "Last name is required.";
      hasErrors = true;
    }

    const username = formData.username.trim();
    if (!username) {
      nextErrors.username = "Username is required.";
      hasErrors = true;
    } else if (username.length < 2) {
      nextErrors.username = "Username must be at least 2 characters.";
      hasErrors = true;
    } else if (username.length > 20) {
      nextErrors.username = "Username must be at most 20 characters.";
      hasErrors = true;
    } else {
      try {
        const isTaken = await checkUsernameAvailability(username);
        if (isTaken) {
          nextErrors.username = "Username is already taken.";
          setUsernameState("taken");
          hasErrors = true;
        }
      } catch (usernameError) {
        nextErrors.username =
          usernameError instanceof Error
            ? usernameError.message
            : "Failed to validate username.";
        hasErrors = true;
      }
    }

    if (!formData.password) {
      nextErrors.password = "Password is required.";
      hasErrors = true;
    } else if (!PASSWORD_REGEX.test(formData.password)) {
      nextErrors.password = "Password must be at least 8 chars and include letters and numbers.";
      hasErrors = true;
    }

    setFieldErrors(nextErrors);
    if (hasErrors || usernameState === "checking") {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/access/invite/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          password: formData.password,
        }),
      });
      const data = await parseResponse<{
        success?: boolean;
        error?: string;
        email?: string;
      }>(response);

      if (!response.ok || !data.success || !data.email) {
        throw new Error(data.error || "Failed to complete onboarding.");
      }

      const result = await signInWithEmailAndPassword(auth, data.email, formData.password);
      const idToken = await result.user.getIdToken(true);
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const loginData = await parseResponse<{ user?: unknown; error?: string }>(loginResponse);
      if (!loginResponse.ok || !loginData.user) {
        throw new Error(loginData.error || "Failed to login after onboarding.");
      }

      dispatch(setUser(loginData.user as never));
      router.push("/admin");
    } catch (completeError) {
      const message =
        completeError instanceof Error
          ? completeError.message
          : "Unable to complete onboarding right now.";

      if (message.toLowerCase().includes("first name")) {
        setFieldErrors((prev) => ({ ...prev, firstName: message }));
      } else if (message.toLowerCase().includes("last name")) {
        setFieldErrors((prev) => ({ ...prev, lastName: message }));
      } else if (message.toLowerCase().includes("username")) {
        setFieldErrors((prev) => ({ ...prev, username: message }));
        setUsernameState(message.toLowerCase().includes("taken") ? "taken" : "idle");
      } else if (message.toLowerCase().includes("password")) {
        setFieldErrors((prev) => ({ ...prev, password: message }));
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const usernameHint = React.useMemo(() => {
    if (fieldErrors.username) {
      return null;
    }
    if (usernameState === "checking") {
      return "Checking username availability...";
    }
    if (usernameState === "available" && formData.username.trim().length >= 2) {
      return "Username is available.";
    }
    return null;
  }, [fieldErrors.username, formData.username, usernameState]);

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardContent className="p-6 md:p-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error && !invite ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Invite link unavailable</h2>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : invite ? (
          <form className="space-y-4" onSubmit={handleComplete}>
            <div>
              <h2 className="text-xl font-semibold">Admin Invite Onboarding</h2>
              <p className="text-sm text-muted-foreground">
                Access:
                <span className="ml-1 font-semibold">
                  {invite.targetRole === "SUPERADMIN"
                    ? "Superadmin"
                    : invite.teamName ?? "Team Admin"}
                </span>
              </p>
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input value={invite.email} readOnly />
                <FieldDescription>Email is locked to this invite.</FieldDescription>
              </Field>

              {step === "confirm" && (
                <Button type="button" onClick={handleSendOtp} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
                </Button>
              )}

              {step === "otp" && (
                <>
                  <Field>
                    <FieldLabel>One-time password</FieldLabel>
                    <Input
                      value={otp}
                      onChange={(event) => setOtp(event.target.value)}
                      placeholder="6-digit code"
                      maxLength={6}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="button" onClick={handleVerifyOtp} disabled={isSubmitting || otp.length < 6}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify OTP"}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleSendOtp} disabled={isSubmitting}>
                      Resend OTP
                    </Button>
                  </div>
                </>
              )}

              {step === "profile" && (
                <>
                  <Field data-invalid={!!fieldErrors.firstName}>
                    <FieldLabel>First name</FieldLabel>
                    <Input
                      value={formData.firstName}
                      aria-invalid={!!fieldErrors.firstName}
                      onChange={(event) => {
                        const firstName = event.target.value;
                        setFormData((prev) => ({ ...prev, firstName }));
                        if (fieldErrors.firstName) {
                          setFieldErrors((prev) => ({ ...prev, firstName: null }));
                        }
                      }}
                    />
                    <FieldError>{fieldErrors.firstName}</FieldError>
                  </Field>
                  <Field data-invalid={!!fieldErrors.lastName}>
                    <FieldLabel>Last name</FieldLabel>
                    <Input
                      value={formData.lastName}
                      aria-invalid={!!fieldErrors.lastName}
                      onChange={(event) => {
                        const lastName = event.target.value;
                        setFormData((prev) => ({ ...prev, lastName }));
                        if (fieldErrors.lastName) {
                          setFieldErrors((prev) => ({ ...prev, lastName: null }));
                        }
                      }}
                    />
                    <FieldError>{fieldErrors.lastName}</FieldError>
                  </Field>
                  <Field data-invalid={!!fieldErrors.username}>
                    <FieldLabel>Username</FieldLabel>
                    <Input
                      value={formData.username}
                      aria-invalid={!!fieldErrors.username}
                      onChange={(event) => {
                        const username = event.target.value;
                        setFormData((prev) => ({ ...prev, username }));
                        setUsernameState("idle");
                        if (fieldErrors.username) {
                          setFieldErrors((prev) => ({ ...prev, username: null }));
                        }
                      }}
                    />
                    <FieldError>{fieldErrors.username}</FieldError>
                    {!fieldErrors.username && usernameHint ? (
                      <FieldDescription>
                        <span className={usernameState === "available" ? "text-green-600" : undefined}>
                          {usernameHint}
                        </span>
                      </FieldDescription>
                    ) : null}
                  </Field>
                  <Field data-invalid={!!fieldErrors.password}>
                    <FieldLabel>Password</FieldLabel>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        aria-invalid={!!fieldErrors.password}
                        className="pr-10"
                        onChange={(event) => {
                          const password = event.target.value;
                          setFormData((prev) => ({ ...prev, password }));
                          if (fieldErrors.password) {
                            setFieldErrors((prev) => ({ ...prev, password: null }));
                          }
                        }}
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <FieldError>{fieldErrors.password}</FieldError>
                    {!fieldErrors.password && (
                      <FieldDescription>
                        Use at least 8 characters with letters and numbers.
                      </FieldDescription>
                    )}
                  </Field>
                  <Button
                    type="submit"
                    disabled={isSubmitting || usernameState === "checking"}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Complete Setup and Login"
                    )}
                  </Button>
                </>
              )}
            </FieldGroup>

            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {infoMessage ? <p className="text-sm text-green-600">{infoMessage}</p> : null}
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
