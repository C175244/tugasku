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

// Perpanjang deadline: deadline aktif tetap, setelah habis pindah ke baru.
export const postponeTaskDeadline = (taskId, extensionDeadline, note) => getSupabase()
  .rpc('postpone_task_deadline', {
    p_task_id: taskId,
    p_extension_deadline: extensionDeadline,
    p_note: note,
  });

// Ubah deadline: langsung ganti deadline aktif (untuk koreksi seperti
// tanggal merah, bukan perpanjangan sesi).
export const extendTaskDeadline = (taskId, newDeadline, note) => getSupabase()
  .rpc('extend_task_deadline', {
    p_task_id: taskId,
    p_new_deadline: newDeadline,
    p_note: note,
  });

// Hapus media/tugas yang sudah lewat deadline (admin/owner/dev saja).
export const deleteExpiredTaskMedia = (taskId) => getSupabase()
  .rpc('delete_expired_task_media', { p_task_id: taskId });

export const cleanupTasks = () => getSupabase().rpc(
  'cleanup_expired_tasks',
  { p_days: 90 },
);
