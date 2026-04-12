"use client";

import * as React from "react";
import { Link2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

interface CopyShowLinkButtonProps {
  showId: string;
  className?: string;
  label?: string;
  hrefPath?: string;
}

export function CopyShowLinkButton({
  showId,
  className,
  label = "Copy show link",
  hrefPath,
}: CopyShowLinkButtonProps) {
  const [isCopying, setIsCopying] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    if (isCopying) return;

    setIsCopying(true);
    try {
      const baseUrl = window.location.origin;
      const resolvedPath = hrefPath ?? `/${showId}`;
      const normalizedPath = resolvedPath.startsWith("/")
        ? resolvedPath
        : `/${resolvedPath}`;
      await navigator.clipboard.writeText(`${baseUrl}${normalizedPath}`);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Failed to copy link.");
    } finally {
      setIsCopying(false);
    }
  }, [hrefPath, isCopying, showId]);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void handleCopy()}
      disabled={isCopying}
      className={className}
    >
      {isCopying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
      {isCopying ? "Copying..." : label}
    </Button>
  );
}
