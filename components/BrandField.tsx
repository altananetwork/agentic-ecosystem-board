"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./BrandField.module.css";

type FieldHandle = { destroy: () => void };
type FieldApi = { start: (canvas: HTMLCanvasElement, opts: { variant: string }) => FieldHandle };
declare global {
  interface Window {
    AltanaAsciiField?: FieldApi;
  }
}

const SCRIPT_SRC = "/brand/ascii-field.js";
const STILL_SRC = "/brand/ascii-field.svg";

function loadEngine(): Promise<FieldApi> {
  if (window.AltanaAsciiField) return Promise.resolve(window.AltanaAsciiField);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const done = () => (window.AltanaAsciiField ? resolve(window.AltanaAsciiField) : reject(new Error("engine missing")));
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => reject(new Error("engine failed to load")), { once: true });
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

/**
 * The Altana ASCII field as a backdrop. Animated "onboard" variant when motion is allowed
 * and the engine loads; the still export otherwise. Transparent ground, masked so the left
 * side stays quiet for type.
 */
export function BrandField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) {
      setStill(true);
      return;
    }
    let handle: FieldHandle | null = null;
    let cancelled = false;
    loadEngine()
      .then((api) => {
        if (cancelled) return;
        handle = api.start(canvas, { variant: "onboard" });
      })
      .catch(() => {
        if (!cancelled) setStill(true);
      });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, []);

  return (
    <div className={styles.field} aria-hidden>
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={STILL_SRC} alt="" className={styles.still} />
      ) : (
        <div className={styles.box}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
      )}
    </div>
  );
}
