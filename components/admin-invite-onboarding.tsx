"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
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

  const parseResponse = async <T,>(response: Response): Promise<T> => {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Unexpected server response.");
    }
    return (await response.json()) as T;
  };

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
    setIsSubmitting(true);
    setError(null);
    setInfoMessage(null);
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
      setError(
        completeError instanceof Error
          ? completeError.message
          : "Failed to complete onboarding.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
                <span className="font-semibold ml-1">
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
                  <Field>
                    <FieldLabel>First name</FieldLabel>
                    <Input
                      value={formData.firstName}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, firstName: event.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Last name</FieldLabel>
                    <Input
                      value={formData.lastName}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, lastName: event.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Username</FieldLabel>
                    <Input
                      value={formData.username}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, username: event.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Password</FieldLabel>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, password: event.target.value }))
                      }
                    />
                    <FieldDescription>
                      Use at least 8 characters with letters and numbers.
                    </FieldDescription>
                  </Field>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Complete Setup and Login"
                    )}
                  </Button>
                </>
              )}
            </FieldGroup>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {infoMessage && <p className="text-sm text-green-600">{infoMessage}</p>}
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
