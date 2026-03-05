import { PageHeader } from "@/components/page-header";
import AdminShield from "@/components/AdminShield";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { AdminAccessClient } from "./AdminAccessClient";

export default function AdminAccessPage() {
  return (
    <>
      <PageHeader
        title="Admin Access"
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <AdminAccessClient />
      </div>
    </>
  );
}
