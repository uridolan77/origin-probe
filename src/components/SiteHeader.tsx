import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="site-brand" href="/">
        Origin
      </Link>
      <nav className="site-nav" aria-label="Primary">
        <Link href="/">Home</Link>
        <Link href="/method/">Method</Link>
        <Link href="/corrections/">Corrections</Link>
        <Link href="/privacy/">Privacy</Link>
      </nav>
    </header>
  );
}
