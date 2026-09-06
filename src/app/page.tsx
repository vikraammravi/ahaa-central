import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/shared/Logo";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="flex flex-col items-center">
          <Logo variant="full" size="xl" href={null} />
          <p className="text-muted-foreground mt-6 max-w-lg">
            The operations home for our central kitchen and every Aaha branch —
            keeping South Indian flavour moving from prep to plate.
          </p>
        </div>

        <div className="max-w-sm mx-auto">
          <Link href="/login" className="block">
            <Button size="lg" className="w-full">
              Sign In
            </Button>
          </Link>
          <div className="mt-3 text-xs text-muted-foreground">
            Got an invitation?{" "}
            <Link
              href="/activate-account"
              className="text-saffron-hover font-medium"
            >
              Activate account
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          <Card>
            <CardContent className="p-6 space-y-2">
              <h2 className="font-semibold text-forest">Branch Manager</h2>
              <p className="text-sm text-muted-foreground">
                Daily restock, catering, invoices — responsive across mobile,
                tablet, and desktop.
              </p>
              <Link
                href="/branch/home"
                className="text-sm text-saffron-hover font-medium inline-block pt-1"
              >
                Preview branch app →
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 space-y-2">
              <h2 className="font-semibold text-forest">Central Admin</h2>
              <p className="text-sm text-muted-foreground">
                Stock, orders, dispatch, branches, invoices — responsive
                console.
              </p>
              <Link
                href="/admin/dashboard"
                className="text-sm text-saffron-hover font-medium inline-block pt-1"
              >
                Preview admin console →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
