import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";

type ToastTone = "default" | "success" | "error";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastCtx = {
  push: (message: string, tone?: ToastTone) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, tone: ToastTone = "default") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-md border bg-white px-3.5 py-2.5 text-sm shadow-lg",
              "animate-[fadeIn_120ms_ease-out]",
              t.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
              t.tone === "error" && "border-red-200 bg-red-50 text-red-900",
              t.tone === "default" && "border-neutral-200 text-neutral-800",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
