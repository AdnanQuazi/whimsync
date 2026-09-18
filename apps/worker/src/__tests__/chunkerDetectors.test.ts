import { describe, expect, it } from "bun:test";
import {
  detectLanguage,
  detectPureCodeLanguage,
  isJson,
  isMarkdown,
  scoreContentLanguages,
} from "../chunking/detectors";

describe("Language & Content Detectors", () => {
  it("should accurately validate JSON objects and arrays", () => {
    expect(isJson('{"key": "value"}')).toBe(true);
    expect(isJson('[{"id": 1}, {"id": 2}]')).toBe(true);
    expect(isJson("   {  }  ")).toBe(true);
    expect(isJson("Just regular text")).toBe(false);
    expect(isJson("# Header\nNot json")).toBe(false);
    expect(isJson("{ malformed json")).toBe(false);
  });

  it("should accurately validate Markdown content", () => {
    expect(isMarkdown("# Heading 1\nSome text")).toBe(true);
    expect(isMarkdown("### Subheading\nDetails")).toBe(true);
    expect(isMarkdown("```javascript\nconsole.log(1)\n```")).toBe(true);
    expect(isMarkdown("```\nplain block\n```")).toBe(true);
    expect(isMarkdown("Just a standard paragraph with no headings.")).toBe(
      false,
    );
  });

  it("should match single lines against language regex patterns", () => {
    expect(detectLanguage("def hello_world():")).toBe("python");
    expect(detectLanguage("package main")).toBe("go");
    expect(detectLanguage("pub fn calculate() -> u32 {")).toBe("rust");
    expect(detectLanguage("import java.util.List;")).toBe("java");
    expect(detectLanguage("export interface UserState {")).toBe("typescript");
    expect(detectLanguage("function startServer() {")).toBe("javascript");
  });

  it("should correctly classify TypeScript starting with generic JavaScript imports (User Scenario)", () => {
    // Exact user scenario: JavaScript imports on line 1-2, TypeScript interface on line 4
    const tsCode = `import { useState, useEffect } from "react";
import path from "path";

export interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled }: ButtonProps) {
  const [active, setActive] = useState(false);
  return null;
}
`;
    const scores = scoreContentLanguages(tsCode, 50);
    expect(scores.get("typescript")).toBeGreaterThan(0);
    expect(detectPureCodeLanguage(tsCode)).toBe("typescript");
  });

  it("should correctly classify JavaScript files using const declarations (not Rust)", () => {
    const jsCode = `const express = require("express");
const app = express();
const port = 3000;

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = app;
`;
    expect(detectPureCodeLanguage(jsCode)).toBe("javascript");
  });

  it("should disambiguate C# vs Java using multi-line aggregate context", () => {
    const csharpCode = `using System;
using System.Collections.Generic;

namespace OrderProcessing {
    public class OrderService {
        public void Process() {
            Console.WriteLine("Processing order");
        }
    }
}
`;
    expect(detectPureCodeLanguage(csharpCode)).toBe("csharp");

    const javaCode = `package com.whimsync.services;

import java.util.List;
import java.util.ArrayList;

public class OrderService {
    public void process() {
        System.out.println("Processing order");
    }
}
`;
    expect(detectPureCodeLanguage(javaCode)).toBe("java");
  });

  it("should detect Python and Go code cleanly", () => {
    const pythonCode = `#!/usr/bin/env python
# Top-level license header

import sys
import os

def main():
    print("Running worker")

if __name__ == "__main__":
    main()
`;
    expect(detectPureCodeLanguage(pythonCode)).toBe("python");

    const goCode = `package main

import (
    "fmt"
    "net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "OK")
}
`;
    expect(detectPureCodeLanguage(goCode)).toBe("go");
  });

  it("should not falsely identify json or markdown as pure code", () => {
    expect(detectPureCodeLanguage('{\n  "name": "Whimsync"\n}')).toBe(null);
    expect(detectPureCodeLanguage("# Markdown Heading\n\nSome text")).toBe(
      null,
    );
  });
});
