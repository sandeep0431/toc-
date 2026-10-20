/**
 * gen-logs.ts: Deterministic seeded log generator for demo and stress testing.
 * Uses a linear congruential generator (LCG) with a fixed seed.
 */

class SeededRNG {
  private state: number;
  constructor(seed = 42) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }
}

export function generateSyntheticLogs(linesCount = 500, seed = 12345): {
  authLog: string;
  accessLog: string;
} {
  const rng = new SeededRNG(seed);
  const authLines: string[] = [];
  const accessLines: string[] = [];

  const users = ["alice", "bob", "carol", "david", "root", "admin", "dev"];
  const ips = ["192.168.1.10", "192.168.1.25", "10.0.0.5", "10.0.0.99", "172.16.0.4"];
  const paths = ["/", "/index.html", "/login", "/products", "/about", "/api/v1/items"];

  let baseTime = new Date(Date.UTC(2026, 9, 20, 10, 0, 0)).getTime();

  for (let i = 0; i < linesCount; i++) {
    baseTime += rng.nextInt(1, 10) * 1000;
    const d = new Date(baseTime);
    const timeStr = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
    const ip = rng.pick(ips);
    const user = rng.pick(users);

    // 90% benign, 10% attacks
    const roll = rng.next();
    if (roll < 0.7) {
      authLines.push(`Oct 20 ${timeStr} server sshd[${2000 + (i % 100)}]: Accepted password for ${user} from ${ip} port ${40000 + (i % 5000)} ssh2`);
      accessLines.push(`${ip} - - [20/Oct/2026:${timeStr} +0000] "GET ${rng.pick(paths)} HTTP/1.1" 200 ${rng.nextInt(500, 5000)} "-" "Mozilla/5.0"`);
    } else if (roll < 0.9) {
      authLines.push(`Oct 20 ${timeStr} server sshd[${2000 + (i % 100)}]: Failed password for ${user} from ${ip} port ${40000 + (i % 5000)} ssh2`);
      accessLines.push(`${ip} - - [20/Oct/2026:${timeStr} +0000] "GET /nonexistent-${i} HTTP/1.1" 404 220 "-" "Mozilla/5.0"`);
    } else {
      // Attacks
      const attackType = rng.nextInt(0, 3);
      if (attackType === 0) {
        accessLines.push(`${ip} - - [20/Oct/2026:${timeStr} +0000] "GET /search?q=' OR '1'='1 HTTP/1.1" 200 4000 "-" "Mozilla/5.0"`);
      } else if (attackType === 1) {
        accessLines.push(`${ip} - - [20/Oct/2026:${timeStr} +0000] "GET /docs/../../etc/shadow HTTP/1.1" 403 210 "-" "curl/7.81.0"`);
      } else if (attackType === 2) {
        accessLines.push(`${ip} - - [20/Oct/2026:${timeStr} +0000] "GET /items?q=<script>alert(1)</script> HTTP/1.1" 200 1200 "-" "Mozilla/5.0"`);
      } else {
        accessLines.push(`${ip} - - [20/Oct/2026:${timeStr} +0000] "GET /admin HTTP/1.1" 401 512 "-" "sqlmap/1.6"`);
      }
    }
  }

  return {
    authLog: authLines.join("\n"),
    accessLog: accessLines.join("\n"),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { authLog, accessLog } = generateSyntheticLogs(500, 9999);
  console.log(`Generated 500 auth lines (${authLog.length} bytes) and 500 access lines (${accessLog.length} bytes).`);
}
