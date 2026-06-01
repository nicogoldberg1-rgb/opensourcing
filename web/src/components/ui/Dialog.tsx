import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/cn";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-2xl outline-none">
          <header className="mb-3 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-sm font-semibold text-neutral-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-xs text-neutral-500">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X size={14} />
              </button>
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type ConfirmIntent = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
};

type PromptIntent = {
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel?: string;
  destructive?: boolean;
  resolve: (value: string | null) => void;
};

// Tiny imperative dialog API — replaces window.confirm / window.prompt.
let confirmDispatch: ((i: ConfirmIntent) => void) | null = null;
let promptDispatch: ((i: PromptIntent) => void) | null = null;

export function confirmDialog(opts: Omit<ConfirmIntent, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    if (!confirmDispatch) {
      resolve(window.confirm(opts.title));
      return;
    }
    confirmDispatch({ ...opts, resolve });
  });
}

export function promptDialog(opts: Omit<PromptIntent, "resolve">): Promise<string | null> {
  return new Promise((resolve) => {
    if (!promptDispatch) {
      resolve(window.prompt(opts.title));
      return;
    }
    promptDispatch({ ...opts, resolve });
  });
}

export function DialogHost() {
  const [confirmState, setConfirmState] = useState<ConfirmIntent | null>(null);
  const [promptState, setPromptState] = useState<PromptIntent | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    confirmDispatch = (i) => setConfirmState(i);
    promptDispatch = (i) => {
      setPromptValue("");
      setPromptState(i);
    };
    return () => {
      confirmDispatch = null;
      promptDispatch = null;
    };
  }, []);

  useEffect(() => {
    if (promptState && inputRef.current) inputRef.current.focus();
  }, [promptState]);

  return (
    <>
      <Modal
        open={confirmState !== null}
        onOpenChange={(o) => {
          if (!o && confirmState) {
            confirmState.resolve(false);
            setConfirmState(null);
          }
        }}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              confirmState?.resolve(false);
              setConfirmState(null);
            }}
          >
            {confirmState?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            size="sm"
            variant={confirmState?.destructive ? "danger" : "primary"}
            onClick={() => {
              confirmState?.resolve(true);
              setConfirmState(null);
            }}
          >
            {confirmState?.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={promptState !== null}
        onOpenChange={(o) => {
          if (!o && promptState) {
            promptState.resolve(null);
            setPromptState(null);
          }
        }}
        title={promptState?.title ?? ""}
        description={promptState?.description}
      >
        <input
          ref={inputRef}
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          placeholder={promptState?.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && promptValue.trim() && promptState) {
              promptState.resolve(promptValue.trim());
              setPromptState(null);
            }
            if (e.key === "Escape" && promptState) {
              promptState.resolve(null);
              setPromptState(null);
            }
          }}
          className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              promptState?.resolve(null);
              setPromptState(null);
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant={promptState?.destructive ? "danger" : "primary"}
            disabled={!promptValue.trim()}
            onClick={() => {
              if (!promptState || !promptValue.trim()) return;
              promptState.resolve(promptValue.trim());
              setPromptState(null);
            }}
          >
            {promptState?.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function _unused(_: typeof cn) {
  // keep cn import shape consistent
}