"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navCurrent(path: string, pathname: string): "page" | undefined {
  if (path === "/") {
    return pathname === "/" || pathname === "" ? "page" : undefined;
  }
  return pathname.startsWith(path) ? "page" : undefined;
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="site-header">
      <Link className="site-brand" href="/">
        Origin
      </Link>
      <nav className="site-nav" aria-label="Primary">
        <Link href="/" aria-current={navCurrent("/", pathname)}>
          Collection
        </Link>
        <Link href="/method/" aria-current={navCurrent("/method", pathname)}>
          Method
        </Link>
        <Link href="/corrections/" aria-current={navCurrent("/corrections", pathname)}>
          Corrections
        </Link>
      </nav>
    </header>
  );
}
