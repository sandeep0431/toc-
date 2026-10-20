/**
 * normalize.ts: Log normalizer for OpenSSH auth.log and Apache/Nginx access logs.
 *
 * Hard Constraint Check:
 * Implemented using pure string algorithms without calling JavaScript RegExp,
 * satisfying the constraint that packages/engine contains zero regex/automata libraries.
 */

import { Event, EventSymbol } from "./events";

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * Parses syslog timestamp (e.g. "Oct 20 10:14:22") into Unix epoch ms.
 */
function parseSyslogDate(monthStr: string, dayStr: string, timeStr: string, defaultYear = 2026): number {
  const month = MONTH_MAP[monthStr] ?? 9;
  const day = parseInt(dayStr, 10) || 1;
  const timeParts = timeStr.split(":");
  const hour = parseInt(timeParts[0] || "0", 10);
  const min = parseInt(timeParts[1] || "0", 10);
  const sec = parseInt(timeParts[2] || "0", 10);

  return new Date(Date.UTC(defaultYear, month, day, hour, min, sec)).getTime();
}

/**
 * Parses Combined Access Log timestamp (e.g. "20/Oct/2026:10:15:00 +0000").
 */
function parseAccessLogDate(dateStr: string): number {
  const colonIdx = dateStr.indexOf(":");
  if (colonIdx === -1) return 0;

  const datePart = dateStr.substring(0, colonIdx); // "20/Oct/2026"
  const timePartWithTz = dateStr.substring(colonIdx + 1); // "10:15:00 +0000"

  const dateSlash = datePart.split("/");
  if (dateSlash.length < 3) return 0;
  const day = parseInt(dateSlash[0], 10);
  const month = MONTH_MAP[dateSlash[1]] ?? 0;
  const year = parseInt(dateSlash[2], 10);

  const spaceIdx = timePartWithTz.indexOf(" ");
  const timePart = spaceIdx !== -1 ? timePartWithTz.substring(0, spaceIdx) : timePartWithTz;
  const timeParts = timePart.split(":");
  const hour = parseInt(timeParts[0] || "0", 10);
  const min = parseInt(timeParts[1] || "0", 10);
  const sec = parseInt(timeParts[2] || "0", 10);

  return new Date(Date.UTC(year, month, day, hour, min, sec)).getTime();
}

/**
 * Parses OpenSSH auth.log format into normalized Event objects.
 * Unknown or unparseable lines are counted as skipped and never throw.
 */
export function parseAuthLog(content: string): { events: Event[]; skippedCount: number } {
  const lines = content.split("\n");
  const events: Event[] = [];
  let skippedCount = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx].trimEnd();
    if (rawLine.length === 0) continue;

    const lineNum = lineIdx + 1;

    // Minimum syslog header length
    if (rawLine.length < 16) {
      skippedCount++;
      continue;
    }

    // Extract timestamp: "Oct 20 10:14:22"
    const parts = rawLine.split(" ").filter((s) => s.length > 0);
    if (parts.length < 5) {
      skippedCount++;
      continue;
    }

    const monthStr = parts[0];
    const dayStr = parts[1];
    const timeStr = parts[2];

    if (!(monthStr in MONTH_MAP)) {
      skippedCount++;
      continue;
    }

    const ts = parseSyslogDate(monthStr, dayStr, timeStr);

    let symbol: EventSymbol | null = null;
    let source = "unknown";
    const fields: Record<string, string> = {};

    const failedIdx = rawLine.indexOf("Failed password for ");
    const acceptedIdx = rawLine.indexOf("Accepted password for ") !== -1
      ? rawLine.indexOf("Accepted password for ")
      : rawLine.indexOf("Accepted publickey for ");
    const probeIdx = rawLine.indexOf("refused connect from ") !== -1
      ? rawLine.indexOf("refused connect from ")
      : rawLine.indexOf("Connection refused from ");

    if (failedIdx !== -1) {
      symbol = "F";
      const fromIdx = rawLine.indexOf(" from ", failedIdx);
      if (fromIdx !== -1) {
        let userPart = rawLine.substring(failedIdx + "Failed password for ".length, fromIdx);
        if (userPart.startsWith("invalid user ")) {
          userPart = userPart.substring("invalid user ".length);
        }
        fields.user = userPart.trim();

        const afterFrom = rawLine.substring(fromIdx + " from ".length);
        const spaceIdx = afterFrom.indexOf(" ");
        source = spaceIdx !== -1 ? afterFrom.substring(0, spaceIdx) : afterFrom;
        fields.source = source;
      }
    } else if (acceptedIdx !== -1) {
      symbol = "S";
      const fromIdx = rawLine.indexOf(" from ", acceptedIdx);
      if (fromIdx !== -1) {
        const afterAccepted = rawLine.substring(acceptedIdx);
        const forIdx = afterAccepted.indexOf("for ");
        fields.user = afterAccepted.substring(forIdx + 4, afterAccepted.indexOf(" from ")).trim();

        const afterFrom = rawLine.substring(fromIdx + " from ".length);
        const spaceIdx = afterFrom.indexOf(" ");
        source = spaceIdx !== -1 ? afterFrom.substring(0, spaceIdx) : afterFrom;
        fields.source = source;
      }
    } else if (probeIdx !== -1 || rawLine.includes("Connection closed by authenticating user")) {
      symbol = "P";
      const fromIdx = rawLine.indexOf("from ");
      if (fromIdx !== -1) {
        const afterFrom = rawLine.substring(fromIdx + 5);
        const spaceIdx = afterFrom.indexOf(" ");
        source = spaceIdx !== -1 ? afterFrom.substring(0, spaceIdx) : afterFrom;
        fields.source = source;
      }
    }

    if (symbol !== null && source !== "unknown") {
      events.push({
        lineNumber: lineNum,
        ts,
        source,
        kind: "auth",
        symbol,
        raw: rawLine,
        fields,
      });
    } else {
      skippedCount++;
    }
  }

  return { events, skippedCount };
}

