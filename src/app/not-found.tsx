import Link from "next/link";

export default function NotFound() {
  return (
    <div className="prose stack">
      <h1 className="display display-lg">
        Not found
      </h1>
      <p>That page is not part of the traced collection.</p>
      <p>
        <Link href="/">Return home</Link>
      </p>
    </div>
  );
}
