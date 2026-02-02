import { PageHeader } from "@/components/page-header";
import ShowsClient from "@/app/(admin-user)/(dashboard)/admin/shows/ShowsClient";

export default async function Page() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <ShowsClient
        mode="user"
        basePath="/dashboard"
        enableLinks={false}
        showHeader={false}
        statusGroup="active"
        visibility="user"
        statusFilterValues={["ALL", "UPCOMING", "OPEN"]}
        headerTitle="What’s On Deck"
        headerSubtitle="Upcoming and open shows that are ready for your seat."
      />
    </>
  );
}
