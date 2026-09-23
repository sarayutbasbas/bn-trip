"use client";

import Image from "next/image";
import { useState } from "react";

export function AirlineLogo({
  code,
  name,
  size = 38,
}: {
  code: string;
  name?: string | null;
  size?: number;
}) {
  const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const [failedCode, setFailedCode] = useState<string | null>(null);
  const failed = failedCode === normalizedCode;

  return (
    <span
      className={`flight-airline-mark${failed ? " is-fallback" : ""}`}
      style={{ width: size, height: size, flexBasis: size }}
      aria-label={name || normalizedCode}
    >
      {!failed && normalizedCode ? (
        <Image
          src={`https://images.kiwi.com/airlines/64/${normalizedCode}.png`}
          alt={name || normalizedCode}
          width={size}
          height={size}
          unoptimized
          onError={() => setFailedCode(normalizedCode)}
        />
      ) : (
        <b aria-hidden="true">{normalizedCode.slice(0, 3) || "✈"}</b>
      )}
    </span>
  );
}
