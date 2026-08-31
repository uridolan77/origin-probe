import { INDEX_EARLIEST_ROLES, PUBLISHED_STATUSES, UNPUBLISHED_STATUSES } from "./genealogy-schema.mjs";

function hasPrimary(assertion, sourceById) {
  return assertion.evidenceIds.some((id) => sourceById.get(id)?.sourceType === "primary");
}

function historicalDatesEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.display === b.display &&
    a.startYear === b.startYear &&
    a.endYear === b.endYear &&
    a.precision === b.precision &&
    a.calendar === b.calendar
  );
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

  if (!earliestAssertion.occurrenceDate) {
    errors.push(
      `index.earliest.assertionId "${index.earliest.assertionId}" is missing occurrenceDate`,
    );
  } else if (!historicalDatesEqual(index.earliest.date, earliestAssertion.occurrenceDate)) {
    errors.push(
      `index.earliest.date must equal occurrenceDate on assertion "${index.earliest.assertionId}"`,
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

    if (earliestAssertion.evidenceRole !== "EARLIEST_VERIFIED_OCCURRENCE") {
      errors.push(
        `verdict direct_coinage requires index.earliest to bind EARLIEST_VERIFIED_OCCURRENCE (got ${earliestAssertion.evidenceRole})`,
      );
      return errors;
    }
    if (earliestAssertion.supportKind !== "direct") {
      errors.push(
        `verdict direct_coinage requires index-bound EVO supportKind direct (got ${earliestAssertion.supportKind})`,
      );
      return errors;
    }
    if (!hasPrimary(earliestAssertion, sourceById)) {
      errors.push(
        `verdict direct_coinage requires index-bound EVO to cite at least one primary source`,
      );
      return errors;
    }
    if (earliestAssertion.earlierUseStatus !== "none_located_within_scope") {
      errors.push(
        `verdict direct_coinage requires index-bound EVO earlierUseStatus none_located_within_scope (got ${earliestAssertion.earlierUseStatus ?? "missing"})`,
      );
      return errors;
    }

    const claimKey = verdictAssertion.originatorKey;
    const evoKey = earliestAssertion.originatorKey;
    if (!claimKey || !evoKey || claimKey !== evoKey) {
      errors.push(
        `verdict direct_coinage requires matching originatorKey on CLAIMED_COINAGE and index-bound EVO`,
      );
    }
  }

  return errors;
}
