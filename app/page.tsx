import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import { LandingBenefits } from "@/components/landing/benefits";
import { LandingFeatures } from "@/components/landing/features";
import { LandingPricing } from "@/components/landing/pricing-section";
import { LandingFaq } from "@/components/landing/faq";
import { LandingFooter } from "@/components/landing/footer";

export const metadata: Metadata = {
  other: { "page-type": "software", "site-kind": "software" },
};

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = !!data?.claims.sub;

  return (
    <div className="landing-site min-h-screen">
      <a className="landing-skip" href="#main-content">跳到主要内容</a>
      <LandingNavbar isAuthenticated={isAuthenticated} />
      <main id="main-content" tabIndex={-1}>
        <LandingHero isAuthenticated={isAuthenticated} />
        <LandingBenefits />
        <LandingFeatures />
        <LandingPricing isAuthenticated={isAuthenticated} />
        <LandingFaq />
      </main>
      <LandingFooter isAuthenticated={isAuthenticated} />
    </div>
  );
}
