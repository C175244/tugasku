// API tugas; status pribadi berada di modul api/progress.js.
import { getSupabase } from '../supabaseClient.js';

export const listTasks = (classId) => getSupabase()
  .from('tasks')
  .select('*')
  .eq('class_id', classId)
  .order('deadline_at');

export const getTask = (id) => getSupabase()
  .from('tasks')
  .select('*')
  .eq('id', id)
  .single();

export const createTask = (values) => getSupabase()
  .from('tasks')
  .insert(values)
  .select()
  .single();

export const updateTask = (id, values) => getSupabase()
  .from('tasks')
  .update(values)
  .eq('id', id)
  .select()
  .single();

export const deleteTask = (id) => getSupabase()
  .from('tasks')
  .delete()
  .eq('id', id);

export const cleanupTasks = () => getSupabase().rpc(
  'cleanup_expired_tasks',
  { p_days: 90 },
);
