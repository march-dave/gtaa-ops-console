import { useEffect, useRef, useState } from "react";
import type { CvEvent, CvStreamEvent } from "@gtaa/contracts";

import { useAuth } from "../auth/MockAuthProvider";

export interface CvStreamState {
  events: CvEvent[];
  connected: boolean;
  lastHeartbeat: string | null;
  error: string | null;
}

const upsert = (list: CvEvent[], event: CvEvent): CvEvent[] => {
  const idx = list.findIndex((e) => e.id === event.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = event;
    return next;
  }
  return [event, ...list];
};

export function useCvStream(): CvStreamState {
  const { mockKey } = useAuth();
  const [state, setState] = useState<CvStreamState>({
    events: [],
    connected: false,
    lastHeartbeat: null,
    error: null,
  });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (mockKey === "none") {
      setState({ events: [], connected: false, lastHeartbeat: null, error: null });
      return;
    }
    const url = `/api/cv-events/stream?mockUser=${encodeURIComponent(mockKey)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setState((s) => ({ ...s, connected: true, error: null }));
    };

    es.onmessage = (msgEvent) => {
      try {
        const msg = JSON.parse(msgEvent.data) as CvStreamEvent;
        if (msg.type === "snapshot") {
          setState((s) => ({ ...s, events: msg.events }));
        } else if (msg.type === "created" || msg.type === "updated") {
          setState((s) => ({ ...s, events: upsert(s.events, msg.event) }));
        } else if (msg.type === "heartbeat") {
          setState((s) => ({ ...s, lastHeartbeat: msg.at }));
        }
      } catch (err) {
        setState((s) => ({ ...s, error: (err as Error).message }));
      }
    };

    es.onerror = () => {
      setState((s) => ({ ...s, connected: false, error: "Stream connection lost" }));
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [mockKey]);

  return state;
}
