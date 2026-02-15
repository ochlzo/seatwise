"use client"

import * as React from "react"
import { AdminSidebar } from "@/components/admin-sidebar"

export function AdminSidebarClient() {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return <AdminSidebar />
}
