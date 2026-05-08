import React, { useState } from "react";
import idleSvg from "../assets/mascot/idle.svg";
import loadingSvg from "../assets/mascot/loading.svg";
import emptySvg from "../assets/mascot/empty.svg";
import successSvg from "../assets/mascot/success.svg";
import errorSvg from "../assets/mascot/error.svg";

type MascotVariant = "idle" | "loading" | "empty" | "success" | "error";

const VARIANT_MAP: Record<MascotVariant, { src: string; alt: string; fallback: string }> = {
  idle:    { src: idleSvg,    alt: " mascots idle",    fallback: "😊" },
  loading: { src: loadingSvg, alt: " mascots loading", fallback: "⏳" },
  empty:   { src: emptySvg,   alt: " mascots empty",   fallback: "📂" },
  success: { src: successSvg, alt: " mascots success", fallback: "✅" },
  error:   { src: errorSvg,   alt: " mascots error",   fallback: "⚠️" },
};

const SIZE_MAP = {
  sm: { width: 56, height: 56 },
  md: { width: 80, height: 80 },
  lg: { width: 120, height: 120 },
};

type MascotProps = {
  variant: MascotVariant;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  alt?: string;
  className?: string;
};

export default function Mascot({
  variant,
  size = "md",
  animated = true,
  alt,
  className = "",
}: MascotProps) {
  const [failed, setFailed] = useState(false);
  const config = VARIANT_MAP[variant];
  const dims = SIZE_MAP[size];

  if (failed) {
    return (
      <span
        className={`mascot-fallback ${className}`}
        style={{ fontSize: dims.width * 0.55, lineHeight: 1 }}
        role="img"
        aria-label={alt || config.alt}
      >
        {config.fallback}
      </span>
    );
  }

  const motionClass = animated ? `mascot--${variant}` : "";

  return (
    <img
      src={config.src}
      alt={alt || config.alt}
      width={dims.width}
      height={dims.height}
      className={`mascot ${motionClass} ${className}`}
      onError={() => setFailed(true)}
      style={{ display: "block", objectFit: "contain" }}
    />
  );
}
