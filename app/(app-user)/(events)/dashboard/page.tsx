import { PageHeader } from "@/components/page-header";
import ShowsClient from "@/app/(admin-user)/(dashboard)/admin/shows/ShowsClient";
import { ThemeSwithcer } from "@/components/theme-swithcer";

export default async function Page() {
  return (
    <>
      <PageHeader title="Dashboard" rightSlot={<ThemeSwithcer />} />
      <ShowsClient
        mode="user"
        basePath="/dashboard"
        detailBasePath=""
        enableLinks
        showHeader={false}
        statusGroup="active"
        visibility="user"
        statusFilterValues={["ALL", "UPCOMING", "OPEN", "DRY_RUN", "ON_GOING", "CLOSED"]}
        statusLabelOverrides={{ CLOSED: "Past Shows" }}
        headerTitle="What’s On Deck"
        headerSubtitle="Upcoming, open, and ongoing shows that are ready for your seat."
      />
    </>
  );
}
