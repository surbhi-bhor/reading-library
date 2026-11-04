"""The two public values the "Recommend a book" form needs: the Supabase
project URL and its anon key (built to be public; the table only accepts
inserts). Read from the build environment so they live in one place. The
service-role key is never read here. Without them the form is hidden."""
import json
import os
import sys

url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY")
sys.stdout.write(json.dumps({"url": url, "anon_key": key} if url and key else {}))
