// API jadwal pelajaran per kelas.
import { getSupabase } from '../supabaseClient.js';

export const listSchedules = (classId) => getSupabase()
  .from('schedules')
  .select('*')
  .eq('class_id', classId)
  .order('day_of_week')
  .order('start_time');

export const createSchedule = (values) => getSupabase()
  .from('schedules')
  .insert(values)
  .select()
  .single();

export const updateSchedule = (id, values) => getSupabase()
  .from('schedules')
  .update(values)
  .eq('id', id)
  .select()
  .single();

export const deleteSchedule = (id) => getSupabase()
  .from('schedules')
  .delete()
  .eq('id', id);

// Tambah/ubah catatan jadwal (admin/owner/dev) — muncul di Beranda.
export const setScheduleNote = (scheduleId, note) => getSupabase()
  .rpc('set_schedule_note', { p_schedule_id: scheduleId, p_note: note });
