/* 
   Query to check column names of a table in Supabase
*/
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dxnxykpwmgbzsdiohgdo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs'
);

async function checkColumns() {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'assinaturas');
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Columns in "assinaturas":', data);
  }
}

checkColumns();
