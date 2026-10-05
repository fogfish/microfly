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
