// API aksi permanen untuk kelas dan akun.
import { getSupabase } from '../supabaseClient.js';

const mapClassError = (error) => {
  if (error?.code === '42501') {
    return {
      ...error,
      message: 'Kamu tidak punya izin menghapus kelas ini.',
    };
  }
  return error;
};

const mapAccountError = (error) => {
  if (error?.code === '42501') {
    return {
      ...error,
      message: 'Kamu tidak punya izin menghapus akun ini.',
    };
  }
  return error;
};

export const deleteClass = async (classId) => {
  const result = await getSupabase().rpc('delete_class', {
    p_class_id: classId,
  });
  return {
    ...result,
    error: mapClassError(result.error),
  };
};

export const deleteMyAccount = async () => {
  const result = await getSupabase().rpc('delete_my_account');
  return {
    ...result,
    error: mapAccountError(result.error),
  };
};
