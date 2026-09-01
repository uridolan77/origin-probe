import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ConceptPublicRoleSchema } from "./schema";

function sha256Hex(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export const RoleRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    registryKind: z.literal("origin_concept_public_role_registry_v1"),
    roles: z.array(ConceptPublicRoleSchema).min(1),
    priorityProjectionSlots: z.array(ConceptPublicRoleSchema).min(1),
    slotRequirements: z.record(
      z.string(),
      z
        .object({
          requiresTemporalStartYear: z.boolean(),
          eligibilityRole: ConceptPublicRoleSchema,
        })
        .strict(),
    ),
  })
  .strict();

export type RoleRegistry = z.infer<typeof RoleRegistrySchema>;

export const PolicyRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    registryKind: z.literal("origin_site_publication_policy_registry_v1"),
    allowedPackageKinds: z.array(z.string().min(1)).min(1),
    allowedPackageVersions: z.array(z.number().int().positive()).min(1),
    requiredUpstreamArtifacts: z.array(z.string().min(1)).min(1),
    findingTemplateVersions: z.array(z.number().int().positive()).min(1),
    catalogIdentityFields: z.array(z.string().min(1)).min(1),
    revisionPolicy: z
      .object({
        allowSupersededInBundle: z.boolean(),
        requireSupersedesDigestWhenRevisionGt1: z.boolean(),
        rejectWithdrawnAsActive: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type PolicyRegistry = z.infer<typeof PolicyRegistrySchema>;

export type LoadedRegistries = {
  roleRegistry: RoleRegistry;
  policyRegistry: PolicyRegistry;
  roleRegistryDigest: string;
  policyRegistryDigest: string;
};

function registryPath(repoRoot: string, name: string): string {
  return path.join(repoRoot, "data", "concepts", "registries", name);
}

export function loadRegistries(repoRoot: string = process.cwd()): LoadedRegistries {
  const roleRaw = fs.readFileSync(registryPath(repoRoot, "role-registry.json"), "utf8");
  const policyRaw = fs.readFileSync(
    registryPath(repoRoot, "policy-registry.json"),
    "utf8",
  );
  const roleRegistry = RoleRegistrySchema.parse(JSON.parse(roleRaw));
  const policyRegistry = PolicyRegistrySchema.parse(JSON.parse(policyRaw));
  return {
    roleRegistry,
    policyRegistry,
    roleRegistryDigest: sha256Hex(roleRaw.replace(/\r\n/g, "\n")),
    policyRegistryDigest: sha256Hex(policyRaw.replace(/\r\n/g, "\n")),
  };
}

export function validateRegistrySemantics(
  roleRegistry: RoleRegistry,
  policyRegistry: PolicyRegistry,
  packageKind: string,
  packageVersion: number,
  templateVersion: number,
): void {
  if (!policyRegistry.allowedPackageKinds.includes(packageKind)) {
    throw new Error(`Package kind ${packageKind} not allowed by policy registry`);
  }
  if (!policyRegistry.allowedPackageVersions.includes(packageVersion)) {
    throw new Error(`Package version ${packageVersion} not allowed by policy registry`);
  }
  if (!policyRegistry.findingTemplateVersions.includes(templateVersion)) {
    throw new Error(`Finding template version ${templateVersion} not allowed`);
  }
  for (const slot of roleRegistry.priorityProjectionSlots) {
    if (!roleRegistry.roles.includes(slot)) {
      throw new Error(`Priority slot ${slot} missing from role registry`);
    }
  }
}
