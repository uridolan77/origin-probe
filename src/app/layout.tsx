import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const siteUrl = process.env.SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
const buildCommit = process.env.ORIGIN_BUILD_COMMIT || "local-unbound";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Origin",
    template: "%s · Origin",
  },
  description:
    "Traced phrase genealogies: earliest verified occurrences, claimed coinage, popularization, and antecedents — with sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-origin-build-commit={buildCommit}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="site-shell">
          <SiteHeader />
          <main id="main" className="site-main">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
