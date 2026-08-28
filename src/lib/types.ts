export type AppRole = "gym" | "profesor" | "alumno";

export interface Profile {
  id: string;
  email: string | null;
  username: string;
  full_name: string | null;
  role: AppRole;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  created_at: string;
}

export type Session = {
  user: {
    id: string;
    email?: string | null;
  } | null;
  profile: Profile | null;
};
