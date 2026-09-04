"use client";

import { useEffect, useState } from "react";
import { formatRelative, formatUtc } from "@/lib/format";

/** Renders the absolute UTC time on the server, switches to a relative phrase after hydration. */
export function RelativeTime({ iso, prefix = "" }: { iso: string; prefix?: string }) {
  const [text, setText] = useState<string>(formatUtc(iso));
  useEffect(() => {
    setText(formatRelative(iso));
    const id = setInterval(() => setText(formatRelative(iso)), 60_000);
    return () => clearInterval(id);
  }, [iso]);
  return (
    <time dateTime={iso} title={formatUtc(iso)}>
      {prefix}{text}
    </time>
  );
}
