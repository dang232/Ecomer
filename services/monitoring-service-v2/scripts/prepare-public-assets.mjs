import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "socket.io-client", "dist", "socket.io.js");
const target = join(root, "public", "js", "socket.io.js");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
