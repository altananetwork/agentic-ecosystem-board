import { formatInt, formatPercent } from "@/lib/format";
import styles from "./TopProjects.module.css";

export function TopProjects({ projects }: { projects: { project: string; agents: number; share: number }[] }) {
  if (projects.length === 0) {
    return <div className={styles.list}><span className="muted">No project attribution yet.</span></div>;
  }
  const max = Math.max(...projects.map((p) => p.agents));
  return (
    <div>
      <div className={styles.list}>
        {projects.map((p) => (
          <div key={p.project} className={`${styles.row} ${p.project === "Other" ? styles.rowOther : ""}`}>
            <span className={styles.name} title={p.project}>{p.project}</span>
            <div className={styles.track} aria-hidden>
              <div className={styles.fill} style={{ width: `${(p.agents / max) * 100}%` }} />
            </div>
            <span className={styles.count} title={formatInt(p.agents)}>{formatPercent(p.share)}</span>
          </div>
        ))}
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Project</th>
            <th className={styles.num}>Agents</th>
            <th className={styles.num}>Share</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.project}>
              <td>{p.project}</td>
              <td className={styles.num}>{formatInt(p.agents)}</td>
              <td className={styles.num}>{formatPercent(p.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
