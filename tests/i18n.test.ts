import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { harborCity } from "@/data/harbor-city";
import { scenarios } from "@/data/scenarios";
import { isLocale, japanese, translate } from "@/lib/i18n/messages";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

describe("Bilingual presentation", () => {
  it("covers UI copy, every synthetic place and every scenario in Japanese", () => {
    const missing = new Set<string>();
    for (const file of [...sourceFiles("components"), ...sourceFiles("app")]) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function visit(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(source) === "t" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const key = node.arguments[0].text.trim();
          if (/[A-Za-z]/.test(key) && !Object.hasOwn(japanese, key)) missing.add(key);
        }
        if (
          ts.isPropertyAssignment(node) &&
          ["label", "explanation"].includes(node.name.getText(source)) &&
          ts.isStringLiteral(node.initializer)
        ) {
          const key = node.initializer.text.trim();
          if (!Object.hasOwn(japanese, key)) missing.add(key);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    for (const key of [...harborCity.nodes, ...harborCity.edges]
      .map((item) => item.name)
      .concat(
        Object.values(scenarios).flatMap((scenario) => [scenario.name, scenario.description]),
      )) {
      if (!Object.hasOwn(japanese, key)) missing.add(key);
    }
    expect([...missing]).toEqual([]);
  });
  it("keeps English copy and calculated evidence intact while localizing labels", () => {
    expect(translate("en", "Restore {name}", { name: "Harbor Bridge" })).toBe(
      "Restore Harbor Bridge",
    );
    expect(translate("ja", "Restore {name}", { name: translate("ja", "Harbor Bridge") })).toBe(
      "ハーバー橋を復旧",
    );
    expect(
      translate("ja", "{utilization}% capacity · {time} min", { utilization: 141, time: "20.9" }),
    ).toBe("容量 141% · 20.9分");
    expect(translate("ja", " min")).toBe(" 分");
    expect(translate("ja", "/ 100")).toBe("/ 100");
    expect(isLocale("ja")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("__proto__")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});
