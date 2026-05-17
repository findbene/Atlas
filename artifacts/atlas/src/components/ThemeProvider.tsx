/**
 * Theme provider. Wraps next-themes so the app gets a working dark/light
 * toggle without us having to reinvent the storage + flash-of-wrong-theme
 * dance. Default is dark since that's how Atlas was designed.
 */
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="atlas-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
