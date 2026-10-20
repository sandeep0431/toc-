import { describe, it, expect } from "vitest";
import { parseRegex, RegexSyntaxError } from "../src/parser";
import { charSetContains } from "../src/alphabet";

describe("Regex Parser to AST", () => {
  it("parses simple literal sequence", () => {
    const ast = parseRegex("abc");
    expect(ast.type).toBe("concat");
    if (ast.type === "concat") {
      expect(ast.children).toHaveLength(3);
      expect(ast.children[0].type).toBe("charSet");
    }
  });

  it("parses alternation with correct precedence", () => {
    const ast = parseRegex("a|b|c");
    expect(ast.type).toBe("union");
  });

  it("parses Kleene star, plus, and question mark", () => {
    const ast = parseRegex("a*b+c?");
    expect(ast.type).toBe("concat");
    if (ast.type === "concat") {
      expect(ast.children[0].type).toBe("star");
      expect(ast.children[1].type).toBe("plus");
      expect(ast.children[2].type).toBe("question");
    }
  });

  it("desugars bounded quantifiers into primitives", () => {
    // {3} -> 3 concats
    const exact = parseRegex("a{3}");
    expect(exact.type).toBe("concat");
    if (exact.type === "concat") {
      expect(exact.children).toHaveLength(3);
    }

    // {2,} -> 2 concats + star
    const atLeast = parseRegex("a{2,}");
    expect(atLeast.type).toBe("concat");
    if (atLeast.type === "concat") {
      expect(atLeast.children).toHaveLength(3);
      expect(atLeast.children[2].type).toBe("star");
    }

    // {2,4} -> 2 concats + 2 questions
    const range = parseRegex("a{2,4}");
    expect(range.type).toBe("concat");
    if (range.type === "concat") {
      expect(range.children).toHaveLength(4);
      expect(range.children[2].type).toBe("question");
      expect(range.children[3].type).toBe("question");
    }
  });

  it("parses bracket character classes with ranges and negation", () => {
    const positive = parseRegex("[a-zA-Z0-9]");
    expect(positive.type).toBe("charSet");
    if (positive.type === "charSet") {
      expect(charSetContains(positive.charSet, 97)).toBe(true);  // 'a'
      expect(charSetContains(positive.charSet, 65)).toBe(true);  // 'A'
      expect(charSetContains(positive.charSet, 48)).toBe(true);  // '0'
      expect(charSetContains(positive.charSet, 33)).toBe(false); // '!'
    }

    const negative = parseRegex("[^0-9]");
    expect(negative.type).toBe("charSet");
    if (negative.type === "charSet") {
      expect(charSetContains(negative.charSet, 48)).toBe(false); // '0'
      expect(charSetContains(negative.charSet, 97)).toBe(true);  // 'a'
    }
  });

  it("handles caseInsensitive option", () => {
    const ast = parseRegex("select", { caseInsensitive: true });
    expect(ast.type).toBe("concat");
    if (ast.type === "concat") {
      const first = ast.children[0];
      if (first.type === "charSet") {
        expect(charSetContains(first.charSet, 115)).toBe(true); // 's'
        expect(charSetContains(first.charSet, 83)).toBe(true);  // 'S'
      }
    }
  });

  describe("Syntax Error Index Reporting", () => {
    it("reports error index for dangling quantifier at column 0", () => {
      expect(() => parseRegex("*abc")).toThrowError(RegexSyntaxError);
      try {
        parseRegex("*abc");
      } catch (err: any) {
        expect(err.index).toBe(0);
      }
    });

    it("reports error index for unclosed group", () => {
      try {
        parseRegex("foo(bar");
        expect.unreachable();
      } catch (err: any) {
        expect(err instanceof RegexSyntaxError).toBe(true);
        expect(err.index).toBe(3); // '(' was opened at column 3
      }
    });

    it("reports error index for unexpected closing parenthesis", () => {
      try {
        parseRegex("abc)def");
        expect.unreachable();
      } catch (err: any) {
        expect(err instanceof RegexSyntaxError).toBe(true);
        expect(err.index).toBe(3);
      }
    });

    it("reports error index for unclosed bracket class", () => {
      try {
        parseRegex("test[abc");
        expect.unreachable();
      } catch (err: any) {
        expect(err instanceof RegexSyntaxError).toBe(true);
        expect(err.index).toBe(4);
      }
    });

    it("reports error index for inverted character class range [z-a]", () => {
      try {
        parseRegex("[z-a]");
        expect.unreachable();
      } catch (err: any) {
        expect(err instanceof RegexSyntaxError).toBe(true);
        expect(err.index).toBe(2); // '-' index
      }
    });

    it("reports error index for inverted bounded quantifier {5,2}", () => {
      try {
        parseRegex("a{5,2}");
        expect.unreachable();
      } catch (err: any) {
        expect(err instanceof RegexSyntaxError).toBe(true);
        expect(err.index).toBe(1); // '{' index
      }
    });
  });
});
