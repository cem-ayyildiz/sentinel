# Sentinel · Roadmap Report

Weekly (Mon 08:00 Istanbul) report that correlates the **FreshSens 2026 roadmap**
against **live ClickUp activity** — where each strategic goal and each team stands vs
the plan.

The 2026 roadmap (5 strategic L1 goals — Autonomous O2 Rescue, Frictionless
Deployment/Lid v2, Zero-Touch Tech Ops, Predictive Quality, Decentralized Scalability —
plus per-team L2 objectives + KPIs) is read from the Miro **"FS - Tech Roadmapping"**
board (`uXjVLxVQ_qI=`, "Frame 1") and stored in the `roadmap` table. It's stable, so the
report reads the stored copy (fast) rather than re-scanning Miro weekly.

**Flow:** Gather ClickUp (who's doing what, by person, 7d) → Load Roadmap → Build Report
Prompt → Claude → Post Report (chunked). Output: goal-by-goal status (🟢🟡🔴),
by-team on-plan/off-plan, gaps & drift, on-track/KPIs.

**Refresh the roadmap** (when the Miro board changes): `infra/refresh-roadmap.py` scans
the board, extracts the goal frames, and upserts the `roadmap` row. Webhook for on-demand
run: `/webhook/sentinel-roadmap`.
