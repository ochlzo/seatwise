"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard,
  KeyRound,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AccountPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Account</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 pt-0 md:p-6 md:pt-0 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Account Details</CardTitle>
            <CardDescription>
              Manage your profile information and account identifiers.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account-name" className="flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  Full name
                </Label>
                <Input
                  id="account-name"
                  placeholder="Seatwise User"
                  className="h-11"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-email" className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  Email address
                </Label>
                <Input
                  id="account-email"
                  placeholder="seatwise@example.com"
                  className="h-11"
                  disabled
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="account-username">Username</Label>
                <Input
                  id="account-username"
                  placeholder="@seatwise"
                  className="h-11"
                  disabled
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Profile edits will be available in the next update.
            </p>
            <Button className="h-11 w-full sm:w-auto" disabled>
              Edit Details
            </Button>
          </CardFooter>
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
                <Button size="sm" className="h-9">
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
                <Button size="sm" variant="outline" className="h-9">
                  Enable
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Billing</CardTitle>
              <CardDescription>
                Manage your billing method and invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <CreditCard className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Payment method</p>
                    <p className="text-xs text-muted-foreground">
                      No card added yet
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-9">
                  Add Card
                </Button>
              </div>
              <div className="rounded-lg border border-border/60 px-4 py-3">
                <p className="text-sm font-medium">Invoices</p>
                <p className="text-xs text-muted-foreground">
                  View and download past invoices.
                </p>
                <Button size="sm" className="mt-3 h-9">
                  View invoices
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
    </>
  );
}
