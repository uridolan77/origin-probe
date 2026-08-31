import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Built by Uri Dolan</p>
      <p className="site-footer-links">
        <Link href="/privacy/">Privacy</Link>
      </p>
    </footer>
  );
}
