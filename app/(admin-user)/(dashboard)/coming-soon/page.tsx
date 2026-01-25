import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import AdminShield from "@/components/AdminShield";
import { ComingSoonClient } from "@/components/coming-soon-client";

export default async function ComingSoonPage() {
    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <PageHeader
                title="Coming Soon"
                parentLabel="Admin"
                parentHref="/admin"
                rightSlot={
                    <>
                        <ThemeSwithcer />
                        <AdminShield />
                    </>
                }
            />
            <ComingSoonClient />
        </div>
    );
}
