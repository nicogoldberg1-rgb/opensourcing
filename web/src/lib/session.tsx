import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { Me } from "./types";

type SessionCtx = {
  me: Me | null;
  isOwner: boolean;
  isOperator: boolean;
  refresh: () => void;
};

const Ctx = createContext<SessionCtx | null>(null);

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("SessionProvider missing");
  return c;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(() => {
    api.getMe().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const value = useMemo<SessionCtx>(
    () => ({
      me,
      isOwner: me?.role === "owner",
      isOperator: me?.role === "operator",
      refresh,
    }),
    [me, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
