import { useCallback, useState } from "react";

/** Brief success flash for a named action button (auto-clears after `duration` ms). */
export function useActionSuccess(duration = 1400) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const trigger = useCallback(
    (id: string) => {
      setActiveId(id);
      window.setTimeout(() => {
        setActiveId((current) => (current === id ? null : current));
      }, duration);
    },
    [duration],
  );

  const isSuccess = useCallback((id: string) => activeId === id, [activeId]);

  return { trigger, isSuccess };
}
