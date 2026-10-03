import type { SVGProps } from "react";

type NavIconName = "home" | "trip" | "radar" | "stats" | "profile";

export function NavIcon({ name, filled, ...props }: SVGProps<SVGSVGElement> & {
  name: NavIconName;
  filled: boolean;
}) {
  const common = { vectorEffect: "non-scaling-stroke" as const };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {name === "home" ? filled ? (
        <path fill="currentColor" stroke="none" d="M2.8 10.4 12 2.9l9.2 7.5v9.1a1.6 1.6 0 0 1-1.6 1.6h-5.1v-6.4h-5v6.4H4.4a1.6 1.6 0 0 1-1.6-1.6z" />
      ) : (
        <path {...common} d="m3 10.5 9-7.3 9 7.3v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6.3h-5V21h-5A1.5 1.5 0 0 1 3 19.5z" />
      ) : null}
      {name === "trip" ? (
        filled ? (
          <path fill="currentColor" stroke="none" d="m2.5 4.8 6-2.3 7 2.8 6-2.3v16.2l-6 2.3-7-2.8-6 2.3zm6 0v11.8l7 2.8V7.5z" />
        ) : (
          <>
            <path {...common} d="m2.5 4.8 6-2.3 7 2.8 6-2.3v16.2l-6 2.3-7-2.8-6 2.3z" />
            <path {...common} d="M8.5 2.5v16.2M15.5 5.3v16.2" />
          </>
        )
      ) : null}
      {name === "radar" ? (
        <>
          <path {...common} fill={filled ? "currentColor" : "none"} d="m3.3 12.4 9.6-9 4.1 4.1-9.6 9z" />
          <path {...common} d="m10.1 14.1 3.2 6.1M15.5 13.4l2.3 2.3 2.8-2.8-2.3-2.3M5.5 21h13" />
        </>
      ) : null}
      {name === "stats" ? filled ? (
        <>
          <rect x="3" y="13" width="4.5" height="8" rx="1.4" fill="currentColor" stroke="none" />
          <rect x="9.75" y="8" width="4.5" height="13" rx="1.4" fill="currentColor" stroke="none" />
          <rect x="16.5" y="3" width="4.5" height="18" rx="1.4" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <rect {...common} x="3" y="13" width="4.5" height="8" rx="1.4" />
          <rect {...common} x="9.75" y="8" width="4.5" height="13" rx="1.4" />
          <rect {...common} x="16.5" y="3" width="4.5" height="18" rx="1.4" />
        </>
      ) : null}
      {name === "profile" ? filled ? (
        <>
          <circle cx="12" cy="7.6" r="4" fill="currentColor" stroke="none" />
          <path fill="currentColor" stroke="none" d="M4.2 21a7.8 7.8 0 0 1 15.6 0z" />
        </>
      ) : (
        <>
          <circle {...common} cx="12" cy="7.5" r="3.8" />
          <path {...common} d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </>
      ) : null}
    </svg>
  );
}
