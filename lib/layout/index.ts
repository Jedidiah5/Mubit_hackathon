import type { LayoutItem, Room, Spec } from "../types";
import { layoutBanquet } from "./banquet";
import { layoutCabaret } from "./cabaret";
import { layoutReception } from "./reception";
import { layoutTheatre } from "./theatre";

export {
  layoutBanquet,
  layoutCabaret,
  layoutReception,
  layoutTheatre,
};
export * from "./shared";

/** Spec + room → placed furniture and guests (metres, origin at centre, north = −z). */
export function layout(room: Room, spec: Spec): LayoutItem[] {
  switch (spec.style) {
    case "banquet":
      return layoutBanquet(room, spec);
    case "theatre":
      return layoutTheatre(room, spec);
    case "cabaret":
      return layoutCabaret(room, spec);
    case "reception":
      return layoutReception(room, spec);
    default: {
      const _exhaustive: never = spec.style;
      return _exhaustive;
    }
  }
}
