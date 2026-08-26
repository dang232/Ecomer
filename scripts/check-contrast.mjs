import { contrastRatio, loadTokens, assertAccessiblePairs } from "./generate-design-tokens.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);

const foreground = args.get("--foreground");
const background = args.get("--background");
if (foreground && background) {
  const ratio = contrastRatio(foreground, background);
  if (ratio < 4.5) throw new Error(`${foreground} on ${background} has contrast ${ratio.toFixed(2)}:1 (requires 4.50:1)`);
  console.log(`${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
} else {
  const tokens = await loadTokens(new URL("../design-system/tokens.json", import.meta.url));
  assertAccessiblePairs(tokens);
  const grayRatio = contrastRatio(tokens.color.light.textSubtle, "#ffffff");
  if (grayRatio < 4.5) throw new Error(`light.textSubtle on white has contrast ${grayRatio.toFixed(2)}:1`);
  console.log(`declared pairs and light.textSubtle on white: ${grayRatio.toFixed(2)}:1`);
}
