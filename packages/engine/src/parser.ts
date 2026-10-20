/**
 * parser.ts: Recursive descent regex parser producing a typed AST with error indices.
 *
 * Formal Theory:
 * Regular expressions define regular languages over an alphabet Σ through
 * three fundamental operations: union (R1 | R2), concatenation (R1 R2), and Kleene star (R*).
 * Extended operations (+, ?, {m,n}) are conservative extensions desugared into these primitives.
 *
 * This parser implements a deterministic LL(1)-style recursive descent parser that
 * tracks character column indices for precise error reporting (used by the web UI to
 * underline malformed regexes).
 */

import {
  CharSet,
  charSetFromChar,
  charSetFromRange,
  charSetUnion,
  charSetNegate,
  charSetNormalize,
  charToSymbol,
  DOT_CHAR_SET,
  DIGIT_CHAR_SET,
  WORD_CHAR_SET,
  WHITESPACE_CHAR_SET,
  TAB_CODE,
  EMPTY_CHAR_SET,
} from "./alphabet";

export class RegexSyntaxError extends Error {
  constructor(message: string, public readonly index: number) {
    super(`${message} at column ${index}`);
    this.name = "RegexSyntaxError";
  }
}

export type ASTNode =
  | EmptyNode
  | CharSetNode
  | ConcatNode
  | UnionNode
  | StarNode
  | PlusNode
  | QuestionNode;

export interface EmptyNode {
  readonly type: "empty";
  readonly id: number;
}

export interface CharSetNode {
  readonly type: "charSet";
  readonly id: number;
  readonly charSet: CharSet;
  readonly rawLabel?: string;
}

export interface ConcatNode {
  readonly type: "concat";
  readonly id: number;
  readonly children: readonly ASTNode[];
}

export interface UnionNode {
  readonly type: "union";
  readonly id: number;
  readonly left: ASTNode;
  readonly right: ASTNode;
}

export interface StarNode {
  readonly type: "star";
  readonly id: number;
  readonly child: ASTNode;
}

export interface PlusNode {
  readonly type: "plus";
  readonly id: number;
  readonly child: ASTNode;
}

export interface QuestionNode {
  readonly type: "question";
  readonly id: number;
  readonly child: ASTNode;
}

export interface ParserOptions {
  caseInsensitive?: boolean;
}

let nextNodeId = 1;
function genId(): number {
  return nextNodeId++;
}

/** Reset AST node ID counter (useful for deterministic tests) */
export function resetNodeIdCounter(start = 1): void {
  nextNodeId = start;
}

/**
 * Expand a CharSet to include both upper and lowercase variants for ASCII letters.
 */
function applyCaseInsensitivity(set: CharSet): CharSet {
  let expanded = set;
  for (const [start, end] of set) {
    // Check intersection with lowercase 'a'-'z' (97-122)
    const lowerStart = Math.max(start, 97);
    const lowerEnd = Math.min(end, 122);
    if (lowerStart <= lowerEnd) {
      // Map to uppercase (subtract 32)
      expanded = charSetUnion(expanded, charSetFromRange(lowerStart - 32, lowerEnd - 32));
    }

    // Check intersection with uppercase 'A'-'Z' (65-90)
    const upperStart = Math.max(start, 65);
    const upperEnd = Math.min(end, 90);
    if (upperStart <= upperEnd) {
      // Map to lowercase (add 32)
      expanded = charSetUnion(expanded, charSetFromRange(upperStart + 32, upperEnd + 32));
    }
  }
  return expanded;
}

/**
 * Parses a regular expression string into a typed Abstract Syntax Tree (AST).
 * Throws RegexSyntaxError with character index on syntax errors.
 */
