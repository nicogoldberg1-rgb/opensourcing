import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight, ArrowLeft, Sparkles, MousePointerClick } from "lucide-react";
import { useSession } from "../lib/session";

const LS_KEY = "nsp-tour-done";
const HIPAA_CYCLE = "/cycle/run-cycle-hipaa-compliance-software-2026-06-14";

type Step = {
  target: string | null;
  path: string;
  title: string;
  body: string;
  freeform?: boolean; // no dimming — full readability + interaction
  anchor?: string; // freeform card placement reference (no dimming), else corner
  yourTurn?: boolean; // shows a "your turn" pill in the card
};

const STEPS: Step[] = [
  {
    target: null,
    path: "/",
    title: "Welcome to Open Sourcing",
    body: "An autopilot for search-fund outreach — it finds industries, screens companies, writes the emails, and tees everything up for your approval. Here's a quick tour.",
  },
  {
    target: '[data-tour="nav"]',
    path: "/",
    title: "The lay of the land",
    body: "Five areas up here: Home (your pipeline), Sequences, Live cycle, Spend, and Requests. We'll walk through them one by one.",
  },
  {
    target: '[data-tour="board"]',
    path: "/",
    title: "Your industry pipeline",
    body: "Every niche you're considering lives here and moves left to right: Seed → Proposed → Approved → Queued → In progress → Complete. Use the tabs to switch stages.",
  },
  {
    target: null,
    path: "/",
    freeform: true,
    anchor: '[data-tour="board"]',
    yourTurn: true,
    title: "Open a niche",
    body: "Go ahead — click any niche on the right. A panel opens with its thesis, tailwinds, a 'Fit' score (the 4+1 framework), and a buy box you can edit. Have a look, then hit Next.",
  },
  {
    target: null,
    path: "/",
    freeform: true,
    anchor: '[data-tour="board"]',
    yourTurn: true,
    title: "Try it yourself",
    body: "Switch to the Seed tab, add 'Pest Control', then open it and hit Investigate — watch the autopilot develop it into a full proposal. (Demo: nothing is spent.) Then hit Next.",
  },
  {
    target: '[data-tour="digest"]',
    path: "/",
    title: "The nightly run",
    body: "Each night the autopilot builds your top queued niche — or brainstorms new industries if the queue is empty — and sends a digest. You can also trigger a run with 'Run now'.",
  },
  {
    target: '[data-tour="nav-cycle"]',
    path: "/",
    title: "Live cycle",
    body: "This is where a run plays out, step by step. Hit Next and I'll open one for you.",
  },
  {
    target: '[data-tour="cycle-phases"]',
    path: HIPAA_CYCLE,
    title: "Watch a cycle run",
    body: "A run moves through Search → Pull → Screen → Contacts → Personalize → Sequence. Here it found ~200 companies, kept 50, and built outreach to 36 — then paused for your go-ahead.",
  },
  {
    target: '[data-tour="cycle-phases"]',
    path: HIPAA_CYCLE,
    title: "Under the hood: a toolkit of skills",
    body: "Each phase is its own Claude skill working in concert — searching Inven, screening for fit, finding the owners, and writing the outreach — all orchestrated to run in order.",
  },
  {
    target: '[data-tour="cycle-phases"]',
    path: HIPAA_CYCLE,
    title: "The vision",
    body: "I plan on making these skills available as a customizable toolkit you can connect to your tools and tune to how you run your search.",
  },
  {
    target: '[data-tour="view-sequence"]',
    path: HIPAA_CYCLE,
    title: "See what it wrote",
    body: "When a run finishes it builds the full outreach sequence. Hit Next to read exactly what it wrote.",
  },
  {
    target: null,
    path: "/sequence/9101",
    freeform: true,
    title: "The outreach it wrote",
    body: "A LinkedIn note plus six emails, personalized in your voice — scroll through them. This is what the machine produces, ready for you to activate. Then hit Next.",
  },
  {
    target: null,
    path: "/spend",
    freeform: true,
    title: "Every dollar tracked",
    body: "Spend tracks all your credits and costs — Inven pulls and Claude usage included — with a weekly cap, so nothing runs away from you.",
  },
  {
    target: '[data-tour="requests-inbox"]',
    path: "/requests",
    title: "Bring on a team, safely",
    body: "Roles let interns or partners contribute without risk: they do everything up to 'ready', but anything that spends becomes a request you approve right here. You stay in control.",
  },
  {
    target: null,
    path: "/",
    title: "That's the tour — now it's yours",
    body: "Everything here is sample data, so click around freely: open niches, edit a buy box, read the sequences, investigate a seed. Nothing sends real email or spends a cent.",
  },
];

type TourCtx = { start: () => void; active: boolean };
const Ctx = createContext<TourCtx | null>(null);

export function useTour() {
  const c = useContext(Ctx);
  if (!c) throw new Error("TourProvider missing");
  return c;
}

const CARD_W = 340;
const CARD_H = 240;
const M = 16;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(v, hi));
}

