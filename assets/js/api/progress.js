// API status selesai pribadi; RLS hanya membuka baris milik pengguna.
import { getSupabase } from '../supabaseClient.js';

export const listProgress = (classId) => getSupabase()
  .from('task_progress')
  .select('*')
  .eq('class_id', classId);

export const upsertProgress = (taskId, classId, userId, status, note) => (
  getSupabase()
    .from('task_progress')
    .upsert({
      task_id: taskId,
      class_id: classId,
      user_id: userId,
      status,
      note: note || null,
      done_at: status === 'done' ? new Date().toISOString() : null,
    }, { onConflict: 'task_id,user_id' })
);

export const ensureProgress = (taskId, classId, userId) => (
  getSupabase()
    .from('task_progress')
    .upsert({
      task_id: taskId,
      class_id: classId,
      user_id: userId,
      status: 'pending',
    }, { onConflict: 'task_id,user_id', ignoreDuplicates: true })
);
