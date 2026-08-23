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
