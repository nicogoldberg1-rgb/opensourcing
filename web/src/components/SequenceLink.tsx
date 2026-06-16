import type { ReactNode, MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../lib/session";

// In the demo (fixture mode) the "open sequence" links go to an in-app preview
// of the built outreach — visitors can't reach the real Reply.io. In real mode
// they keep linking out to Reply.io, where Nico actually activates sequences.
export function SequenceLink({
  id,
  className,
  children,
  onClick,
  "data-tour": dataTour,
}: {
  id: number;
  className?: string;
  children: ReactNode;
  onClick?: (e: MouseEvent) => void;
  "data-tour"?: string;
}) {
  const { me } = useSession();
  if (me?.fixture) {
    return (
      <Link to={`/sequence/${id}`} className={className} onClick={onClick} data-tour={dataTour}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={`https://run.reply.io/sequence/${id}`}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={onClick}
      data-tour={dataTour}
    >
      {children}
    </a>
  );
}
