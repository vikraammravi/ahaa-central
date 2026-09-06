import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";

export default function AdminSettingsPage() {
  return (
    <div className="max-w-[900px] mx-auto space-y-5">
      <PageHeader title="Settings" subtitle="Organization, tax, and notification defaults." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          { title: "Organization", body: "Aaha Central Kitchen · Ontario, CA" },
          { title: "Tax Rate", body: "HST — 13%" },
          { title: "Order Cutoff", body: "Daily at 10:00 AM local time" },
          { title: "Notifications", body: "Email + in-app for all critical events" },
        ].map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle className="text-base">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {s.body}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
