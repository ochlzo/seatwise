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
