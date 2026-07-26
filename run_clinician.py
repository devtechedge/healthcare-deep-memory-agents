#!/usr/bin/env python3
"""
Clinician-side CLI for Cadence.

Examples:
  python run_clinician.py grant --patient demo --clinician dr_lee --hours 48
  python run_clinician.py brief --grant <id> --clinician dr_lee
  python run_clinician.py note  --grant <id> --clinician dr_lee
  python run_clinician.py list  --patient demo
  python run_clinician.py revoke --grant <id> --actor demo
"""

from __future__ import annotations

import argparse
import sys

from src.agents.clinician_agents import NoteDraftAgent, VisitBriefAgent, build_packet_snapshot
from src.memory.consent import ConsentStore
from src.memory.deep_memory import DeepMemory


def main() -> None:
    p = argparse.ArgumentParser(description="Cadence clinician tools")
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("grant", help="Patient creates a consent grant")
    g.add_argument("--patient", required=True)
    g.add_argument("--clinician", required=True)
    g.add_argument("--hours", type=int, default=72)
    g.add_argument(
        "--scopes",
        default="profile,timeline,visit_brief,note_source",
        help="Comma-separated scopes",
    )
    g.add_argument("--purpose", default="upcoming visit")

    b = sub.add_parser("brief", help="Build visit brief")
    b.add_argument("--grant", required=True)
    b.add_argument("--clinician", required=True)

    n = sub.add_parser("note", help="Draft progress note")
    n.add_argument("--grant", required=True)
    n.add_argument("--clinician", required=True)
    n.add_argument("--bullet", action="append", default=[], help="Clinician plan bullet (repeatable)")

    ls = sub.add_parser("list", help="List grants for patient")
    ls.add_argument("--patient", required=True)

    rv = sub.add_parser("revoke", help="Revoke a grant")
    rv.add_argument("--grant", required=True)
    rv.add_argument("--actor", required=True)

    args = p.parse_args()
    memory = DeepMemory()
    consent = ConsentStore(db_path=str(memory.db_path))

    if args.cmd == "grant":
        scopes = {s.strip() for s in args.scopes.split(",") if s.strip()}
        snap = build_packet_snapshot(memory, args.patient)
        gid = consent.create_grant(
            patient_id=args.patient,
            clinician_id=args.clinician,
            scopes=scopes,
            purpose=args.purpose,
            hours_valid=args.hours,
            packet_snapshot=snap,
        )
        print(f"grant_id={gid}")
        print(f"scopes={sorted(scopes)}")
        print(f"expires_in_hours={args.hours}")
        print(f"snapshot_events={len(snap.get('timeline', []))}")

    elif args.cmd == "brief":
        agent = VisitBriefAgent(memory, consent)
        out = agent.build(args.grant, args.clinician)
        if out.get("error"):
            print(out, file=sys.stderr)
            sys.exit(1)
        print(out["markdown"])

    elif args.cmd == "note":
        agent = NoteDraftAgent(memory, consent)
        out = agent.draft(args.grant, args.clinician, clinician_bullets=args.bullet)
        if out.get("error"):
            print(out, file=sys.stderr)
            sys.exit(1)
        print(out["markdown"])

    elif args.cmd == "list":
        for row in consent.list_grants(args.patient):
            print(
                f"{row['grant_id'][:8]}…  {row['status']:8}  "
                f"clinician={row['clinician_id']}  scopes={row['scopes']}  "
                f"exp={row['expires_at'][:19]}"
            )

    elif args.cmd == "revoke":
        ok = consent.revoke(args.grant, args.actor)
        print("revoked" if ok else "not_found")

    consent.close()
    memory.close()


if __name__ == "__main__":
    main()
