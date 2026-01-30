"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, KeyRound, Mail, ShieldCheck, User } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setLoading } from "@/lib/features/loading/isLoadingSlice";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { ThemeSwithcer } from "@/components/theme-swithcer"

export default function AccountPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const router = useRouter();
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  useEffect(() => {
    dispatch(setLoading(false));
  }, [dispatch]);

  const fullName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()
      : "Seatwise User";

  const handlePasswordReset = async () => {
    if (!user?.email) {
      toast.error("No email address found.");
      return;
    }

    setIsResetOpen(false);
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success("Sent, email might be in spam");
    } catch (error) {
      console.error("Password reset failed:", error);
      toast.error("Failed to send reset email.");
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Account"
        rightSlot={<ThemeSwithcer />}
      />

      <div className="flex flex-1 flex-col gap-6 p-4 pt-0 md:p-6 md:pt-0 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
        <Card>
          <CardHeader className="relative">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg md:text-xl">
                Account Details
              </CardTitle>
              <CardDescription>Manage your account.</CardDescription>
            </div>
            <Button
              className="absolute right-6 top-6 h-10"
              onClick={() => router.push("/profile")}
            >
              Edit Details
            </Button>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="account-name"
                  className="flex items-center gap-2"
                >
                  <User className="size-4 text-muted-foreground" />
                  Full name
                </Label>
                <Input
                  id="account-name"
                  value={fullName}
                  className="h-11"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="account-email"
                  className="flex items-center gap-2"
                >
                  <Mail className="size-4 text-muted-foreground" />
                  Email address
                </Label>
                <Input
                  id="account-email"
                  value={user?.email ?? ""}
                  className="h-11"
                  disabled
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="account-username">Username</Label>
                <Input
                  id="account-username"
                  value={user?.username ? `@${user.username}` : ""}
                  className="h-11"
                  disabled
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Security</CardTitle>
              <CardDescription>
                Update your password and security preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <KeyRound className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-muted-foreground">
                      Last updated 2 weeks ago
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-9"
                  onClick={() => setIsResetOpen(true)}
                  disabled={isSendingReset}
                >
                  Change
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Two-factor auth</p>
                    <p className="text-xs text-muted-foreground">
                      Protect your account with 2FA
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-9" disabled>
                  Coming soon
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Payments</CardTitle>
              <CardDescription>
                Manage your gcash account and payments.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <CreditCard className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Payment method</p>
                    <p className="text-xs text-muted-foreground">
                      No gcash number added yet
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-9">
                  Add GCash
                </Button>
              </div>
              <div className="rounded-lg border border-border/60 px-4 py-3">
                <p className="text-sm font-medium">Payments</p>
                <p className="text-xs text-muted-foreground">
                  View past payments.
                </p>
                <Button size="sm" className="mt-3 h-9">
                  View payments
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">
              Danger Zone
            </CardTitle>
            <CardDescription>
              These actions are permanent and cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-semibold text-destructive">
                Delete account
              </p>
              <p className="text-xs text-muted-foreground">
                This will remove your Seatwise account and all related data.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button className="h-11 w-full sm:w-auto" variant="destructive">
                  Delete account
                </Button>
                <Button className="h-11 w-full sm:w-auto" variant="outline">
                  Contact support
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Send the password reset email to {user?.email ?? "your email"}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handlePasswordReset} disabled={isSendingReset}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
