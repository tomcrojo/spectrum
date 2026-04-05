import { useEffect, useState } from "react";

type FollowUpBehavior = "queue" | "steer";

function isFollowUpBehavior(value: unknown): value is FollowUpBehavior {
  return value === "queue" || value === "steer";
}

function getFollowUpBehaviorFromSearch(): FollowUpBehavior | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = new URLSearchParams(window.location.search).get("spectrumFollowUpBehavior");
  return isFollowUpBehavior(raw) ? raw : null;
}

export function useEmbeddedFollowUpBehavior(): FollowUpBehavior | null {
  const [behavior, setBehavior] = useState<FollowUpBehavior | null>(() =>
    getFollowUpBehaviorFromSearch(),
  );

  useEffect(() => {
    setBehavior(getFollowUpBehaviorFromSearch());

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            type?: unknown;
            settings?: {
              followUpBehavior?: unknown;
            };
          }
        | null;

      if (!data || data.type !== "spectrum:set-client-settings") {
        return;
      }

      const nextBehavior = data.settings?.followUpBehavior;
      if (!isFollowUpBehavior(nextBehavior)) {
        return;
      }

      setBehavior(nextBehavior);
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return behavior;
}
