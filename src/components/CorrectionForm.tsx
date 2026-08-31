"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { submitCorrection } from "@/lib/corrections";
import { createDefaultEventSink, getOrCreateClientId } from "@/lib/events";

export function CorrectionForm() {
  const searchParams = useSearchParams();
  const kind = searchParams.get("kind");
  const subject = searchParams.get("subject") ?? "";

  const defaults = useMemo(() => {
    if (kind === "concept" && subject) {
      return {
        phrase: subject,
        notes: `Concept suggestion/correction for subject "${subject}".`,
      };
    }
    return { phrase: "", notes: "" };
  }, [kind, subject]);

  const [errors, setErrors] = useState<string[]>([]);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors([]);
    setSuccessId(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      phrase: String(form.get("phrase") ?? ""),
      candidateSourceUrl: String(form.get("candidateSourceUrl") ?? ""),
      candidateSourceTitle: String(form.get("candidateSourceTitle") ?? ""),
      candidatePublicationDate: String(form.get("candidatePublicationDate") ?? ""),
      notes: String(form.get("notes") ?? ""),
      submitter: String(form.get("submitter") ?? "") || undefined,
    };

    const result = submitCorrection(payload);
    if (!result.ok) {
      setErrors(result.errors);
      setPending(false);
      return;
    }

    createDefaultEventSink().emit({
      type: "correction_submission",
      phrase: payload.phrase,
      clientId: getOrCreateClientId(),
      at: new Date().toISOString(),
    });

    setSuccessId(result.id);
    e.currentTarget.reset();
    setPending(false);
  }

  const subjectLabel =
    kind === "concept" ? "Concept label or slug" : "Phrase";

  return (
    <form className="form-grid" onSubmit={onSubmit} noValidate>
      {kind === "concept" ? (
        <p className="form-hint" role="note">
          Concept path: suggest a concept, propose a source, or correct a published
          dossier. The field below still uses the shared correction store.
        </p>
      ) : null}
      <label>
        {subjectLabel}
        <input
          name="phrase"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={defaults.phrase}
        />
      </label>
      <label>
        Candidate source URL
        <input name="candidateSourceUrl" type="url" required maxLength={2000} />
      </label>
      <label>
        Candidate source title
        <input name="candidateSourceTitle" required maxLength={300} />
      </label>
      <label>
        Candidate publication date
        <input
          name="candidatePublicationDate"
          required
          maxLength={40}
          placeholder="YYYY or YYYY-MM-DD"
        />
      </label>
      <label>
        Notes
        <textarea
          name="notes"
          required
          maxLength={2000}
          defaultValue={defaults.notes}
        />
      </label>
      <label>
        Submitter (optional)
        <input name="submitter" maxLength={200} autoComplete="name" />
      </label>

      {errors.length > 0 ? (
        <div className="form-error" role="alert">
          <ul>
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {successId ? (
        <p className="form-success" role="status">
          Stored locally as {successId}.
        </p>
      ) : null}

      <button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
