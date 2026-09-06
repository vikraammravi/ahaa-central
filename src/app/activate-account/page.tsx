import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

// In production this comes from the invitation token (?token=...)
// and may reflect either a Branch Manager or a Central Admin invite.
type InvitationPayload = {
  invitee: string;
  role: string;
  scope?: string; // e.g. branch name, or null for central admin
};

const demoInvite: InvitationPayload = {
  invitee: "Karthik S.",
  role: "Branch Manager",
  scope: "Aaha North York",
};

export default function ActivateAccountPage() {
  const invite = demoInvite;

  return (
    <AuthShell
      title="Welcome to Aaha Central"
      subtitle={`Hi ${invite.invitee}, you've been invited to join the team.`}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border p-4 bg-background space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Invitation
            </span>
            <StatusBadge status="pending" label="Pending" />
          </div>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Role
            </div>
            <div className="mt-0.5 text-sm font-medium text-forest">
              {invite.role}
            </div>
          </div>

          {invite.scope && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Branch
              </div>
              <div className="mt-0.5 text-sm font-medium text-forest">
                {invite.scope}
              </div>
            </div>
          )}
        </div>

        <Link href="/set-password" className="block">
          <Button size="lg" className="w-full">
            Activate Account
          </Button>
        </Link>

        <div className="text-center text-xs text-muted-foreground">
          Not you?{" "}
          <Link href="/login" className="text-saffron-hover font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
