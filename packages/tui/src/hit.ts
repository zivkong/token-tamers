/**
 * Hit-region registry, rebuilt each frame.
 *
 * Pages register clickable rectangles with an opaque id during render; a click
 * at (x, y) is resolved to the topmost matching region (last registered wins,
 * so later-drawn regions sit "on top").
 */

export interface HitRegion {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class HitRegistry {
  private regions: HitRegion[] = [];

  /** Drop all regions; call at the start of each frame's render. */
  reset(): void {
    this.regions = [];
  }

  /** Register a clickable rectangle (cell coords, 0-based, width/height in cells). */
  add(id: string, x: number, y: number, w: number, h: number): void {
    this.regions.push({ id, x, y, w, h });
  }

  /** Resolve a click at (x, y) to a region id, or null. Topmost wins. */
  hit(x: number, y: number): string | null {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (!r) continue;
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        return r.id;
      }
    }
    return null;
  }

  /** All registered regions (debug/tests). */
  list(): readonly HitRegion[] {
    return this.regions;
  }
}