export function parseRegex(pattern: string, options: ParserOptions = {}): ASTNode {
  let pos = 0;
  const len = pattern.length;

  function peek(): string | null {
    return pos < len ? pattern[pos] : null;
  }

  function consume(): string {
    return pattern[pos++];
  }

  /** Parse union: term ('|' term)* */
  function parseUnion(): ASTNode {
    let node = parseConcat();

    while (peek() === "|") {
      consume(); // eat '|'
      // Support trailing or empty branches like a| or |b as empty
      const right = peek() === null || peek() === ")" ? { type: "empty" as const, id: genId() } : parseConcat();
      node = {
        type: "union",
        id: genId(),
        left: node,
        right,
      };
    }

    return node;
  }

  /** Parse concat: piece+ */
  function parseConcat(): ASTNode {
    const pieces: ASTNode[] = [];

    while (pos < len && peek() !== "|" && peek() !== ")") {
      pieces.push(parsePiece());
    }

    if (pieces.length === 0) {
      return { type: "empty", id: genId() };
    }
    if (pieces.length === 1) {
      return pieces[0];
    }
    return {
      type: "concat",
      id: genId(),
      children: pieces,
    };
  }

  /** Parse piece: atom quantifier* */
  function parsePiece(): ASTNode {
    let atom = parseAtom();

    while (pos < len) {
      const ch = peek();
      if (ch === "*") {
        consume();
        atom = { type: "star", id: genId(), child: atom };
      } else if (ch === "+") {
        consume();
        atom = { type: "plus", id: genId(), child: atom };
      } else if (ch === "?") {
        consume();
        atom = { type: "question", id: genId(), child: atom };
      } else if (ch === "{") {
        atom = parseBoundedQuantifier(atom);
      } else {
        break;
      }
    }

    return atom;
  }

  /** Parse bounded quantifier: {m}, {m,}, {m,n} and desugar into concat / star / question */
  function parseBoundedQuantifier(atom: ASTNode): ASTNode {
    const startIdx = pos;
    consume(); // eat '{'

    let minStr = "";
    while (peek() !== null && /\d/.test(peek()!)) {
      minStr += consume();
    }

    if (minStr.length === 0) {
      throw new RegexSyntaxError("Quantifier requires at least one digit", startIdx);
    }
    const min = parseInt(minStr, 10);

    let max: number | null = min;

    if (peek() === ",") {
      consume(); // eat ','
      if (peek() === "}") {
        max = null; // unbounded: {m,}
      } else {
        let maxStr = "";
        while (peek() !== null && /\d/.test(peek()!)) {
          maxStr += consume();
        }
        if (maxStr.length === 0) {
          throw new RegexSyntaxError("Invalid quantifier format", startIdx);
        }
        max = parseInt(maxStr, 10);
      }
    }

    if (peek() !== "}") {
      throw new RegexSyntaxError("Unclosed quantifier", startIdx);
    }
    consume(); // eat '}'

    if (max !== null && min > max) {
      throw new RegexSyntaxError(`Numbers out of order in quantifier {${min},${max}}`, startIdx);
    }

    // Desugar bounded quantifier:
    // Case 1: {m} -> atom concatenated m times
    // Case 2: {m,} -> atom m times + Star(atom)
    // Case 3: {m, n} -> atom m times + (n-m) copies of Question(atom)
    const elements: ASTNode[] = [];
    for (let i = 0; i < min; i++) {
      elements.push(atom);
    }

    if (max === null) {
      elements.push({ type: "star", id: genId(), child: atom });
    } else {
      const optCount = max - min;
      for (let i = 0; i < optCount; i++) {
        elements.push({ type: "question", id: genId(), child: atom });
      }
    }

    if (elements.length === 0) {
      return { type: "empty", id: genId() };
    }
    if (elements.length === 1) {
      return elements[0];
    }
    return {
      type: "concat",
      id: genId(),
      children: elements,
    };
  }

  /** Parse atom: character, group, bracket class, escape, or wildcard */
  function parseAtom(): ASTNode {
    const ch = peek();
    const curIdx = pos;

    if (ch === null) {
      return { type: "empty", id: genId() };
    }

    // Quantifier without atom error check
    if (ch === "*" || ch === "+" || ch === "?") {
      throw new RegexSyntaxError(`Dangling quantifier '${ch}'`, curIdx);
    }

    // Grouping
    if (ch === "(") {
      consume(); // eat '('
      if (peek() === ")") {
        consume();
        return { type: "empty", id: genId() };
      }
      const inside = parseUnion();
      if (peek() !== ")") {
        throw new RegexSyntaxError("Unclosed group", curIdx);
      }
      consume(); // eat ')'
      return inside;
    }

    if (ch === ")") {
      throw new RegexSyntaxError("Unexpected ')'", curIdx);
    }

    // Wildcard dot
    if (ch === ".") {
      consume();
      return {
        type: "charSet",
        id: genId(),
        charSet: DOT_CHAR_SET,
        rawLabel: ".",
      };
    }

    // Character class [ ... ]
    if (ch === "[") {
      return parseBracketClass();
    }

    // Escapes
    if (ch === "\\") {
      return parseEscape();
    }

    // Regular literal character
    consume();
    let set = charSetFromChar(charToSymbol(ch));
    if (options.caseInsensitive) {
      set = applyCaseInsensitivity(set);
    }
    return {
      type: "charSet",
      id: genId(),
      charSet: set,
      rawLabel: ch,
    };
  }

  /** Parse bracket character class [abc], [a-z], [^...] */
  function parseBracketClass(): ASTNode {
    const startIdx = pos;
    consume(); // eat '['

    let negate = false;
    if (peek() === "^") {
      negate = true;
      consume();
    }

    let ranges: [number, number][] = [];

    // Special case: ']' right at start is treated as literal ']'
    if (peek() === "]") {
      ranges.push([93, 93]);
      consume();
    }

    while (pos < len && peek() !== "]") {
      let code: number;
      const ch = consume();

      if (ch === "\\") {
        if (pos >= len) {
          throw new RegexSyntaxError("Dangling escape inside character class", pos - 1);
        }
        const esc = consume();
        if (esc === "d") {
          for (const [s, e] of DIGIT_CHAR_SET) ranges.push([s, e]);
          continue;
        } else if (esc === "w") {
          for (const [s, e] of WORD_CHAR_SET) ranges.push([s, e]);
          continue;
        } else if (esc === "s") {
          for (const [s, e] of WHITESPACE_CHAR_SET) ranges.push([s, e]);
          continue;
        } else if (esc === "t") {
          code = TAB_CODE;
        } else if (esc === "n") {
          code = 10;
        } else if (esc === "r") {
          code = 13;
        } else {
          code = charToSymbol(esc);
        }
      } else {
        code = charToSymbol(ch);
      }

      // Check for range '-'
      if (peek() === "-" && pos + 1 < len && pattern[pos + 1] !== "]") {
        const hyphenIdx = pos;
        consume(); // eat '-'
        let endCode: number;
        const endCh = consume();
        if (endCh === "\\") {
          if (pos >= len) {
            throw new RegexSyntaxError("Dangling escape in character range", pos - 1);
          }
          const esc = consume();
          endCode = charToSymbol(esc);
        } else {
          endCode = charToSymbol(endCh);
        }

        if (code > endCode) {
          throw new RegexSyntaxError("Range out of order in character class", hyphenIdx);
        }

        ranges.push([code, endCode]);
      } else {
        ranges.push([code, code]);
      }
    }

    if (peek() !== "]") {
      throw new RegexSyntaxError("Unclosed character class", startIdx);
    }
    consume(); // eat ']'

    let set = charSetNormalize(ranges);
    if (negate) {
      set = charSetNegate(set);
    }
    if (options.caseInsensitive) {
      set = applyCaseInsensitivity(set);
    }

    return {
      type: "charSet",
      id: genId(),
      charSet: set,
    };
  }

  /** Parse escape sequence outside bracket class */
  function parseEscape(): ASTNode {
    const escIdx = pos;
    consume(); // eat '\'

    if (pos >= len) {
      throw new RegexSyntaxError("Dangling escape at end of regex", escIdx);
    }

    const ch = consume();
    if (ch === "d") {
      return { type: "charSet", id: genId(), charSet: DIGIT_CHAR_SET, rawLabel: "\\d" };
    }
    if (ch === "w") {
      let set = WORD_CHAR_SET;
      if (options.caseInsensitive) set = applyCaseInsensitivity(set);
      return { type: "charSet", id: genId(), charSet: set, rawLabel: "\\w" };
    }
    if (ch === "s") {
      return { type: "charSet", id: genId(), charSet: WHITESPACE_CHAR_SET, rawLabel: "\\s" };
    }
    if (ch === "t") {
      return { type: "charSet", id: genId(), charSet: charSetFromChar(TAB_CODE), rawLabel: "\\t" };
    }
    if (ch === "n") {
      // Newline (outside printable ASCII, maps to OTHER_SYMBOL or 10)
      return { type: "charSet", id: genId(), charSet: charSetFromChar(charToSymbol("\n")), rawLabel: "\\n" };
    }
    if (ch === "r") {
      return { type: "charSet", id: genId(), charSet: charSetFromChar(charToSymbol("\r")), rawLabel: "\\r" };
    }

    // Escaped literal: \., \\, \', \", etc.
    let set = charSetFromChar(charToSymbol(ch));
    if (options.caseInsensitive) {
      set = applyCaseInsensitivity(set);
    }
    return {
      type: "charSet",
      id: genId(),
      charSet: set,
      rawLabel: `\\${ch}`,
    };
  }

  const ast = parseUnion();

  if (pos < len) {
    throw new RegexSyntaxError(`Unexpected character '${pattern[pos]}'`, pos);
  }

  return ast;
}
