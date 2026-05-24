import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildOpenApiDocument, createRegistry } from "../src/openapi.js";

const registry = createRegistry();
const doc = buildOpenApiDocument(registry);

const out = resolve(process.cwd(), "openapi.json");
writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(`Wrote ${out}`);
