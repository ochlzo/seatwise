import { verifyAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function AdminUserGroupLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Global security gate for all routes in the (admin-user) group
    // This includes both the dashboard and the specialized tools like seat-builder.
    // verifyAdmin() will automatically redirect to /dashboard if the user isn't an admin,
    // or /login if no valid session is found.
    await verifyAdmin();

    return <>{children}</>;
}
