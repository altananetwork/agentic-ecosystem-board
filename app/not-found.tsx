import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <>
      <SiteHeader chains={[]} />
      <main className="wrap">
        <section className="card" style={{ marginTop: 32, padding: "36px 20px", color: "var(--text-secondary)" }}>
          There is no board at this address. <Link href="/">Back to all chains</Link>.
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
