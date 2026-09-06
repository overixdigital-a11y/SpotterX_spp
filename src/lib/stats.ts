import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProfileStats {
  posts: number;
  followers: number;
  following: number;
  pulses: number;
}

export async function getProfileStats(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileStats> {
  const { count: posts } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const { count: followers } = await supabase
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("following_id", userId);
  const { count: following } = await supabase
    .from("follows")
    .select("following_id", { count: "exact", head: true })
    .eq("follower_id", userId);

  let pulses = 0;
  const { data: postIds } = await supabase
    .from("posts")
    .select("id")
    .eq("user_id", userId)
    .limit(300);
  if (postIds && postIds.length > 0) {
    const { count: c } = await supabase
      .from("post_pulses")
      .select("id", { count: "exact", head: true })
      .in("post_id", postIds.map((p) => p.id));
    pulses = c ?? 0;
  }

  return { posts: posts ?? 0, followers: followers ?? 0, following: following ?? 0, pulses };
}