// State sederhana aplikasi dan langganan perubahan lokal.
const state = {
  user: null,
  profile: null,
  classes: [],
  activeClass: null,
  tasks: [],
  schedules: [],
  progress: new Map(),
  files: [],
  comments: [],
};

const listeners = new Set();

export const store = state;

export const setState = (patch) => {
  Object.assign(state, patch);
  listeners.forEach((listener) => listener(state));
};

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const progressFor = (taskId) => (
  state.progress.get(taskId)?.status || 'pending'
);

export const setProgress = (rows = []) => {
  setState({
    progress: new Map(rows.map((row) => [row.task_id, row])),
  });
};
