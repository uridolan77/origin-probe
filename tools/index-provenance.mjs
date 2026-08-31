import { INDEX_EARLIEST_ROLES, PUBLISHED_STATUSES, UNPUBLISHED_STATUSES } from "./genealogy-schema.mjs";

function subjectTokens(subject) {
  return new Set(
    String(subject)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

function subjectsAlign(occurrence, claimSubject) {
  const haystack = `${occurrence.subject} ${occurrence.publicStatement}`.toLowerCase();
  for (const token of subjectTokens(claimSubject)) {
    if (haystack.includes(token)) return true;
  }
  return false;
}

function hasPrimary(assertion, sourceById) {
  return assertion.evidenceIds.some((id) => sourceById.get(id)?.sourceType === "primary");
}

/**
 * Returns provenance error messages for a genealogy's index projection.
 * Empty array means the index (or lack of one) is valid for its status.
 */
export function collectIndexProvenanceErrors(g, assertionById, sourceById) {
  const errors = [];
  const { index, status, assertions } = g;

  if (PUBLISHED_STATUSES.has(status) && !index) {
    errors.push(`published status "${status}" requires index projection`);
    return errors;
  }

  if (UNPUBLISHED_STATUSES.has(status) && index) {
    errors.push(`index projection is not allowed for status "${status}"`);
    return errors;
  }

  if (!index) return errors;

  const earliestAssertion = assertionById.get(index.earliest.assertionId);
  if (!earliestAssertion) {
    errors.push(
      `index.earliest.assertionId "${index.earliest.assertionId}" not found`,
    );
    return errors;
  }

  if (!INDEX_EARLIEST_ROLES.has(earliestAssertion.evidenceRole)) {
    errors.push(
      `index.earliest.assertionId "${index.earliest.assertionId}" has disallowed role ${earliestAssertion.evidenceRole}`,
    );
  }

  const verdictAssertion = assertionById.get(index.verdictAssertionId);
  if (!verdictAssertion) {
    errors.push(
      `index.verdictAssertionId "${index.verdictAssertionId}" not found`,
    );
    return errors;
  }

  const { verdict } = index;
  const role = verdictAssertion.evidenceRole;
  const support = verdictAssertion.supportKind;

  if (verdict === "misattributed") {
    if (role !== "MISATTRIBUTED_TO") {
      errors.push(
        `verdict misattributed requires verdictAssertionId with role MISATTRIBUTED_TO (got ${role})`,
      );
    }
    return errors;
  }

  if (verdict === "claimed_coinage") {
    if (role !== "CLAIMED_COINAGE") {
      errors.push(
        `verdict claimed_coinage requires verdictAssertionId with role CLAIMED_COINAGE (got ${role})`,
      );
    }
    return errors;
  }

  if (verdict === "popularized") {
    if (role !== "POPULARIZED_BY") {
      errors.push(
        `verdict popularized requires verdictAssertionId with role POPULARIZED_BY (got ${role})`,
      );
    } else if (support === "incomplete") {
      errors.push(
        `verdict popularized forbids incomplete supportKind on the bound assertion`,
      );
    }
    return errors;
  }

  if (verdict === "direct_coinage") {
    if (role !== "CLAIMED_COINAGE") {
      errors.push(
        `verdict direct_coinage requires verdictAssertionId with role CLAIMED_COINAGE (got ${role})`,
      );
      return errors;
    }
    if (support !== "direct") {
      errors.push(
        `verdict direct_coinage requires supportKind direct (got ${support})`,
      );
      return errors;
    }
    if (!hasPrimary(verdictAssertion, sourceById)) {
      errors.push(
        `verdict direct_coinage requires at least one primary source on the bound assertion`,
      );
      return errors;
    }

    const matchingEvo = (assertions || []).find(
      (a) =>
        a.evidenceRole === "EARLIEST_VERIFIED_OCCURRENCE" &&
        a.supportKind === "direct" &&
        hasPrimary(a, sourceById) &&
        !a.caveat &&
        subjectsAlign(a, verdictAssertion.subject),
    );
    if (!matchingEvo) {
      errors.push(
        `verdict direct_coinage requires a same-subject EARLIEST_VERIFIED_OCCURRENCE with supportKind direct, a primary source, and no unresolved earlier-use caveat`,
      );
    }
  }

  return errors;
}
