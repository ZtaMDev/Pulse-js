
import { PulseRegistry } from '@pulse-js/core';

interface Snapshot {
  timestamp: number;
  data: Record<string, any>;
}

/**
 * Pulse TimeTravel
 * 
 * Captures snapshots of the Pulse Registry and allows "rewinding" to previous states.
 */
export class TimeTravel {
  private snapshots: Snapshot[] = [];
  private maxSnapshots = 100;

  /**
   * Captures a point-in-time snapshot of all registered sources.
   */
  capture() {
    const data: Record<string, any> = {};
    const units = PulseRegistry.getAllWithMeta();

    units.forEach(({ unit, uid }) => {
      // Only capture sources for time travel (guards are derived)
      if (!(unit as any).state) {
        data[uid] = (unit as any)();
      }
    });

    this.snapshots.push({
      timestamp: Date.now(),
      data
    });

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  /**
   * Reverts the registry state to a specific snapshot index.
   */
  travel(index: number) {
    const snapshot = this.snapshots[index];
    if (!snapshot) return;

    PulseRegistry.getAllWithMeta().forEach(({ unit, uid }) => {
      const value = snapshot.data[uid];
      if (value !== undefined && (unit as any).set) {
        (unit as any).set(value);
      }
    });
  }

  getHistory() {
    return this.snapshots;
  }

  clear() {
    this.snapshots = [];
  }
}