// For spotlight steps: place the card on whichever side of the target has the
// most room, so it never covers what it points at.
function placeBeside(rect: DOMRect): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sides = [
    { side: "right", space: vw - rect.right, fits: vw - rect.right >= CARD_W + M },
    { side: "left", space: rect.left, fits: rect.left >= CARD_W + M },
    { side: "bottom", space: vh - rect.bottom, fits: vh - rect.bottom >= CARD_H + M },
    { side: "top", space: rect.top, fits: rect.top >= CARD_H + M },
  ];
  const pick = sides.filter((s) => s.fits).sort((a, b) => b.space - a.space)[0];
  if (!pick) return { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: CARD_W };
  let top: number, left: number;
  if (pick.side === "right" || pick.side === "left") {
    top = clamp(rect.top + rect.height / 2 - CARD_H / 2, M, vh - CARD_H - M);
    left = pick.side === "right" ? rect.right + M : rect.left - CARD_W - M;
  } else {
    left = clamp(rect.left + rect.width / 2 - CARD_W / 2, M, vw - CARD_W - M);
    top = pick.side === "bottom" ? rect.bottom + M : rect.top - CARD_H - M;
  }
  return { top, left, width: CARD_W };
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { me } = useSession();
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const scrolledFor = useRef(-1);

  const start = useCallback(() => {
    setIndex(0);
    scrolledFor.current = -1;
    setActive(true);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(LS_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!me?.fixture) return;
    let seen = false;
    try {
      seen = localStorage.getItem(LS_KEY) === "1";
    } catch {
      seen = false;
    }
    if (!seen) {
      const t = setTimeout(() => start(), 700);
      return () => clearTimeout(t);
    }
  }, [me?.fixture, start]);

  useEffect(() => {
    if (!active) return;
    const step = STEPS[index];
    if (step.path && window.location.pathname !== step.path) {
      navigate(step.path);
    }
    // Spotlight steps follow a dimmed target; freeform steps may place the card
    // beside an anchor (no dimming) or, with no anchor, park in the corner.
    const sel = step.freeform ? step.anchor ?? null : step.target;
    if (!sel) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(sel);
      if (el) {
        if (!step.freeform && scrolledFor.current !== index) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          scrolledFor.current = index;
        }
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };
    measure();
    const id = window.setInterval(measure, 150);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [active, index, navigate]);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  if (!active || !step) return <Ctx.Provider value={{ start, active }}>{children}</Ctx.Provider>;

  const mode = step.freeform ? "freeform" : step.target ? "spotlight" : "centered";
  const cardStyle: CSSProperties =
    mode === "freeform"
      ? rect
        ? placeBeside(rect)
        : { left: M, bottom: M, width: CARD_W }
      : mode === "spotlight" && rect
        ? placeBeside(rect)
        : { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: CARD_W };

  return (
    <Ctx.Provider value={{ start, active }}>
      {children}
      {mode === "centered" && (
        <div className="pointer-events-none fixed inset-0 z-[110] bg-neutral-900/55" />
      )}
      {mode === "spotlight" && (rect ? <Spotlight rect={rect} /> : (
        <div className="pointer-events-none fixed inset-0 z-[110] bg-neutral-900/55" />
      ))}

      <div
        className="pointer-events-auto fixed z-[120] rounded-xl border border-neutral-200 bg-white p-4 shadow-2xl"
        style={cardStyle}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-accent">
            <Sparkles size={12} /> Tour · {index + 1} of {STEPS.length}
            {step.yourTurn && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[9px] text-white">
                <MousePointerClick size={9} /> your turn
              </span>
            )}
          </span>
          <button
            onClick={finish}
            className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close tour"
          >
            <X size={14} />
          </button>
        </div>
        <h3 className="text-sm font-semibold text-neutral-900">{step.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{step.body}</p>

        <div className="mt-3 flex items-center justify-between">
          <button onClick={finish} className="text-[11px] text-neutral-400 hover:text-neutral-600">
            Skip tour
          </button>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
              >
                <ArrowLeft size={13} /> Back
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800"
            >
              {isLast ? "Explore it yourself" : "Next"}
              {!isLast && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}

function Spotlight({ rect }: { rect: DOMRect }) {
  const pad = 6;
  const top = Math.max(0, rect.top - pad);
  const left = Math.max(0, rect.left - pad);
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const dim = "pointer-events-none fixed z-[110] bg-neutral-900/55";
  return (
    <>
      <div className={dim} style={{ top: 0, left: 0, right: 0, height: top }} />
      <div className={dim} style={{ top, left: 0, width: left, height: h }} />
      <div className={dim} style={{ top, left: left + w, right: 0, height: h }} />
      <div className={dim} style={{ top: top + h, left: 0, right: 0, bottom: 0 }} />
      <div
        className="pointer-events-none fixed z-[111] rounded-lg ring-2 ring-white/90 ring-offset-2 ring-offset-transparent"
        style={{ top, left, width: w, height: h }}
      />
    </>
  );
}

export function TourButton() {
  const { start } = useTour();
  return (
    <button
      onClick={start}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      title="Replay the guided tour"
    >
      <Sparkles size={12} /> Tour
    </button>
  );
}
