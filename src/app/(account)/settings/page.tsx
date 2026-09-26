import type { Metadata } from "next";
import { Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { NotificationPrefsForm, PasswordForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" />
      <Card>
        <CardHeader title="Account" />
        <CardBody>
          <DescriptionList
            items={[
              { label: "Name", value: user.name },
              { label: "Email", value: user.email },
              { label: "Account type", value: <span className="capitalize">{user.role}</span> },
              { label: "Member since", value: formatDate(user.createdAt) },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Notification channels" />
        <CardBody>
          <NotificationPrefsForm d={{ phone: user.phone ?? "", notifyEmail: user.notifyEmail, notifySms: user.notifySms, notifyWhatsapp: user.notifyWhatsapp }} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Password" />
        <CardBody>
          <PasswordForm />
        </CardBody>
      </Card>
    </div>
  );
}
