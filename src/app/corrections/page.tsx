import type { Metadata } from "next";
import { Suspense } from "react";
import { CorrectionForm } from "@/components/CorrectionForm";

export const metadata: Metadata = {
  title: "Corrections",
  description:
    "Submit a structured correction, phrase request, or concept research suggestion for Origin.",
};

export default function CorrectionsPage() {
  return (
    <article className="stack">
      <header className="prose">
        <h1 className="display display-lg">Corrections</h1>
        <p className="lead">
          Suggest a better source, request a phrase that is not yet traced, or propose a
          concept / concept-source correction. Submissions are validated and stored locally
          in this probe build. There is no public comment stream, and user text is never
          rendered as HTML.
        </p>
      </header>
      <Suspense fallback={<p>Loading form…</p>}>
        <CorrectionForm />
      </Suspense>
    </article>
  );
}
