import type { PolicyRule } from "../engine.ts";

// Ported verbatim from hooks/dangerous-command-guard.sh — fixed-substring
// blocklist (grep -qF semantics).

const BLOCKLIST = [
  "rm -rf /",
  "rm -rf ~",
  "sudo rm",
  "mkfs",
  "dd if=",
  "shutdown",
  "reboot",
  "diskutil eraseDisk",
  "chmod -R 777 /",
  "chmod -R 777 ~",
  "> /dev/sda",
  "format c:",
];

export const dangerousCommandRule: PolicyRule = {
  name: "dangerous-command",
  check(call) {
    if (call.name !== "bash") return { kind: "allow" };
    const command = typeof call.input.command === "string" ? call.input.command : "";
    for (const pattern of BLOCKLIST) {
      if (command.includes(pattern)) {
        return { kind: "deny", rule: this.name, message: `Dangerous command detected: ${pattern}` };
      }
    }
    return { kind: "allow" };
  },
};
