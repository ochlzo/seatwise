import { PageHeader } from "@/components/page-header";
import ShowsClient from "@/app/(admin-user)/(dashboard)/admin/shows/ShowsClient";
import { ThemeSwithcer } from "@/components/theme-swithcer";

export default async function Page() {
  return (
    <>
      <PageHeader title="All Events" rightSlot={<ThemeSwithcer />} />
      <ShowsClient
        mode="user"
        basePath="/all-events"
        detailBasePath=""
        enableLinks
        showHeader={false}
        visibility="user"
        statusFilterValues={["ALL", "UPCOMING", "OPEN", "ON_GOING", "CLOSED"]}
        headerTitle="Everything On Stage"
        headerSubtitle="Past, present, and upcoming—browse the full lineup."
      />
    </>
  );
}
