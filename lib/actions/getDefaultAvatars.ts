"use server";

import { getDefaultAvatarsFromCloudinary } from "@/lib/avatars/defaultAvatars";

export async function getDefaultAvatarsAction() {
    return await getDefaultAvatarsFromCloudinary();
}
