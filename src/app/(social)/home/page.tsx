import { TopBar } from "@/components/core/TopBar";
import { BottomNav } from "@/components/core/BottomNav";
import { Feed } from "@/components/social/Feed";

const sample = [0, 1, 2].map((i) => ({
  id: String(i),
  author: ["Facu", "Mili", "Charly"][i],
  handle: ["@facutrainer", "@mili.run", "@charlyfit"][i],
  avatar: ["FA", "MI", "CH"][i],
  caption:
    ["Sentadilla técnica ✅ #Powerlifting", "5k esta mañana 🏃 #Running", "Bulk limpio en curso 💪 #Calistenia"][
      i
    ],
  pulses: 320 - i * 40,
  comments: 12 - i * 3,
  remixes: 4 - i,
}));

export default function HomePage() {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md">
        <Feed posts={sample} />
      </main>
      <BottomNav />
    </>
  );
}
