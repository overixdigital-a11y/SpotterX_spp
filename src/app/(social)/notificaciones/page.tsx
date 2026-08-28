import { TopBar } from "@/components/core/TopBar";
import { BottomNav } from "@/components/core/BottomNav";
import { Zap, MessageCircle, UserPlus } from "lucide-react";

const notifs = [
  { icon: Zap, text: "Facu te dio un pulse a tu video", time: "hace 2 min", tone: "text-neon" },
  { icon: MessageCircle, text: "Mili comentó: 'Buenísimo, más asi'", time: "hace 20 min", tone: "text-neon" },
  { icon: UserPlus, text: "Charly empezó a seguirte", time: "hace 1 h", tone: "text-ember" },
];

export default function NotificacionesPage() {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 pt-2">
        {notifs.map((n, i) => {
          const Icon = n.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-edge py-3.5"
            >
              <Icon className={`h-5 w-5 shrink-0 ${n.tone}`} />
              <div className="leading-tight">
                <p className="text-sm text-ink">{n.text}</p>
                <p className="text-xs text-muted">{n.time}</p>
              </div>
            </div>
          );
        })}
      </main>
      <BottomNav />
    </>
  );
}
