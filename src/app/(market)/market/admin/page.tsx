import { redirect } from "next/navigation";

export const metadata = { title: "Admin SpotterShop" };

export default function MarketAdminRedirectPage() {
  redirect("/admin/market");
}