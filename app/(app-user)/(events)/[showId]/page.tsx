import type { Metadata } from "next";
import { getShowById } from "@/lib/db/Shows";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { ShowDetailPublic } from "@/components/show/ShowDetailPublic";
import StopLoadingOnMount from "@/components/stop-loading-on-mount";
import { ReserveNowButton } from "@/components/queue/ReserveNowButton";
import {
  hasSelectableSchedules,
  serializeSchedulesForPicker,
} from "@/lib/shows/schedulePicker";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

const SITE_URL = "https://seatwise-tanghal-tickethouse.vercel.app";
const FALLBACK_OG_IMAGE = new URL("/logo.png", SITE_URL).toString();

const resolvePreviewImage = (showImageKey?: string | null) => {
  if (!showImageKey) return FALLBACK_OG_IMAGE;

  try {
    return new URL(showImageKey).toString();
  } catch {
    return new URL(showImageKey.startsWith("/") ? showImageKey : `/${showImageKey}`, SITE_URL).toString();
  }
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ showId: string }>;
}): Promise<Metadata> {
  const { showId } = await params;
  const show = await getShowById(showId);

  if (!show) {
    return {
      title: "Seatwise",
      description: "Seatwise Application",
    };
  }

  const canonicalUrl = `${SITE_URL}/${show.show_id}`;
  const previewImage = resolvePreviewImage(show.show_image_key);
  const description =
    show.show_description?.trim() ||
    `View ${show.show_name} on Seatwise.`;

  return {
    title: show.show_name,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: show.show_name,
      description,
      url: canonicalUrl,
      siteName: "Seatwise",
      images: [
        {
          url: previewImage,
          width: 1200,
          height: 630,
          alt: show.show_name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: show.show_name,
      description,
      images: [previewImage],
    },
  };
}

export default async function ShowIdPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const show = await getShowById(showId);

  if (!show) {
    notFound();
  }

  const serializedShow = {
    ...show,
    scheds: show.scheds?.map((sched) => ({
      ...sched,
      seatAssignments: sched.seatAssignments?.map((assignment) => ({
        ...assignment,
        set: {
          ...assignment.set,
          seatCategory: {
            ...assignment.set.seatCategory,
            price: assignment.set.seatCategory.price.toString(),
          },
        },
      })),
    })),
    categorySets: show.categorySets?.map((categorySet) => ({
      ...categorySet,
      items: categorySet.items.map((item) => ({
        ...item,
        seatCategory: {
          ...item.seatCategory,
          price: item.seatCategory.price.toString(),
        },
      })),
    })),
  };

  const serializedSchedules = serializeSchedulesForPicker(show.scheds);
  const hasReservableSchedules = hasSelectableSchedules(serializedSchedules);
  const canJoinFromNormalPage = show.show_status === "OPEN";

  return (
    <>
      <StopLoadingOnMount />
      <PageHeader
        title={show.show_name}
        className="z-20"
        rightSlot={<ThemeSwithcer />}
      />
      <div className="relative flex flex-1 flex-col bg-background">
        <div className="relative z-10 flex flex-1 flex-col p-4 md:p-8 pt-0 max-w-7xl mx-auto w-full">
          <ShowDetailPublic
            show={serializedShow}
            reserveButton={
              canJoinFromNormalPage &&
              hasReservableSchedules &&
              serializedSchedules.length > 0 ? (
                <ReserveNowButton
                  showId={show.show_id}
                  showName={show.show_name}
                  schedules={serializedSchedules}
                />
              ) : undefined
            }
          />
        </div>
      </div>
    </>
  );
}
