"use client";

import { useEffect } from "react";
import { measurementEnabled, reportResultView } from "@/lib/measurement";

/** Fires a trusted result-view once per mount when measurement API is bound. */
export function ResultViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (!measurementEnabled()) return;
    void reportResultView(slug);
  }, [slug]);
  return null;
}
