import type { GapKind, BlockedClaim } from "../../api/types";

export const GAP_KIND_LABEL: Record<GapKind, string> = {
  missing: "Not on the profile",
  claimed_only: "Claimed, no evidence yet",
  weak: "Assessed below the pass mark",
  observed_only: "Seen in GitHub code, never assessed",
};

export const BLOCKED_KIND_LABEL: Record<BlockedClaim["kind"], string> = {
  skill: "Skill",
  project: "Project",
  project_technology: "Project technology",
  feature: "Project feature",
  responsibility: "Responsibility",
  metric: "Metric",
};
