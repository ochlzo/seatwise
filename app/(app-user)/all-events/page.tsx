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
      />
    </>
  );
}
