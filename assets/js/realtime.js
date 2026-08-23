// Berlangganan perubahan tabel kelas dan menyegarkan view aktif.
import { getSupabase } from './supabaseClient.js';
import { ensureProgress } from './api/progress.js';

export const startRealtime = (user, classIds, onRefresh) => {
  const supabase = getSupabase();
  if (!supabase || !classIds.length) return () => {};

  const channels = [
    'tasks',
    'task_comments',
    'class_comments',
    'schedules',
    'task_files',
  ].map((table) => supabase
    .channel(`tugasku-${table}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `class_id=in.(${classIds.join(',')})`,
      },
      async (payload) => {
        if (
          table === 'tasks'
          && payload.eventType === 'INSERT'
          && user?.id
        ) {
          await ensureProgress(
            payload.new.id,
            payload.new.class_id,
            user.id,
          );
        }
        onRefresh?.(table, payload);
      },
    )
    .subscribe());

  return () => channels.forEach((channel) => {
    supabase.removeChannel(channel);
  });
};
