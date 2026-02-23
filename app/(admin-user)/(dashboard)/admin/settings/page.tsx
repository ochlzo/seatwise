"use client";

import * as React from "react";
import Image from "next/image";
import { CreditCard, ImageUp, UserRound, Hash, Type } from "lucide-react";
import { toast } from "sonner";
import AdminShield from "@/components/AdminShield";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileImagePreview } from "@/components/ui/file-uploader";

const MAX_QR_IMAGE_SIZE = 2 * 1024 * 1024;

type FormValues = {
  gcashNumber: string;
  gcashName: string;
  initials: string;
};

type FormErrors = Partial<Record<keyof FormValues | "qrImage", string>>;
const INITIAL_FORM: FormValues = {
  gcashNumber: "",
  gcashName: "",
  initials: "",
};

const normalizeGcashNumber = (value: string) => value.replace(/\D/g, "").slice(0, 11);

const normalizeInitials = (value: string) =>
  value.toUpperCase().replace(/[^A-Z*]/g, "").slice(0, 4);

const validateForm = (values: FormValues, hasQrImage: boolean): FormErrors => {
  const errors: FormErrors = {};

  if (!hasQrImage) {
    errors.qrImage = "Upload your GCash QR image.";
  }

  if (!/^09\d{9}$/.test(values.gcashNumber)) {
    errors.gcashNumber = "Enter a valid 11-digit GCash number (e.g. 09XXXXXXXXX).";
  }

  const trimmedName = values.gcashName.trim();
  if (trimmedName.length < 2 || trimmedName.length > 80) {
    errors.gcashName = "Account name must be 2 to 80 characters.";
  } else if (!/^[A-Za-z][A-Za-z .'-]*$/.test(trimmedName)) {
    errors.gcashName = "Use letters, spaces, apostrophes, periods, or hyphens only.";
  }

  if (!/^[A-Z*]{2,4}$/.test(values.initials)) {
    errors.initials = "Initials must be 2 to 4 characters (letters or *).";
  }

  return errors;
};

export default function SettingsPage() {
  const [form, setForm] = React.useState<FormValues>(INITIAL_FORM);
  const [savedForm, setSavedForm] = React.useState<FormValues>(INITIAL_FORM);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [qrImagePreview, setQrImagePreview] = React.useState<string | null>(null);
  const [savedQrImagePreview, setSavedQrImagePreview] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isQrPreviewOpen, setIsQrPreviewOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const hasChanges = React.useMemo(() => {
    return (
      form.gcashNumber !== savedForm.gcashNumber ||
      form.gcashName !== savedForm.gcashName ||
      form.initials !== savedForm.initials ||
      qrImagePreview !== savedQrImagePreview
    );
  }, [form, qrImagePreview, savedForm, savedQrImagePreview]);

  React.useEffect(() => {
    return () => {
      if (qrImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(qrImagePreview);
      }
    };
  }, [qrImagePreview]);

  const setField = (field: keyof FormValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleQrChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, qrImage: "Please select an image file." }));
      return;
    }

    if (file.size > MAX_QR_IMAGE_SIZE) {
      setErrors((prev) => ({ ...prev, qrImage: "Image size must be 2MB or less." }));
      return;
    }

    if (qrImagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(qrImagePreview);
    }

    setQrImagePreview(URL.createObjectURL(file));
    setErrors((prev) => ({ ...prev, qrImage: undefined }));
  };

  const handleSave = async () => {
    const validationErrors = validateForm(form, Boolean(qrImagePreview));
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix validation errors before saving.");
      return;
    }

    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsSaving(false);
    setSavedForm({ ...form });
    setSavedQrImagePreview(qrImagePreview);
    toast.success("GCash settings saved (UI-only demo).");
  };

  const handleCancel = () => {
    setForm(savedForm);
    setQrImagePreview(savedQrImagePreview);
    setErrors({});
    if (!savedQrImagePreview && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 pt-0 md:p-8 md:pt-0">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold md:text-2xl">App Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure payment details and other account-level preferences.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>
              Manage customer-facing payment account details used in checkout flows.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Accordion type="single" collapsible defaultValue="gcash-payment" className="w-full">
              <AccordionItem value="gcash-payment">
                <AccordionTrigger className="text-base">
                  <span className="inline-flex items-center gap-2">
                    <CreditCard className="size-4 text-muted-foreground" />
                    GCash Account Setup
                  </span>
                </AccordionTrigger>

                <AccordionContent className="space-y-6 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="gcash-qr-upload" className="inline-flex items-center gap-2">
                      <ImageUp className="size-4 text-muted-foreground" />
                      QR Code
                    </Label>

                    {qrImagePreview && (
                      <div className="flex items-center gap-3 pt-1">
                        <Dialog open={isQrPreviewOpen} onOpenChange={setIsQrPreviewOpen}>
                          <DialogTrigger asChild>
                            <button
                              type="button"
                              className="cursor-pointer rounded-md border border-gray-400 p-0.5 transition-opacity hover:opacity-90"
                              aria-label="Open full QR code preview"
                            >
                              <FileImagePreview
                                src={qrImagePreview}
                                alt="GCash QR preview"
                                className="size-14 rounded-sm"
                              />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-xl">
                            <DialogHeader>
                              <DialogTitle>QR Code Preview</DialogTitle>
                              <DialogDescription>
                                Full-size preview of the uploaded GCash QR code.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-center py-2">
                              <Image
                                src={qrImagePreview}
                                alt="GCash QR code full preview"
                                width={640}
                                height={640}
                                unoptimized
                                className="h-auto max-h-[70vh] w-full max-w-md rounded-md border border-black object-contain"
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        ref={fileInputRef}
                        id="gcash-qr-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleQrChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {qrImagePreview ? "Change QR Code" : "Upload QR Code"}
                      </Button>
                    </div>

                    {errors.qrImage && <p className="text-xs text-destructive">{errors.qrImage}</p>}
                    <p className="text-xs text-muted-foreground">
                      Use a clear PNG or JPG image, maximum 2MB.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="gcash-number" className="inline-flex items-center gap-2">
                        <Hash className="size-4 text-muted-foreground" />
                        GCash Account Number
                      </Label>
                      <Input
                        id="gcash-number"
                        type="tel"
                        inputMode="numeric"
                        placeholder="09XXXXXXXXX"
                        value={form.gcashNumber}
                        onChange={(event) =>
                          setField("gcashNumber", normalizeGcashNumber(event.target.value))
                        }
                        aria-invalid={Boolean(errors.gcashNumber)}
                        maxLength={11}
                      />
                      {errors.gcashNumber && (
                        <p className="text-xs text-destructive">{errors.gcashNumber}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gcash-name" className="inline-flex items-center gap-2">
                        <UserRound className="size-4 text-muted-foreground" />
                        GCash Account Name
                      </Label>
                      <Input
                        id="gcash-name"
                        placeholder="Juan Dela Cruz"
                        value={form.gcashName}
                        onChange={(event) => setField("gcashName", event.target.value)}
                        aria-invalid={Boolean(errors.gcashName)}
                        maxLength={80}
                      />
                      {errors.gcashName && (
                        <p className="text-xs text-destructive">{errors.gcashName}</p>
                      )}
                    </div>
                  </div>

                  <div className="max-w-xs space-y-2">
                    <Label htmlFor="gcash-initials" className="inline-flex items-center gap-2">
                      <Type className="size-4 text-muted-foreground" />
                      Initials
                    </Label>
                    <Input
                      id="gcash-initials"
                      placeholder="JDC"
                      value={form.initials}
                      onChange={(event) => setField("initials", normalizeInitials(event.target.value))}
                      aria-invalid={Boolean(errors.initials)}
                      maxLength={4}
                    />
                    {errors.initials && <p className="text-xs text-destructive">{errors.initials}</p>}
                  </div>

                  {hasChanges && (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
