import styles from "./DashboardNotes.module.css";

/** The Dune-style text widget: what the board is, what each number means, and the asset scope. */
export function DashboardNotes({
  chainName,
  tokens,
  agentsSource,
  crossCheck,
}: {
  chainName: string;
  tokens: string[];
  agentsSource?: string;
  crossCheck?: string;
}) {
  const list = tokens.join(", ");
  const indexed = agentsSource ? `agent data indexed by ${agentsSource}${crossCheck ? ` and cross-checked against ${crossCheck}` : ""}` : "public agent indexes";
  return (
    <div className={styles.notes}>
      <h2>{chainName} agentic ecosystem</h2>
      <p>
        This board tracks registered ERC-8004 agents on {chainName} using {indexed}, and wallet balances read directly on-chain.
      </p>
      <p>
        Each registered agent is mapped to its owner wallet, wallets are deduplicated, and current assets and 30-day movement are measured across that wallet set.
      </p>

      <h3>What this dashboard shows</h3>
      <ul>
        <li><strong>Total agents:</strong> registered ERC-8004 agents found on {chainName}.</li>
        <li><strong>Unique wallets:</strong> distinct owner wallets associated with those agents.</li>
        <li><strong>Wallets with assets:</strong> wallets holding at least one tracked asset.</li>
        <li><strong>Total assets:</strong> current value held in {list}.</li>
        <li><strong>30D total volume:</strong> gross movement of {list} balances across agent wallets over the last 30 days, measured between daily snapshots.</li>
        <li><strong>Active agent wallets, 30D:</strong> wallets whose balances moved over the last 30 days.</li>
        <li><strong>Top projects:</strong> named agent projects ranked by registered agent count.</li>
      </ul>

      <h3>Asset and volume scope</h3>
      <p>The board currently tracks:</p>
      <ul>
        {tokens.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p>
        Volume is measured as gross balance movement where an agent wallet gained or lost a tracked asset between two daily snapshots. It is a lower bound of transfer volume: transfers that net out within a day are not visible.
      </p>
    </div>
  );
}
