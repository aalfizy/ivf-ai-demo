"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";

/** Served from `public/images/logo.png` → URL `/images/logo.png` (never `/public/...`). */
export const BRANDING_LOGO_PATH = "/images/logo.png" as const;

type BrandingLogoProps = {
  /** Fixed top-right corner (home). */
  variant?: "corner" | "inline";
  className?: string;
};

/**
 * Serverat branding — Next `Image` first, plain `<img>` if optimization fails.
 * Corner: physical top-right, high z-index so backdrops never cover it.
 */
export default function BrandingLogo({
  variant = "corner",
  className = "",
}: BrandingLogoProps) {
  const [useNativeImg, setUseNativeImg] = useState(false);

  const onImageError = useCallback(() => {
    console.warn(
      "[BrandingLogo] next/image failed — falling back to <img>",
      BRANDING_LOGO_PATH
    );
    setUseNativeImg(true);
  }, []);

  const logoClasses =
    "h-auto w-[120px] max-w-[120px] object-contain align-middle block";

  const picture = useNativeImg ? (
    <img
      src={BRANDING_LOGO_PATH}
      alt="Serverat Logo"
      width={120}
      height={120}
      className={logoClasses}
      decoding="async"
      fetchPriority={variant === "corner" ? "high" : "auto"}
    />
  ) : (
    <Image
      src={BRANDING_LOGO_PATH}
      alt="Serverat Logo"
      width={120}
      height={120}
      className={logoClasses}
      sizes="120px"
      priority={variant === "corner"}
      /** Skip optimizer so `/images/...` is requested as a normal static asset (fewer 404s on odd hosts). */
      unoptimized
      onError={onImageError}
    />
  );

  const baseRing =
    "rounded-lg p-1 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

  if (variant === "corner") {
    return (
      <Link
        href="/"
        className={`pointer-events-auto fixed right-4 top-4 z-[100] block max-w-[132px] shrink-0 sm:right-6 sm:top-5 ${baseRing} ${className}`}
        aria-label="Serverat — الرئيسية"
      >
        {picture}
      </Link>
    );
  }

  return (
    <Link
      href="/"
      className={`inline-block max-w-[132px] shrink-0 ${baseRing} ${className}`}
      aria-label="Serverat — الرئيسية"
    >
      {picture}
    </Link>
  );
}
