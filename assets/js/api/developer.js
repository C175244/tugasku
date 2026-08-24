// API khusus developer global.
import { getSupabase } from '../supabaseClient.js';

export const isDeveloper = () => getSupabase().rpc('is_developer');

export const listDeveloperClasses = () => getSupabase().rpc(
  'dev_class_overview',
);
