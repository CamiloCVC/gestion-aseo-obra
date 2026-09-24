import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { supabaseUrl, supabaseAnonKey } from "./supabase-config.js";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
