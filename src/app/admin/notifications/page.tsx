import { PageHeader } from "@/components/shared/PageHeader";
import { NotificationList } from "@/components/shared/NotificationList";

export default function AdminNotificationsPage() {
  return (
    <div className="max-w-[900px] mx-auto space-y-5">
      <PageHeader title="Notifications" subtitle="Everything happening across the central kitchen." />
      <NotificationList audience="admin" />
    </div>
  );
}
