// API lampiran: upload ke bucket private dan signed URL.
import { getSupabase } from '../supabaseClient.js';
import { sanitizeFilename } from '../utils/format.js';

const mapFileError = (error) => {
  if (error?.code === '42501') {
    return {
      ...error,
      message: 'Kamu tidak punya izin untuk mengubah lampiran ini.',
    };
  }
  return error;
};

export const listFiles = (taskId) => getSupabase().rpc(
  'task_file_list',
  { p_task_id: taskId },
);

export const uploadFile = async (file, classId, taskId, userId) => {
  const supabase = getSupabase();
  const path = [
    classId,
    taskId,
    `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`,
  ].join('/');
  const uploaded = await supabase.storage
    .from('task-files')
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
  if (uploaded.error) throw mapFileError(uploaded.error);

  const { data, error } = await supabase
    .from('task_files')
    .insert({
      task_id: taskId,
      class_id: classId,
      uploader_id: userId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from('task-files').remove([path]);
    throw mapFileError(error);
  }
  return data;
};

export const signedUrl = (
  path,
  expires = 3600,
  download = null,
) => getSupabase()
  .storage
  .from('task-files')
  .createSignedUrl(
    path,
    expires,
    download ? { download } : undefined,
  );

export const deleteFile = async (file) => {
  const supabase = getSupabase();
  const result = await supabase
    .from('task_files')
    .delete()
    .eq('id', file.id);
  if (!result.error) {
    await supabase.storage.from('task-files').remove([file.storage_path]);
  }
  if (result.error?.code === '42501') {
    return {
      ...result,
      error: {
        ...result.error,
        message: 'Kamu tidak punya izin untuk mengubah lampiran ini.',
      },
    };
  }
  return result;
};
