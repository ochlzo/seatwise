import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SquarePen } from "lucide-react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getUserByFirebaseUid } from "@/lib/db/Users";

import { ProfileContent } from "./ProfileContent";

export default async function Page() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  // Even though layout checks this, we need it for the token decoding
  if (!sessionCookie) {
    redirect("/login");
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch (error) {
    redirect("/login");
  }

  const dbUser = await getUserByFirebaseUid(decodedToken.uid);

  if (!dbUser) {
    redirect("/login");
  }

  const avatarUrl = dbUser.avatarKey
    ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL}/${dbUser.avatarKey}`
    : `https://api.dicebear.com/9.x/avataaars/svg?seed=${dbUser.username || dbUser.email}`;

  return (
    <>
      <ProfileContent />
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>User Profile</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
        <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-col items-center gap-4 pb-8 border-b">
            <div className="relative group">
              <Avatar className="h-32 w-32 border-4 border-background shadow-lg transition-transform duration-300 group-hover:scale-[1.02]">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="text-2xl font-bold bg-[#3b82f6] text-white">
                  {dbUser.first_name?.[0] || dbUser.username?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <button
                className="absolute bottom-1 right-1 p-2.5 rounded-full bg-[#3b82f6] text-white shadow-xl border-2 border-background 
                           hover:bg-[#2563eb] transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                aria-label="Edit Profile Picture"
              >
                <SquarePen className="h-4 w-4" />
              </button>
            </div>
            <div className="text-center">
              <CardTitle className="text-3xl font-brand font-bold tracking-tight">
                {dbUser.first_name} {dbUser.last_name}
              </CardTitle>
              <p className="text-muted-foreground font-medium mt-1">
                @{dbUser.username}
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-8 grid gap-8 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Username
              </Label>
              <p className="text-lg font-medium bg-secondary/30 p-3 rounded-lg border">
                {dbUser.username}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Email Address
              </Label>
              <p className="text-lg font-medium bg-secondary/30 p-3 rounded-lg border">
                {dbUser.email}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                First Name
              </Label>
              <p className="text-lg font-medium bg-secondary/30 p-3 rounded-lg border">
                {dbUser.first_name || "—"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Last Name
              </Label>
              <p className="text-lg font-medium bg-secondary/30 p-3 rounded-lg border">
                {dbUser.last_name || "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="bg-muted/30 rounded-xl border border-dashed p-8 flex flex-col items-center justify-center text-center space-y-2">
          <p className="text-muted-foreground font-medium italic">
            "Seatwise: Precision in every seat."
          </p>
          <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">
            Status: {dbUser.status || "ACTIVE"}
          </p>
        </div>
      </div>
    </>
  );
}
