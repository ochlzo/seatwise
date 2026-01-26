import { PageHeader } from "@/components/page-header";
import AdminShield from "@/components/AdminShield";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { CreateShowForm } from "./CreateShowForm";

export default function CreateShowPage() {
  return (
    <>
      <PageHeader
        title="Create Show"
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 pt-0 max-w-5xl mx-auto w-full">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg md:text-xl font-semibold">New Production</h2>
          <p className="text-muted-foreground text-sm">
            Add a new show and set its schedule.
          </p>
        </div>
        <CreateShowForm />
      </div>
    </>
  );
}
