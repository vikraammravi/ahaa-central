import { ReactNode } from "react";
import { Logo } from "@/components/shared/Logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  showBrand = true,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  showBrand?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
          {showBrand && (
            <div className="flex justify-center mb-6">
              <Logo variant="full" size="lg" href="/" />
            </div>
          )}
          {(title || subtitle) && (
            <div className="space-y-1 mb-6 text-center">
              {title && (
                <h1 className="text-xl font-semibold text-forest heading-tight">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          )}
          {children}
          {footer && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          )}
        </div>
      </main>

      <footer className="p-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Aaha Central · Truly South
      </footer>
    </div>
  );
}
