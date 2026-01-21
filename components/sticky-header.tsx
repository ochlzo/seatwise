"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type StickyHeaderProps = React.ComponentProps<"header">;

export function StickyHeader({ className, ...props }: StickyHeaderProps) {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const headerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const inset = headerRef.current?.closest<HTMLElement>(
      "[data-slot='sidebar-inset']",
    );
    if (!inset) return;

    const handleScroll = () => {
      setIsScrolled(inset.scrollTop > 10);
    };

    handleScroll();
    inset.addEventListener("scroll", handleScroll, { passive: true });
    return () => inset.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      ref={headerRef}
      className={cn(
        "sticky top-0 z-10 transition-all duration-300",
        isScrolled
          ? "h-12 bg-background/40 backdrop-blur-md shadow-sm py-2"
          : "h-16 bg-background py-3",
        className,
      )}
      {...props}
    />
  );
}
