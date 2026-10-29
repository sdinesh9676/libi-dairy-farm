
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase configuration is missing. Check your backend .env file."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Supabase configuration loaded successfully.");

module.exports = { supabase };
