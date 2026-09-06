import Link from "next/link";
import { Bell, HelpCircle, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/PageHeader";
import { SignOutButton } from "@/components/shared/SignOutButton";

const links = [
  { icon: User, label: "Profile", href: "/branch/profile" },
  { icon: Bell, label: "Notification Settings", href: "/branch/notifications" },
  { icon: HelpCircle, label: "Help", href: "/branch/profile" },
];

export default function BranchProfilePage() {
  return (
    <div className="max-w-[600px] mx-auto space-y-5">
      <PageHeader title="More" subtitle="Profile, help, and account." />

      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <Avatar className="w-14 h-14">
            <AvatarFallback className="bg-accent text-accent-foreground text-sm font-semibold">
              AR
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-base font-semibold text-forest">Arun R.</div>
            <div className="text-xs text-muted-foreground">
              Branch Manager · Aaha Oshawa
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-2 divide-y divide-border">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="flex items-center gap-3 px-3 py-3 hover:bg-muted rounded-lg"
            >
              <l.icon className="size-4 text-muted-foreground" />
              <span className="text-sm">{l.label}</span>
            </Link>
          ))}
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
