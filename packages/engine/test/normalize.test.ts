import { describe, it, expect } from "vitest";
import { parseAuthLog, parseAccessLog } from "../src/normalize";

describe("Log Normalizer", () => {
  describe("OpenSSH auth.log", () => {
    it("parses failed password into 'F' symbol and extracts source and user", () => {
      const line = "Oct 20 10:14:22 server sshd[1234]: Failed password for root from 192.168.1.100 port 54321 ssh2";
      const { events, skippedCount } = parseAuthLog(line);

      expect(skippedCount).toBe(0);
      expect(events).toHaveLength(1);
      expect(events[0].symbol).toBe("F");
      expect(events[0].source).toBe("192.168.1.100");
      expect(events[0].fields.user).toBe("root");
    });

    it("parses accepted password into 'S' symbol", () => {
      const line = "Oct 20 10:15:00 server sshd[1235]: Accepted password for admin from 192.168.1.50 port 54322 ssh2";
      const { events } = parseAuthLog(line);

      expect(events).toHaveLength(1);
      expect(events[0].symbol).toBe("S");
      expect(events[0].source).toBe("192.168.1.50");
      expect(events[0].fields.user).toBe("admin");
    });

    it("parses connection refused into 'P' symbol", () => {
      const line = "Oct 20 10:16:00 server sshd[1236]: Connection refused from 10.0.0.99 port 22";
      const { events } = parseAuthLog(line);

      expect(events).toHaveLength(1);
      expect(events[0].symbol).toBe("P");
      expect(events[0].source).toBe("10.0.0.99");
    });

    it("skips non-ssh or malformed lines without throwing", () => {
      const log = "Oct 20 10:00:01 server CRON[999]: (root) CMD (/usr/bin/backup)\n\ncorrupted line";
      const { events, skippedCount } = parseAuthLog(log);

      expect(events).toHaveLength(0);
      expect(skippedCount).toBe(2);
    });
  });

  describe("Nginx/Apache access.log", () => {
    it("parses successful 2xx/3xx requests as 'R' symbol", () => {
      const line = '192.168.1.10 - - [20/Oct/2026:10:00:00 +0000] "GET /index.html?ref=home HTTP/1.1" 200 4520 "-" "Mozilla/5.0"';
      const { events } = parseAccessLog(line);

      expect(events).toHaveLength(1);
      expect(events[0].symbol).toBe("R");
      expect(events[0].source).toBe("192.168.1.10");
      expect(events[0].fields.path).toBe("/index.html");
      expect(events[0].fields.query).toBe("ref=home");
      expect(events[0].fields.status).toBe("200");
    });

    it("parses error 4xx/5xx requests as 'E' symbol", () => {
      const line = '10.0.0.99 - - [20/Oct/2026:10:01:00 +0000] "GET /secret HTTP/1.1" 403 280 "-" "curl/7.68.0"';
      const { events } = parseAccessLog(line);

      expect(events).toHaveLength(1);
      expect(events[0].symbol).toBe("E");
      expect(events[0].fields.status).toBe("403");
    });

    it("gracefully counts unparseable access lines", () => {
      const { events, skippedCount } = parseAccessLog("gibberish\n# comment");
      expect(events).toHaveLength(0);
      expect(skippedCount).toBe(2);
    });
  });
});
