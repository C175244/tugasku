// API komentar room kelas dan komentar per tugas.
import { getSupabase } from '../supabaseClient.js';

const mapCommentError = (error) => {
  if (error?.code === '42501') {
    return {
      ...error,
      message: 'Kamu tidak punya izin untuk mengubah komentar ini.',
    };
  }
  return error;
};

export const listClassComments = (classId) => getSupabase().rpc(
  'class_comment_list',
  { p_class_id: classId },
);

export const listTaskComments = (taskId) => getSupabase().rpc(
  'task_comment_list',
  { p_task_id: taskId },
);

export const addClassComment = async (classId, userId, body) => {
  const result = await getSupabase()
    .from('class_comments')
    .insert({ class_id: classId, user_id: userId, body })
    .select()
    .single();
  return {
    ...result,
    error: mapCommentError(result.error),
  };
};

export const addTaskComment = async (taskId, classId, userId, body) => {
  const result = await getSupabase()
    .from('task_comments')
    .insert({ task_id: taskId, class_id: classId, user_id: userId, body })
    .select()
    .single();
  return {
    ...result,
    error: mapCommentError(result.error),
  };
};

export const deleteComment = async (table, id) => {
  const result = await getSupabase()
    .from(table)
    .delete()
    .eq('id', id);
  return {
    ...result,
    error: mapCommentError(result.error),
  };
};
