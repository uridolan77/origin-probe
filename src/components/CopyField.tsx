"use client";

import { useState } from "react";

type Props = {
  value: string;
  /** Visible truncated form; full value copied. */
  display?: string;
  label?: string;
};

export function CopyField({ value, display, label = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);
  const shown = display ?? value;

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="copy-field">
      <span className="copy-field__value" title={value}>
        {shown}
      </span>
      <button type="button" className="copy-field__btn" onClick={onCopy}>
        {copied ? "Copied" : label}
      </button>
    </span>
  );
}
