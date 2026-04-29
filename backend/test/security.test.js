import test from "node:test";
import assert from "node:assert/strict";
import { sha256, slugify } from "../src/security.js";

test("sha256 gera hash estavel", () => {
  assert.equal(
    sha256("admin123"),
    "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"
  );
});

test("slugify remove acentos e espacos", () => {
  assert.equal(slugify("Em trânsito hoje"), "em-transito-hoje");
});
