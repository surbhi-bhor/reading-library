-- Book recommendations from visitors. Run once in the Supabase SQL editor.
--
-- The site writes here with the public anon key; the nightly extract reads
-- here with the service-role key (a GitHub secret). Visitors can only add a
-- row: they cannot read, change or delete anything. There is no approval
-- step: a book shows on the site once it checks out as a real Open Library
-- work, with the visitor's name and note (dropped if they contain a link).
-- Deleting a row takes it off the site on the next nightly run. The
-- approved column is left over from an earlier design and is unused.

create table if not exists public.recommendations (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    title text not null check (char_length(title) between 1 and 300),
    author text check (char_length(author) <= 200),
    -- Open Library work key (/works/OL...W) and cover id, from the search on the site.
    ol_key text check (ol_key ~ '^/works/OL[0-9]+W$'),
    cover_id integer check (cover_id > 0),
    recommended_by text check (char_length(recommended_by) <= 60),
    note text check (char_length(note) <= 500),
    approved boolean not null default false
);

alter table public.recommendations enable row level security;

-- Anyone may recommend, but never pre-approve their own row.
drop policy if exists "visitors can recommend" on public.recommendations;
create policy "visitors can recommend" on public.recommendations
    for insert to anon
    with check (approved = false);

-- No select, update or delete policy for anon: rows are write-only from the site.
grant insert on public.recommendations to anon;
revoke select, update, delete on public.recommendations from anon;
