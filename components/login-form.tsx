"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAppDispatch } from "@/lib/hooks";
import { setUser } from "@/lib/features/auth/authSlice";
import { useGoogleLogin } from "@/hooks/useGoogleLogin";
import { useEmailPass, getAuthErrorMessage } from "@/hooks/useEmail&Pass";
import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signOut,
  updatePassword,
} from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { checkUsernameAction, checkEmailAction } from "@/lib/actions/updateProfile";
import { abortSignUpAction } from "@/lib/actions/authActions";

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
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isGoogleSetup, setIsGoogleSetup] = useState(false);
  const [isPasswordRequired, setIsPasswordRequired] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [isNewProfileSetup, setIsNewProfileSetup] = useState(false);
  const usernameCheckSeqRef = useRef(0);

  const dispatch = useAppDispatch();
  const router = useRouter();
  const { signInWithGoogle } = useGoogleLogin();
  const { signInWithEmail, signUpWithEmail, resetPassword } = useEmailPass();
  const safeRedirect =
    callbackUrl &&
    callbackUrl.startsWith("/") &&
    !callbackUrl.startsWith("//") &&
    !callbackUrl.includes("://") &&
    callbackUrl !== "/login"
      ? callbackUrl
      : undefined;
  const needsProfileCompletion = (user: {
    username?: string | null;
    hasPassword?: boolean;
    firstName?: string | null;
    lastName?: string | null;
  }) => {
    const missingUsername = !user.username || user.username.trim() === "";
    const missingName =
      !user.firstName ||
      user.firstName.trim() === "" ||
      !user.lastName ||
      user.lastName.trim() === "";
    // Password is NOT required - users can use Google-only authentication
    return missingUsername || missingName;
  };

  const handleUsernameChange = (val: string) => {
    const cleanVal = val.trim();
    setUsername(cleanVal);
    setUsernameTaken(false);
    if (validationError) setValidationError(null);
  };

  useEffect(() => {
    if (username.length < 2) {
      setUsernameTaken(false);
      return;
    }

    const seq = ++usernameCheckSeqRef.current;
    const timer = setTimeout(async () => {
      try {
        const excludeUid = isSignUp ? undefined : auth.currentUser?.uid;
        const result = await checkUsernameAction(username, excludeUid);
        // Ignore stale responses from older requests.
        if (seq === usernameCheckSeqRef.current) {
          setUsernameTaken(result.taken);
        }
      } catch (err) {
        console.error("Uniqueness check failed:", err);
        if (seq === usernameCheckSeqRef.current) {
          setUsernameTaken(false);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, isSignUp]);

  useEffect(() => {
    if (email.length < 5 || !email.includes('@')) {
      setEmailTaken(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await checkEmailAction(email);
        setEmailTaken(result.taken);
      } catch (err) {
        console.error("Email uniqueness check failed:", err);
        setEmailTaken(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email]);

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    onLoginStart?.();
    try {
      const user = await signInWithGoogle({
        redirectTo: safeRedirect,
        emailHint: email.trim() || undefined,
        passwordForLink: password || undefined,
      });

      // signInWithGoogle handles complete profiles internally
      // If we reach here and profile is incomplete, show Complete Profile flow
      if (needsProfileCompletion(user)) {
        setIsGoogleSetup(true);
        setIsNewProfileSetup(Boolean(user.isNewUser));
        setSetupStep(1); // Start at step 1
        setIsPasswordRequired(!user.hasPassword);
        if (user.email) setEmail(user.email);
        if (user.displayName) {
          const nameParts = user.displayName.trim().split(/\s+/);
          if (nameParts.length > 1) {
            const l = nameParts.pop() || "";
            const f = nameParts.join(" ");
            setFirstName(f);
            setLastName(l);
          } else {
            setFirstName(nameParts[0] || "");
            setLastName("");
          }
        }
        onLoginError?.();
      } else {
        // Profile is complete, dispatch user (already handled in useGoogleLogin)
        dispatch(setUser(user));
      }
    } catch (error) {
      console.error("Google login failed:", error);
      setValidationError(getAuthErrorMessage(error));
      onLoginError?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isForgotPassword) {
      setIsSubmitting(true);
      try {
        await resetPassword(email);
        setResetEmailSent(true);
        setValidationError(null);
      } catch (error: unknown) {
        console.error("Reset password failed:", error);
        setValidationError(getAuthErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const skipPasswordCheck = isGoogleSetup && !isPasswordRequired;
    if (!skipPasswordCheck && password.length < 6) {
      setValidationError("Password must be at least 6 characters long.");
      return;
    }
    if (validationError) setValidationError(null);


    // Final check before submission if username is being set
    if (username.length >= 2) {
      const excludeUid = isSignUp ? undefined : auth.currentUser?.uid;
      const result = await checkUsernameAction(username, excludeUid);
      if (result.taken) {
        setUsernameTaken(true);
        return;
      }
    }

    onLoginStart?.();
    setIsSubmitting(true);
    try {
      let user;

      if (isGoogleSetup) {
        if (auth.currentUser && isPasswordRequired) {
          try {
            await updatePassword(auth.currentUser, password);
          } catch (error: unknown) {
            if ((error as { code?: string })?.code === "auth/requires-recent-login") {
              const provider = new GoogleAuthProvider();
              await reauthenticateWithPopup(auth.currentUser, provider);
              await updatePassword(auth.currentUser, password);
            } else {
              throw error;
            }
          }
        }

        const idToken = await auth.currentUser?.getIdToken();

        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            username,
            firstName,
            lastName,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to update profile");
        }

        const data = await response.json();
        const serverUser = data.user;

        user = {
          uid: serverUser?.uid || auth.currentUser?.uid || "",
          email: (serverUser?.email || auth.currentUser?.email) ?? null,
          displayName:
            (serverUser?.displayName || auth.currentUser?.displayName) ?? null,
          firstName: serverUser?.firstName || null,
          lastName: serverUser?.lastName || null,
          photoURL:
            (serverUser?.photoURL || auth.currentUser?.photoURL) ?? null,
          role: serverUser?.role || "USER",
          username: serverUser?.username ?? null,
          hasPassword: serverUser?.hasPassword ?? true,
        };

        const fallback = user.role === "ADMIN" ? "/admin" : "/dashboard";
        router.push(safeRedirect || fallback);
      } else if (isSignUp) {
        user = await signUpWithEmail(
          email,
          password,
          username,
          firstName,
          lastName,
          safeRedirect
        );
      } else {
        user = await signInWithEmail(email, password, safeRedirect);
      }

      const currentUid = user.uid || (auth.currentUser ? auth.currentUser.uid : null);
      if (!currentUid) throw new Error("User UID not found");

      const safeUser = {
        uid: currentUid,
        email: user.email,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        photoURL: user.photoURL,
        role: user.role,
        username: user.username,
        hasPassword: user.hasPassword
      };

      if (needsProfileCompletion(safeUser)) {
        setIsGoogleSetup(true);
        setIsNewProfileSetup(Boolean(user.isNewUser));
        setSetupStep(1); // Start at step 1
        setIsPasswordRequired(!safeUser.hasPassword);
        if (user.email) setEmail(user.email);
        if (user.displayName) {
          const nameParts = user.displayName.trim().split(/\s+/);
          if (nameParts.length > 1) {
            const l = nameParts.pop() || "";
            const f = nameParts.join(" ");
            setFirstName(f);
            setLastName(l);
          } else {
            setFirstName(nameParts[0] || "");
            setLastName("");
          }
        }
        onLoginError?.();
      } else {
        dispatch(setUser(user));
      }
    } catch (error: unknown) {
      console.error("Login/Setup failed:", error);

      const errorMessage = (error as Error).message || "";
      if (errorMessage.includes("Username is already taken")) {
        setUsernameTaken(true);
      } else {
        setValidationError(getAuthErrorMessage(error));
      }
      onLoginError?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAbort = async (e: React.MouseEvent) => {
    e.preventDefault();
    const confirmMessage = isNewProfileSetup
      ? "Are you sure you want to cancel? This will abort your signup and delete your account."
      : "Are you sure you want to cancel profile setup?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (isNewProfileSetup) {
        const result = await abortSignUpAction();
        if (!result.success) {
          setValidationError(result.error || "Failed to abort signup.");
          return;
        }
      } else {
        await signOut(auth);
        await fetch("/api/auth/logout", { method: "POST" });
      }

      // Reset everything and go back to login state
      setIsGoogleSetup(false);
      setIsNewProfileSetup(false);
      setSetupStep(1);
      setEmail("");
      setPassword("");
      setUsername("");
      setFirstName("");
      setLastName("");
      setValidationError(null);
      router.push("/login");
      window.location.reload();
    } catch (err) {
      console.error("Abort failed:", err);
      setValidationError("An error occurred while canceling.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const ImageSection = (
    <div className="bg-muted relative hidden md:block">
      <Image
        src={imageSrc || "/placeholder.svg"}
        alt=""
        fill
        className="absolute inset-0 object-cover dark:brightness-[0.2] dark:grayscale"
        priority
      />
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-6 transition-all duration-300",
        (isForgotPassword || isGoogleSetup) && "max-w-md mx-auto",
        isSignUp && "md:max-w-5xl mx-auto",
        className
      )}
      {...props}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-appear {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .animate-slide {
          animation: slideIn 0.3s ease-out forwards;
        }
      `}</style>
      <Card className="overflow-hidden p-0">
        <CardContent
          key={
            isForgotPassword
              ? "forgot"
              : isGoogleSetup
                ? "setup"
                : isSignUp
                  ? "signup"
                  : "login"
          }
          className={cn(
            "grid p-0 animate-appear transition-all duration-300",
            isForgotPassword
              ? resetEmailSent ? "md:h-[440px]" : "md:h-[330px]"
              : isGoogleSetup
                ? "md:h-[440px]"
                : "md:h-[540px]",
            isForgotPassword || isGoogleSetup
              ? "grid-cols-1"
              : isSignUp
                ? "md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
                : "md:grid-cols-2"
          )}
        >
          {isSignUp && ImageSection}
          <form className="p-6 md:p-8 flex flex-col h-full overflow-hidden relative" onSubmit={handleSubmit}>
            {isGoogleSetup && (
              <a
                href="#"
                onClick={handleAbort}
                className="absolute top-4 right-4 text-[8px] sm:text-[10px] font-medium text-muted-foreground hover:text-destructive transition-colors underline underline-offset-4 z-10"
              >
                Cancel
              </a>
            )}
            <FieldGroup className={cn(
              "flex-1 flex flex-col pr-1 gap-4 sm:gap-7",
              isForgotPassword ? "overflow-hidden" : "overflow-y-auto"
            )}>
              <div className={cn(
                "flex flex-col items-center gap-1 sm:gap-2 text-center",
                isGoogleSetup && "pt-4 sm:pt-0"
              )}>
                <h1 className="text-2xl font-bold">
                  {isForgotPassword
                    ? "Reset Password"
                    : isGoogleSetup
                      ? "Complete Profile"
                      : isSignUp
                        ? "Create an account"
                        : "Welcome back"}
                </h1>
                <p className="text-muted-foreground text-balance">
                  {isForgotPassword
                    ? "Enter your email to receive a password reset link."
                    : isGoogleSetup
                      ? setupStep === 1
                        ? "Confirm your First Name and Last Name."
                        : isPasswordRequired
                          ? "Set a username and password to complete your account."
                          : "Set a username to complete your account."
                      : isSignUp
                        ? "Sign up for Seatwise"
                        : "Login to your Seatwise Account"}
                </p>
              </div>

              {isForgotPassword ? (
                <div className="flex flex-col flex-1">
                  <div className="flex-1 flex flex-col justify-start pt-2">
                    {!resetEmailSent ? (
                      <Field>
                        <FieldLabel htmlFor="email">Email</FieldLabel>
                        <Input
                          id="email"
                          type="email"
                          placeholder="seatwise@example.com"
                          required
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (validationError) setValidationError(null);
                          }}
                        />
                        {validationError && (
                          <p className="text-sm text-red-500 mt-1">
                            {validationError}
                          </p>
                        )}
                      </Field>
                    ) : (
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="rounded-full bg-green-100 p-3">
                          <Image
                            src="/check.png"
                            alt="Success"
                            width={40}
                            height={40}
                            className="w-10 h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-green-600 font-semibold text-lg leading-tight">
                            Password reset email sent!
                            <br />
                            Check your inbox.
                          </p>
                          <p className="text-sm text-muted-foreground px-4">
                            If you don&apos;t see it, please check your{" "}
                            <span className="font-bold text-foreground">
                              spam folder
                            </span>.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    {!resetEmailSent && (
                      <Button type="submit" disabled={isSubmitting} className="w-full">
                        {isSubmitting ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          "Send Reset Link"
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      type="button"
                      disabled={isSubmitting}
                      className="w-full text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setResetEmailSent(false);
                        setValidationError(null);
                      }}
                    >
                      Back to Login
                    </Button>
                  </div>
                </div>
              ) : isGoogleSetup ? (
                <div className="flex flex-col flex-1">
                  <div className="flex-1 overflow-hidden relative">
                    {setupStep === 1 ? (
                      <div key="step-1" className="space-y-4 animate-slide">
                        <Field>
                          <FieldLabel htmlFor="firstname">First Name</FieldLabel>
                          <Input
                            id="firstname"
                            type="text"
                            placeholder="First Name"
                            required
                            value={firstName}
                            onChange={(e) => {
                              setFirstName(e.target.value);
                              if (validationError) setValidationError(null);
                            }}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="lastname">Last Name</FieldLabel>
                          <Input
                            id="lastname"
                            type="text"
                            placeholder="Last Name"
                            required
                            value={lastName}
                            onChange={(e) => {
                              setLastName(e.target.value);
                              if (validationError) setValidationError(null);
                            }}
                          />
                        </Field>
                        {validationError && (
                          <p className="text-sm text-red-500 mt-1">
                            {validationError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div key="step-2" className="space-y-4 animate-slide">
                        <Field data-invalid={usernameTaken}>
                          <div className="flex items-center justify-between">
                            <FieldLabel htmlFor="username">Username</FieldLabel>
                            {usernameTaken && (
                              <span className="text-[10px] font-medium text-destructive animate-appear">
                                Username is already taken
                              </span>
                            )}
                          </div>
                          <Input
                            id="username"
                            type="text"
                            placeholder="username"
                            required
                            value={username}
                            aria-invalid={usernameTaken}
                            onChange={(e) => handleUsernameChange(e.target.value)}
                          />
                        </Field>
                        {isPasswordRequired && (
                          <Field>
                            <FieldLabel htmlFor="password">Password</FieldLabel>
                            <div className="relative">
                              <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => {
                                  setPassword(e.target.value);
                                  if (validationError) setValidationError(null);
                                }}
                                className="pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </Field>
                        )}
                        {validationError && (
                          <p className="text-sm text-red-500 mt-1">
                            {validationError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-auto pt-4 flex gap-3">
                    {setupStep === 2 && (
                      <Button
                        variant="outline"
                        type="button"
                        className="flex-1"
                        onClick={() => {
                          setSetupStep(1);
                          setValidationError(null);
                        }}
                      >
                        Back
                      </Button>
                    )}
                    <Button
                      type={setupStep === 2 ? "submit" : "button"}
                      disabled={isSubmitting || (setupStep === 2 && usernameTaken)}
                      className="flex-1"
                      onClick={(e) => {
                        if (setupStep === 1) {
                          e.preventDefault();
                          if (!firstName.trim() || !lastName.trim()) {
                            setValidationError("First name and last name are required.");
                            return;
                          }
                          setSetupStep(2);
                          setValidationError(null);
                        }
                      }}
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" />
                      ) : setupStep === 1 ? (
                        "Next"
                      ) : (
                        "Complete Setup"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1">
                  <div className="space-y-4 mb-2">
                    {isSignUp && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Field data-invalid={usernameTaken}>
                            <div className="flex items-center justify-between">
                              <FieldLabel htmlFor="username">Username</FieldLabel>
                              {usernameTaken && (
                                <span className="text-[10px] font-medium text-destructive animate-appear">
                                  Username is already taken
                                </span>
                              )}
                            </div>
                            <Input
                              id="username"
                              type="text"
                              placeholder="username"
                              required
                              value={username}
                              aria-invalid={usernameTaken}
                              onChange={(e) => handleUsernameChange(e.target.value)}
                            />
                          </Field>
                          <Field data-invalid={emailTaken}>
                            <div className="flex items-center justify-between">
                              <FieldLabel htmlFor="email">Email</FieldLabel>
                              {emailTaken && (
                                <span className="text-[10px] font-medium text-destructive animate-appear">
                                  Email is already taken
                                </span>
                              )}
                            </div>
                            <Input
                              id="email"
                              type="email"
                              placeholder="seatwise@example.com"
                              required
                              value={email}
                              aria-invalid={emailTaken}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                if (validationError) setValidationError(null);
                              }}
                            />
                          </Field>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Field>
                            <FieldLabel htmlFor="firstname">First Name</FieldLabel>
                            <Input
                              id="firstname"
                              type="text"
                              placeholder="First Name"
                              required
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="lastname">Last Name</FieldLabel>
                            <Input
                              id="lastname"
                              type="text"
                              placeholder="Last Name"
                              required
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                            />
                          </Field>
                        </div>
                        <Field className="space-y-1">
                          <FieldLabel htmlFor="password">Password</FieldLabel>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              required
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                if (validationError) setValidationError(null);
                              }}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          {validationError && (
                            <p className="text-sm text-red-500 mt-1">
                              {validationError}
                            </p>
                          )}
                        </Field>
                      </div>
                    )}

                    {!isSignUp && (
                      <div className="space-y-4">
                        <Field>
                          <FieldLabel htmlFor="email">Email</FieldLabel>
                          <Input
                            id="email"
                            type="email"
                            placeholder="seatwise@example.com"
                            required
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              if (validationError) setValidationError(null);
                            }}
                          />
                        </Field>
                        <Field className="space-y-1">
                          <div className="flex items-center">
                            <FieldLabel htmlFor="password">Password</FieldLabel>
                            <a
                              href="#"
                              className="ml-auto text-sm underline-offset-2 hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                setIsForgotPassword(true);
                                setValidationError(null);
                              }}
                            >
                              Forgot your password?
                            </a>
                          </div>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              required
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                if (validationError) setValidationError(null);
                              }}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          {validationError && (
                            <p className="text-sm text-red-500 mt-1">
                              {validationError}
                            </p>
                          )}
                        </Field>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto space-y-3 pt-2">
                    <Field>
                      <Button
                        type="submit"
                        disabled={isSubmitting || (isSignUp && (usernameTaken || emailTaken))}
                        className="w-full"
                      >
                        {isSubmitting ? (
                          <Loader2 className="animate-spin" />
                        ) : isSignUp ? (
                          "Sign Up"
                        ) : (
                          "Login"
                        )}
                      </Button>
                    </Field>
                    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card my-0">
                      Or continue with
                    </FieldSeparator>
                    <Field>
                      <Button
                        variant="outline"
                        type="button"
                        className="w-full"
                        onClick={handleGoogleLogin}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="w-4 h-4"
                            >
                              <path
                                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                                fill="currentColor"
                              />
                            </svg>
                            <span>Google</span>
                          </div>
                        )}
                      </Button>
                    </Field>
                    <FieldDescription className="text-center">
                      {isSignUp ? (
                        <>
                          Already have an account?{" "}
                          <a
                            href="#"
                            className="underline"
                            onClick={(e) => {
                              e.preventDefault();
                              setIsSignUp(false);
                            }}
                          >
                            Login
                          </a>
                        </>
                      ) : (
                        <>
                          Don&apos;t have an account?{" "}
                          <a
                            href="#"
                            className="underline"
                            onClick={(e) => {
                              e.preventDefault();
                              setIsSignUp(true);
                            }}
                          >
                            Sign up
                          </a>
                        </>
                      )}
                    </FieldDescription>
                  </div>
                </div>
              )}
            </FieldGroup>
          </form>
          {!isSignUp && !isForgotPassword && !isGoogleSetup && ImageSection}
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div >
  );
}
