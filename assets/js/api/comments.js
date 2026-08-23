// API komentar room kelas dan komentar per tugas.
import { getSupabase } from '../supabaseClient.js';

export const listClassComments = (classId) => getSupabase()
  .from('class_comments')
  .select('*')
  .eq('class_id', classId)
  .order('created_at', { ascending: false });

export const listTaskComments = (taskId) => getSupabase()
  .from('task_comments')
  .select('*')
  .eq('task_id', taskId)
  .order('created_at');

export const addClassComment = (classId, userId, body) => getSupabase()
  .from('class_comments')
  .insert({ class_id: classId, user_id: userId, body })
  .select()
  .single();

export const addTaskComment = (taskId, classId, userId, body) => getSupabase()
  .from('task_comments')
  .insert({ task_id: taskId, class_id: classId, user_id: userId, body })
  .select()
  .single();

export const deleteComment = (table, id) => getSupabase()
  .from(table)
  .delete()
  .eq('id', id);
