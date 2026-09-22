"use client";

import { LiquiThemeProvider } from "@liqui-design/glass";
import type { ReactNode } from "react";

const packAndGoLiquiTheme = {
  glass: {
    material: "auto" as const,
    profile: "squircle" as const,
    frost: 0.34,
    specular: 0.72,
    dispersion: 0,
    saturation: 1.24,
    radiusScale: 1,
    refractionScale: 1,
    bezelScale: 1,
    blurScale: 1,
  },
};

export function PackAndGoLiquiTheme({ children }: { children: ReactNode }) {
  return (
    <LiquiThemeProvider theme={packAndGoLiquiTheme} injectTokens={false}>
      {children}
    </LiquiThemeProvider>
  );
}
