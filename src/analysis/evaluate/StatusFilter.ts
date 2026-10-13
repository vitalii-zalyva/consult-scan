// Spec: specs/005-reference-ranges/spec.md (RR-3xx, RR-4xx)
import type { ParamId } from "@/protocol/registers";

import { STATUS_HOLD_MS } from "./constants";
import type { Evaluation, Status } from "./types";

/**
 * RR-305: hysteresis in time — keeps showing the previous evaluation until a different
 * status has held for `holdMs`. One instance per live session.
 */
export class StatusFilter {
  private shown = new Map<ParamId, Evaluation>();
  private pending = new Map<ParamId, { status: Status; since: number }>();

  constructor(private readonly holdMs = STATUS_HOLD_MS) {}

  update(evaluations: Partial<Record<ParamId, Evaluation>>, t: number): Partial<Record<ParamId, Evaluation>> {
    const out: Partial<Record<ParamId, Evaluation>> = {};
    for (const [id, ev] of Object.entries(evaluations) as [ParamId, Evaluation][]) {
      const prev = this.shown.get(id);
      if (!prev || prev.status === ev.status) {
        this.pending.delete(id);
        this.shown.set(id, ev);
      } else {
        const p = this.pending.get(id);
        if (!p || p.status !== ev.status) this.pending.set(id, { status: ev.status, since: t });
        else if (t - p.since >= this.holdMs) {
          this.pending.delete(id);
          this.shown.set(id, ev);
        }
      }
      out[id] = this.shown.get(id)!;
    }
    return out;
  }
}
