// API kelas: membuat, bergabung, dan mengelola anggota.
import { getSupabase } from '../supabaseClient.js';

export const listClasses = () => getSupabase()
  .from('classes')
  .select('*')
  .order('created_at');

export const createClass = (name) => getSupabase().rpc('create_class', {
  p_name: name,
});

export const joinClass = (code) => getSupabase().rpc('join_class', {
  p_room_code: code,
});

export const listMembers = (classId) => getSupabase().rpc('class_member_list', {
  p_class_id: classId,
});

export const getClassRole = (classId) => getSupabase().rpc('my_class_role', {
  p_class_id: classId,
});

export const setMemberRole = (classId, userId, role) => getSupabase().rpc(
  'set_member_role',
  { p_class_id: classId, p_user_id: userId, p_role: role },
);

export const leaveClass = (classId) => getSupabase().rpc('leave_class', {
  p_class_id: classId,
});
