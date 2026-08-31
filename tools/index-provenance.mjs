import { INDEX_EARLIEST_ROLES, PUBLISHED_STATUSES, UNPUBLISHED_STATUSES } from "./genealogy-schema.mjs";

/**
 * Returns provenance error messages for a genealogy's index projection.
 * Empty array means the index (or lack of one) is valid for its status.
 */
export function collectIndexProvenanceErrors(g, assertionById, sourceById) {
  const errors = [];
  const { index, status } = g;

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
    } else if (!["supporting", "contested", "incomplete"].includes(support)) {
      errors.push(
        `verdict claimed_coinage requires supportKind supporting|contested|incomplete (got ${support})`,
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
    } else if (support !== "direct") {
      errors.push(
        `verdict direct_coinage requires supportKind direct (got ${support})`,
      );
    } else {
      const hasPrimary = verdictAssertion.evidenceIds.some((id) => {
        const s = sourceById.get(id);
        return s && s.sourceType === "primary";
      });
      if (!hasPrimary) {
        errors.push(
          `verdict direct_coinage requires at least one primary source on the bound assertion`,
        );
      }
    }
  }

  return errors;
}
