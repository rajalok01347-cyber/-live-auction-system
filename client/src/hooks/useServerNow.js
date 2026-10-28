import { useState, useEffect } from "react";
import { api } from "../config/api.js";

// Midpoint sampling accounts for round-trip delay; monotonic time tolerates
// changes to the viewer's device clock while bidding.
export function useServerNow() {
  const [anchor, setAnchor] = useState(null);
  const [tick, setTick] = useState(() => performance.now());
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const start = performance.now();
      try {
        const { data } = await api.get("/time");
        const end = performance.now();
        if (alive) setAnchor({ server: data.now + (end - start) / 2, local: end });
      } catch { /* Keep the last synchronized clock while disconnected. */ }
    };
    void sync();
    const clock = setInterval(() => setTick(performance.now()), 250);
    const resync = setInterval(sync, 15000);
    return () => { alive = false; clearInterval(clock); clearInterval(resync); };
  }, []);
  return anchor ? anchor.server + tick - anchor.local : null;
}
