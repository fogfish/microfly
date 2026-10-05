// Action section: Forward, Turn left, Turn right or Idle, from the motor outputs (browser only).
export const actionSection = {
  id: 'action',
  title: 'Action',
  requires: {},
  render(body, model) {
    body.textContent = model.action ?? 'Waiting for the first tick';
  },
};
