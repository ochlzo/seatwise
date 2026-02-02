import { PageHeader } from "@/components/page-header";
import ShowsClient from "@/app/(admin-user)/(dashboard)/admin/shows/ShowsClient";

export default async function Page() {
  return (
    <>
      <PageHeader title="All Events" />
      <ShowsClient
        mode="user"
        basePath="/all-events"
        enableLinks={false}
        showHeader={false}
        visibility="user"
        headerTitle="Everything On Stage"
        headerSubtitle="Past, present, and upcoming—browse the full lineup."
      />
    </>
  );
}
