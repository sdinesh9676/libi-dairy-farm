
import { createClient } from "@supabase/supabase-js";

console.log("Supabase client file loaded");

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("Supabase URL exists:", Boolean(supabaseUrl));
console.log("Supabase key exists:", Boolean(supabaseKey));

export const supabase = createClient(supabaseUrl, supabaseKey);
