// API khusus developer global dan konsol developer (developer.html).
import { getSupabase } from '../supabaseClient.js';

export const isDeveloper = () => getSupabase().rpc('is_developer');

export const listDeveloperClasses = () => getSupabase().rpc(
  'dev_class_overview',
);

export const listDeveloperUsers = () => getSupabase().rpc('dev_user_overview');

export const devBanUser = (userId, reason = null, hours = null) => getSupabase().rpc(
  'dev_ban_user',
  { p_user_id: userId, p_reason: reason, p_hours: hours },
);

export const devUnbanUser = (userId) => getSupabase().rpc('dev_unban_user', {
  p_user_id: userId,
});

export const devRemoveMember = (classId, userId, reason = null) => getSupabase().rpc(
  'dev_remove_member',
  { p_class_id: classId, p_user_id: userId, p_reason: reason },
);

export const devDeleteUser = (userId) => getSupabase().rpc('dev_delete_user', {
  p_user_id: userId,
});
