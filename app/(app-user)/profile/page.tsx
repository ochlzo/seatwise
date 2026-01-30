"use client";

import { useState, useEffect } from "react";
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
import { updateProfileAction, checkUsernameAction } from "@/lib/actions/updateProfile";
import { cn } from "@/lib/utils";
import { Field, FieldLabel } from "@/components/ui/field";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer"

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
  const [fieldErrors, setFieldErrors] = useState<{
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  }>({
    username: null,
    first_name: null,
    last_name: null,
  });
  const [usernameTaken, setUsernameTaken] = useState(false);

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
      // Clear errors when user data loads
      setFieldErrors({
        username: null,
        first_name: null,
        last_name: null,
      });
      setUsernameTaken(false);
    }
  }, [user]);

  // Real-time username validation
  useEffect(() => {
    if (!isEditing) return;

    const username = formData.username.trim();

    // Clear errors if username is empty
    if (username.length === 0) {
      setFieldErrors(prev => ({ ...prev, username: null }));
      setUsernameTaken(false);
      return;
    }

    // Validate length
    if (username.length < 2) {
      setFieldErrors(prev => ({ ...prev, username: "Username must be at least 2 characters." }));
      setUsernameTaken(false);
      return;
    }
    if (username.length > 20) {
      setFieldErrors(prev => ({ ...prev, username: "Username must be at most 20 characters." }));
      setUsernameTaken(false);
      return;
    }

    // Check uniqueness with debounce
    const timer = setTimeout(async () => {
      try {
        const uid = user?.uid || undefined;
        const result = await checkUsernameAction(username, uid);
        if (result.taken) {
          setFieldErrors(prev => ({ ...prev, username: "Username is already taken." }));
          setUsernameTaken(true);
        } else {
          setFieldErrors(prev => ({ ...prev, username: null }));
          setUsernameTaken(false);
        }
      } catch (err) {
        console.error("Uniqueness check failed:", err);
        setUsernameTaken(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username, isEditing, user?.uid]);

  if (authLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSave = async () => {
    // Validate all fields
    const newErrors = {
      username: null as string | null,
      first_name: null as string | null,
      last_name: null as string | null,
    };
    let hasErrors = false;

    // Validate username
    const username = formData.username.trim();
    if (username.length < 2) {
      newErrors.username = "Username must be at least 2 characters.";
      hasErrors = true;
    } else if (username.length > 20) {
      newErrors.username = "Username must be at most 20 characters.";
      hasErrors = true;
    } else if (usernameTaken) {
      newErrors.username = "Username is already taken.";
      hasErrors = true;
    } else {
      // Final uniqueness check before submission
      try {
        const uid = user?.uid || undefined;
        const result = await checkUsernameAction(username, uid);
        if (result.taken) {
          newErrors.username = "Username is already taken.";
          setUsernameTaken(true);
          hasErrors = true;
        }
      } catch (err) {
        console.error("Final username check failed:", err);
      }
    }

    // Validate first name
    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required.";
      hasErrors = true;
    }

    // Validate last name
    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required.";
      hasErrors = true;
    }

    setFieldErrors(newErrors);
    if (hasErrors) {
      return;
    }

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
        // Map server errors to appropriate fields
        const errorMessage = result.error || "Failed to update profile.";
        if (errorMessage.toLowerCase().includes("username")) {
          setFieldErrors(prev => ({ ...prev, username: errorMessage }));
        } else if (errorMessage.toLowerCase().includes("first name") || errorMessage.toLowerCase().includes("firstname")) {
          setFieldErrors(prev => ({ ...prev, first_name: errorMessage }));
        } else if (errorMessage.toLowerCase().includes("last name") || errorMessage.toLowerCase().includes("lastname")) {
          setFieldErrors(prev => ({ ...prev, last_name: errorMessage }));
        } else {
          // For other errors, show on username field as fallback
          setFieldErrors(prev => ({ ...prev, username: errorMessage }));
        }
      }
    } catch {
      // For unexpected errors, show on username field
      setFieldErrors(prev => ({ ...prev, username: "An unexpected error occurred." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="User Profile"
        rightSlot={<ThemeSwithcer />}
      />

      <div className="flex flex-1 flex-col gap-6 p-4 pt-0 md:p-6 md:pt-0 max-w-4xl mx-auto w-full animate-in fade-in duration-500">
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
            <div className="text-center px-4">
              <CardTitle className="text-2xl md:text-3xl font-brand font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent break-words">
                {user.firstName} {user.lastName}
              </CardTitle>
              <p className="text-sm md:text-base text-muted-foreground font-medium mt-1">
                @{user.username}
              </p>
            </div>
          </CardHeader>

          <CardContent className="pt-12 md:pt-14 pb-10 relative group">
            {/* Edit/Save Button Container */}
            <div className="absolute top-0 right-4 z-10">
              {isEditing ? (
                <div className="flex gap-2 animate-in slide-in-from-right-2 duration-300">
                  <Button
                    onClick={handleSave}
                    disabled={
                      isSubmitting ||
                      !!fieldErrors.username ||
                      !!fieldErrors.first_name ||
                      !!fieldErrors.last_name ||
                      usernameTaken
                    }
                    size="sm"
                    className="h-9 md:h-8 px-4 md:px-3 rounded-lg bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    <span className="text-xs font-semibold">Save</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        username: user.username || "",
                        first_name: user.firstName || "",
                        last_name: user.lastName || "",
                      });
                      setFieldErrors({
                        username: null,
                        first_name: null,
                        last_name: null,
                      });
                      setUsernameTaken(false);
                    }}
                    disabled={isSubmitting}
                    className="h-9 w-9 md:h-8 md:w-8 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-9 md:h-8 px-3.5 md:px-3 rounded-lg border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all group/btn"
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1.5 text-primary group-hover/btn:scale-110 transition-transform" />
                  <span className="text-xs font-semibold">Edit</span>
                </Button>
              )}
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              {/* Username */}
              <div className="space-y-1.5 transition-all">
                {isEditing ? (
                  <Field data-invalid={!!fieldErrors.username || usernameTaken}>
                    <div className="flex items-center justify-between w-full">
                      <FieldLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold ml-1">
                        Username
                      </FieldLabel>
                      {fieldErrors.username && (
                        <span className="text-[10px] font-medium text-destructive animate-appear">
                          {fieldErrors.username}
                        </span>
                      )}
                    </div>
                    <Input
                      value={formData.username}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, username: e.target.value }));
                        if (fieldErrors.username) {
                          setFieldErrors(prev => ({ ...prev, username: null }));
                        }
                        if (usernameTaken) {
                          setUsernameTaken(false);
                        }
                      }}
                      placeholder="johndoe"
                      className={cn(
                        "h-12 bg-secondary/20 rounded-xl transition-all font-medium border",
                        (fieldErrors.username || usernameTaken)
                          ? "border-destructive"
                          : "border-border/50 focus:ring-primary/20 focus:ring-2"
                      )}
                      autoFocus
                    />
                  </Field>
                ) : (
                  <>
                    <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold ml-1">
                      Username
                    </Label>
                    <div className="h-12 flex items-center px-4 bg-secondary/10 border border-border/30 rounded-xl font-medium text-foreground relative overflow-hidden group/item">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity" />
                      {user.username}
                    </div>
                  </>
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
                {isEditing ? (
                  <Field data-invalid={!!fieldErrors.first_name}>
                    <div className="flex items-center justify-between w-full">
                      <FieldLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold ml-1">
                        First Name
                      </FieldLabel>
                      {fieldErrors.first_name && (
                        <span className="text-[10px] font-medium text-destructive animate-appear">
                          {fieldErrors.first_name}
                        </span>
                      )}
                    </div>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, first_name: e.target.value }));
                        if (fieldErrors.first_name) {
                          setFieldErrors(prev => ({ ...prev, first_name: null }));
                        }
                      }}
                      placeholder="John"
                      className={cn(
                        "h-12 bg-secondary/20 rounded-xl transition-all font-medium border",
                        fieldErrors.first_name
                          ? "border-destructive"
                          : "border-border/50 focus:ring-primary/20 focus:ring-2"
                      )}
                    />
                  </Field>
                ) : (
                  <>
                    <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold ml-1">
                      First Name
                    </Label>
                    <div className="h-12 flex items-center px-4 bg-secondary/10 border border-border/30 rounded-xl font-medium text-foreground relative overflow-hidden group/item text-ellipsis whitespace-nowrap overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity" />
                      {user.firstName || "—"}
                    </div>
                  </>
                )}
              </div>

              {/* Last Name */}
              <div className="space-y-1.5">
                {isEditing ? (
                  <Field data-invalid={!!fieldErrors.last_name}>
                    <div className="flex items-center justify-between w-full">
                      <FieldLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold ml-1">
                        Last Name
                      </FieldLabel>
                      {fieldErrors.last_name && (
                        <span className="text-[10px] font-medium text-destructive animate-appear">
                          {fieldErrors.last_name}
                        </span>
                      )}
                    </div>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, last_name: e.target.value }));
                        if (fieldErrors.last_name) {
                          setFieldErrors(prev => ({ ...prev, last_name: null }));
                        }
                      }}
                      placeholder="Doe"
                      className={cn(
                        "h-12 bg-secondary/20 rounded-xl transition-all font-medium border",
                        fieldErrors.last_name
                          ? "border-destructive"
                          : "border-border/50 focus:ring-primary/20 focus:ring-2"
                      )}
                    />
                  </Field>
                ) : (
                  <>
                    <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold ml-1">
                      Last Name
                    </Label>
                    <div className="h-12 flex items-center px-4 bg-secondary/10 border border-border/30 rounded-xl font-medium text-foreground relative overflow-hidden group/item text-ellipsis whitespace-nowrap overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity" />
                      {user.lastName || "—"}
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
