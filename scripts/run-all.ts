import { loadChains } from "../pipeline/chains";
import { log, parseArgs } from "../pipeline/cli";
import { balancesChain } from "./balances";
import { buildAll } from "./build";
import { syncChain } from "./sync";

const args = parseArgs(process.argv.slice(2));
const slugs = args.chain ? [args.chain] : loadChains().map((c) => c.slug);
const t0 = Date.now();
for (const slug of slugs) {
  const t = Date.now();
  await syncChain(slug, args.full);
  log(`${slug}: sync done in ${Math.round((Date.now() - t) / 1000)}s`);
  const tb = Date.now();
  await balancesChain(slug);
  log(`${slug}: balances done in ${Math.round((Date.now() - tb) / 1000)}s`);
}
buildAll(slugs);
log(`all done in ${Math.round((Date.now() - t0) / 1000)}s`);
