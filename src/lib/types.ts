export type AppRole = "gym" | "profesor" | "alumno";

export interface ProfileSettings {
  notif_comment?: boolean;
  notif_pulse?: boolean;
  notif_follow?: boolean;
  notif_message?: boolean;
  notif_gym_checkin?: boolean;
}

export interface Profile {
  id: string;
  email: string | null;
  username: string;
  full_name: string | null;
  role: AppRole;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  birth_date: string | null;
  phone: string | null;
  website: string | null;
  social_links: Record<string, string> | null;
  is_verified: boolean;
  is_admin: boolean;
  privacy: "publico" | "solo_seguidores";
  settings: ProfileSettings | null;
  disciplines: string[] | null;
  created_at: string;
  updated_at?: string | null;
}

export type Session = {
  user: {
    id: string;
    email?: string | null;
  } | null;
  profile: Profile | null;
};