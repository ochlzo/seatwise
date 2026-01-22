"use client";

import * as React from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setDrawShape, setMode } from "@/lib/features/seatmap/seatmapSlice";

export function SeatMapSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const dispatch = useAppDispatch();
  const drawShape = useAppSelector((state) => state.seatmap.drawShape);
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <div className="px-2 py-1">
          <h2 className="text-sm font-semibold">Seat Palette</h2>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 pb-2">
        <div className="text-xs text-zinc-500 mb-2">Seats</div>
        <div
          className="p-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("type", "seat");
            e.dataTransfer.setData("seatType", "standard");
            e.dataTransfer.effectAllowed = "copy";
          }}
        >
          <div className="w-10 h-10 relative flex items-center justify-center">
            <img
              src="/seat-default.svg"
              alt="Seat"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-xs font-medium">Standard Seat</span>
        </div>
        <div
          className="p-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("type", "seat");
            e.dataTransfer.setData("seatType", "vip");
            e.dataTransfer.effectAllowed = "copy";
          }}
        >
          <div className="w-10 h-10 relative flex items-center justify-center">
            <img
              src="/default-vip-seat.svg"
              alt="VIP Seat"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-xs font-medium">VIP Seat</span>
        </div>

        <div className="text-xs text-zinc-500 mb-2 mt-4">Shapes</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              label: "Square",
              shape: "rect",
              icon: <div className="w-8 h-8 border-2 border-zinc-500" />,
            },
            {
              label: "Circle",
              shape: "circle",
              icon: (
                <div className="w-8 h-8 rounded-full border-2 border-zinc-500" />
              ),
            },
            {
              label: "Hexagon",
              shape: "polygon",
              sides: 6,
              icon: (
                <div
                  className="w-8 h-8 border-2 border-zinc-500 transform rotate-45"
                  style={{
                    clipPath:
                      "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                    background: "none",
                  }}
                />
              ),
            },
            {
              label: "Line",
              shape: "line",
              icon: (
                <div className="w-8 h-0 border-t-2 border-zinc-500 mt-4" />
              ),
            },
          ].map((item, i) => (
            <div
              key={i}
              className={`p-2 border rounded flex flex-col items-center gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                drawShape.shape === item.shape &&
                (drawShape.sides ?? 0) === (item.sides ?? 0)
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
              onClick={() => {
                dispatch(setMode("draw"));
                dispatch(
                  setDrawShape({
                    shape: item.shape as any,
                    sides: item.sides,
                  }),
                );
              }}
            >
              {item.icon}
              <span className="text-[10px]">{item.label}</span>
            </div>
          ))}
        </div>
      </SidebarContent>
      <SidebarFooter className="px-3 py-3">
        <div className="text-xs text-zinc-500 space-y-1">
          <p>Controls:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Drag & drop to add items</li>
            <li>Click to select</li>
            <li>Drag selected to move</li>
            <li>Scroll to zoom</li>
          </ul>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
