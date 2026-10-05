// The fly's action label from its two drive values (specs/006-fly-status-panel/data-model.md, Action). Pure.
// The thresholds are named here so the panel does not repeat them.

export const ACTION_IDLE_SUM = 0.1;
export const ACTION_STRAIGHT_DIFF = 0.1;

// left and right are the outputs with drive "left" and "right", each in [0, 1].
export function actionLabel(left, right) {
  if (left + right < ACTION_IDLE_SUM) return 'Idle';
  if (Math.abs(left - right) < ACTION_STRAIGHT_DIFF) return 'Forward';
  return left > right ? 'Turn right' : 'Turn left';
}

// The forager action (ADR 003 W4), from the named drives. A turn difference of ACTION_STRAIGHT_DIFF or more is a turn,
// and a turnLeft drive turns the fly to its left, so it is named first. Otherwise a walk, backward or forward, when the
// drive difference reaches ACTION_IDLE_SUM. Otherwise Idle.
export function forageAction({ turnLeft, turnRight, forward, backward }) {
  const turn = turnLeft - turnRight;
  const walk = forward - backward;
  if (Math.abs(turn) >= ACTION_STRAIGHT_DIFF) return turn > 0 ? 'Turn left' : 'Turn right';
  if (Math.abs(walk) >= ACTION_IDLE_SUM) return walk > 0 ? 'Forward' : 'Backward';
  return 'Idle';
}
