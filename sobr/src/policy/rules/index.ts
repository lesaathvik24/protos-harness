import type { PolicyRule } from "../engine.ts";
import { secretScanRule } from "./secret-scan.ts";
import { dangerousCommandRule } from "./dangerous-command.ts";
import { conventionalCommitRule } from "./conventional-commit.ts";
import { dependencyAuditRule } from "./dependency-audit.ts";

export { secretScanRule, dangerousCommandRule, conventionalCommitRule, dependencyAuditRule };
export { gitStatusAdvisory } from "./git-status.ts";

export function defaultRules(): PolicyRule[] {
  return [secretScanRule, dangerousCommandRule, conventionalCommitRule, dependencyAuditRule];
}