/**
 * Parses Nginx/Apache Combined Access Log format into normalized Event objects.
 * Format: 192.168.1.1 - - [20/Oct/2026:10:15:00 +0000] "GET /path?query HTTP/1.1" 200 1234 "referer" "user-agent"
 */
export function parseAccessLog(content: string): { events: Event[]; skippedCount: number } {
  const lines = content.split("\n");
  const events: Event[] = [];
  let skippedCount = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx].trimEnd();
    if (rawLine.length === 0) continue;

    const lineNum = lineIdx + 1;

    // 1. Extract IP before first space
    const firstSpace = rawLine.indexOf(" ");
    if (firstSpace === -1) {
      skippedCount++;
      continue;
    }
    const source = rawLine.substring(0, firstSpace);

    // 2. Extract timestamp inside [ ... ]
    const openBracket = rawLine.indexOf("[", firstSpace);
    const closeBracket = rawLine.indexOf("]", openBracket);
    if (openBracket === -1 || closeBracket === -1) {
      skippedCount++;
      continue;
    }
    const dateStr = rawLine.substring(openBracket + 1, closeBracket);
    const ts = parseAccessLogDate(dateStr);

    // 3. Extract request line inside first quotes " ... "
    const firstQuote = rawLine.indexOf('"', closeBracket);
    const secondQuote = rawLine.indexOf('"', firstQuote + 1);
    if (firstQuote === -1 || secondQuote === -1) {
      skippedCount++;
      continue;
    }
    const requestLine = rawLine.substring(firstQuote + 1, secondQuote);
    const firstSpaceInReq = requestLine.indexOf(" ");
    const lastSpaceInReq = requestLine.lastIndexOf(" ");

    let method = "GET";
    let fullUri = "/";
    if (firstSpaceInReq !== -1 && lastSpaceInReq > firstSpaceInReq) {
      method = requestLine.substring(0, firstSpaceInReq);
      fullUri = requestLine.substring(firstSpaceInReq + 1, lastSpaceInReq);
    } else {
      const reqTokens = requestLine.split(" ");
      method = reqTokens[0] || "GET";
      fullUri = reqTokens[1] || "/";
    }

    // Split URI into path and query
    let path = fullUri;
    let query = "";
    const questionIdx = fullUri.indexOf("?");
    if (questionIdx !== -1) {
      path = fullUri.substring(0, questionIdx);
      query = fullUri.substring(questionIdx + 1);
    }

    // 4. Extract HTTP status code
    const afterReq = rawLine.substring(secondQuote + 1).trimStart();
    const statusSpace = afterReq.indexOf(" ");
    if (statusSpace === -1) {
      skippedCount++;
      continue;
    }
    const statusStr = afterReq.substring(0, statusSpace);
    const status = parseInt(statusStr, 10);
    if (isNaN(status)) {
      skippedCount++;
      continue;
    }

    // 5. Extract User-Agent from last quotes
    let userAgent = "";
    const lastQuote = rawLine.lastIndexOf('"');
    const secondLastQuote = rawLine.lastIndexOf('"', lastQuote - 1);
    if (secondLastQuote !== -1 && lastQuote > secondLastQuote) {
      userAgent = rawLine.substring(secondLastQuote + 1, lastQuote);
    }

    // Map status code to symbol
    const symbol: EventSymbol = status >= 400 ? "E" : "R";

    events.push({
      lineNumber: lineNum,
      ts,
      source,
      kind: "web",
      symbol,
      raw: rawLine,
      fields: {
        method,
        path,
        query,
        status: statusStr,
        userAgent,
        source,
      },
    });
  }

  return { events, skippedCount };
}
