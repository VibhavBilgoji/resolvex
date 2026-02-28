import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/utils";
import { getDashboardPath } from "@/lib/auth/utils";
import LandingPage from "@/components/landing-page";

export default async function Home() {
  const user = await getUser();

  if (user) {
    redirect(getDashboardPath(user.role));
  }

  return <LandingPage />;
}