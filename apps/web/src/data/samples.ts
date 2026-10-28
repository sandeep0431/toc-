import rulesJson from "./rules.json";
import authSampleLog from "./auth.sample.log?raw";
import accessSampleLog from "./access.sample.log?raw";
import { Rule } from "@tripwire/engine";

export const DEFAULT_RULES: Rule[] = rulesJson as Rule[];

export const SAMPLE_LOGS: Record<string, { name: string; content: string; type: "auth" | "web" }> = {
  auth: {
    name: "SSH auth.log (Brute Force & Probes)",
    content: authSampleLog,
    type: "auth",
  },
  access: {
    name: "Nginx access.log (SQLi, Traversal, XSS, Scanners)",
    content: accessSampleLog,
    type: "web",
  },
  benign: {
    name: "Benign Corporate Traffic (Clear)",
    content: `Oct 20 10:00:15 server sshd[2001]: Accepted password for alice from 192.168.1.10 port 52314 ssh2
Oct 20 10:02:10 server sshd[2021]: Accepted password for bob from 192.168.1.20 port 53101 ssh2
Oct 20 10:04:00 server sshd[2040]: Accepted password for charlie from 192.168.1.30 port 54000 ssh2`,
    type: "auth",
  },
};
