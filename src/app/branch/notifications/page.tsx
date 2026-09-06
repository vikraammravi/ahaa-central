import { PageHeader } from "@/components/shared/PageHeader";
import { NotificationList } from "@/components/shared/NotificationList";

export default function BranchNotificationsPage() {
  return (
    <div className="max-w-[900px] mx-auto space-y-5">
      <PageHeader
        title="Notifications"
        subtitle="Updates for your branch."
      />
      <NotificationList audience="branch" />
    </div>
  );
}
