"use client";

import { useState, useEffect } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Edit2, Save, X } from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setUser } from "@/lib/features/auth/authSlice";
import { setLoading } from "@/lib/features/loading/isLoadingSlice";

import { ProfileAvatarContainer } from "./ProfileAvatarContainer";
import { getDefaultAvatarsAction } from "@/lib/actions/getDefaultAvatars";
import { updateProfileAction } from "@/lib/actions/updateProfile";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const authLoading = useAppSelector((state) => state.auth.isLoading);

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultAvatars, setDefaultAvatars] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    username: "",
    first_name: "",
    last_name: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch default avatars
    const fetchAvatars = async () => {
      const avatars = await getDefaultAvatarsAction();
      setDefaultAvatars(avatars);
    };
    fetchAvatars();

    // Clear global loading
    dispatch(setLoading(false));
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || "",
        first_name: user.firstName || "",
        last_name: user.lastName || "",
      });
    }
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSave = async () => {
    // Basic Validations
    if (formData.username.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    if (formData.username.length > 20) {
      setError("Username must be at most 20 characters.");
      return;
    }
    if (!formData.first_name.trim()) {
      setError("First name is required.");
      return;
    }
    if (!formData.last_name.trim()) {
      setError("Last name is required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await updateProfileAction({
        username: formData.username,
        first_name: formData.first_name,
        last_name: formData.last_name,
      });

      if (result.success) {
        // Update local Redux state
        dispatch(setUser({
          ...user,
          username: formData.username,
          firstName: formData.first_name,
          lastName: formData.last_name,
          displayName: `${formData.first_name} ${formData.last_name}`.trim(),
        }));
        setIsEditing(false);
      } else {
        setError(result.error || "Failed to update profile.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>User Profile</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-4xl mx-auto w-full overflow-hidden animate-in fade-in duration-500">
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md relative overflow-hidden">
          {/* Background Decorative Element */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />



          <CardHeader className="flex flex-col items-center gap-4 pb-8 border-b border-border/50 relative">
            <ProfileAvatarContainer
              initialAvatarUrl={user.photoURL || ""}
              fallback={user.firstName?.[0] || user.username?.[0] || "U"}
              defaultAvatars={defaultAvatars}
            />
            <div className="text-center">
              <CardTitle className="text-3xl font-brand font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {user.firstName} {user.lastName}
              </CardTitle>
              <p className="text-muted-foreground font-medium mt-1">
                @{user.username}
              </p>
            </div>
          </CardHeader>

          <CardContent className="pt-14 pb-10 relative group">
            {/* Edit/Save Button Container */}
            <div className="absolute top-0 right-4 z-10">
              {isEditing ? (
                <div className="flex gap-2 animate-in slide-in-from-right-2 duration-300">
                  <Button
                    onClick={handleSave}
                    disabled={isSubmitting}
                    size="sm"
                    className="h-8 rounded-lg bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setError(null);
                      setFormData({
                        username: user.username || "",
                        first_name: user.firstName || "",
                        last_name: user.lastName || "",
                      });
                    }}
                    disabled={isSubmitting}
                    className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-8 px-3 rounded-lg border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all group/btn"
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1.5 text-primary group-hover/btn:scale-110 transition-transform" />
                  <span className="text-xs font-semibold">Edit</span>
                </Button>
              )}
            </div>
            {error && (
              <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <div className="grid gap-8 md:grid-cols-2">
              {/* Username */}
              <div className="space-y-1.5 transition-all">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold ml-1">
                  Username
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="johndoe"
                    className="h-12 bg-secondary/20 border-border/50 rounded-xl focus:ring-primary/20 transition-all font-medium"
                    autoFocus
                  />
                ) : (
                  <div className="h-12 flex items-center px-4 bg-secondary/10 border border-border/30 rounded-xl font-medium text-foreground relative overflow-hidden group/item">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity" />
                    {user.username}
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5 opacity-80">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold ml-1">
                  Email Address
                </Label>
                <div className="h-12 flex items-center px-4 bg-secondary/5 border border-dashed border-border/50 rounded-xl font-medium text-muted-foreground cursor-not-allowed">
                  {user.email}
                </div>
              </div>

              {/* First Name */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold ml-1">
                  First Name
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="John"
                    className="h-12 bg-secondary/20 border-border/50 rounded-xl focus:ring-primary/20 transition-all font-medium"
                  />
                ) : (
                  <div className="h-12 flex items-center px-4 bg-secondary/10 border border-border/30 rounded-xl font-medium text-foreground relative overflow-hidden group/item text-ellipsis whitespace-nowrap overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity" />
                    {user.firstName || "—"}
                  </div>
                )}
              </div>

              {/* Last Name */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold ml-1">
                  Last Name
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Doe"
                    className="h-12 bg-secondary/20 border-border/50 rounded-xl focus:ring-primary/20 transition-all font-medium"
                  />
                ) : (
                  <div className="h-12 flex items-center px-4 bg-secondary/10 border border-border/30 rounded-xl font-medium text-foreground relative overflow-hidden group/item text-ellipsis whitespace-nowrap overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity" />
                    {user.lastName || "—"}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
