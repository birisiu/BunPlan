-- BunPlan 4.0 - Supabase/Postgres foundation
-- Apply to a Supabase project via SQL editor / migrations.
-- IMPORTANT: no secrets or service_role key belong in the Android APK.
begin;

create table public.stores (
  id text primary key check (id in ('lidl','kaufland')),
  name text not null
);
insert into public.stores(id,name) values ('lidl','Lidl'),('kaufland','Kaufland')
on conflict (id) do nothing;

create table public.store_locations (
 id uuid primary key default gen_random_uuid(),
 store_id text not null references public.stores(id),
 external_code text not null,
 name text not null,
 address text,
 city text,
 created_at timestamptz not null default now(),
 unique(store_id,external_code),
 unique(id,store_id)
);

create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text,
 household_adults smallint not null default 2 check(household_adults between 1 and 12),
 household_children smallint not null default 0 check(household_children between 0 and 12),
 dietary_preferences jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create or replace function public.create_user_profile()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
 insert into public.profiles(user_id,display_name)
 values(new.id, nullif(new.raw_user_meta_data->>'display_name',''))
 on conflict (user_id) do nothing;
 return new;
end $$;
create trigger bunplan_profile_after_signup
after insert on auth.users for each row execute function public.create_user_profile();

create table public.ingredients (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 name text not null,
 base_unit text not null check(base_unit in ('g','ml','buc')),
 created_at timestamptz not null default now()
);

create table public.recipes (
 id uuid primary key default gen_random_uuid(),
 legacy_key text unique,
 title text not null,
 description text,
 category text not null,
 servings smallint not null default 2 check(servings between 1 and 30),
 minutes_to_prepare smallint check(minutes_to_prepare between 0 and 1440),
 instructions jsonb not null default '[]'::jsonb,
 photo_url text,
 published boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.recipe_ingredients (
 recipe_id uuid not null references public.recipes(id) on delete cascade,
 ingredient_id uuid not null references public.ingredients(id),
 amount numeric(12,3) not null check(amount>0),
 unit text not null check(unit in ('g','ml','buc')),
 primary key(recipe_id,ingredient_id)
);

-- Product external IDs must be scoped to the SAME retailer and a store-location context.
-- location_code = 'national' only when the official feed has national coverage.
-- location_code = 'site_default' means the website's selected branch is NOT confirmed.
create table public.products (
 id uuid primary key default gen_random_uuid(),
 store_id text not null references public.stores(id),
 location_code text not null default 'national',
 external_id text not null,
 barcode text,
 name text not null,
 pack_amount numeric(12,3) check(pack_amount>0),
 pack_unit text check(pack_unit in ('g','ml','buc')),
 category text,
 image_url text,
 active boolean not null default true,
 last_seen_at timestamptz not null default now(),
 unique(store_id,location_code,external_id),
 unique(id,store_id)
);
create index on public.products(store_id,location_code);
create index on public.products(name);

create table public.product_ingredient_matches (
 product_id uuid not null references public.products(id) on delete cascade,
 ingredient_id uuid not null references public.ingredients(id),
 matching_method text not null check(matching_method in ('barcode','exact_name','human_reviewed','heuristic')),
 confidence numeric(4,3) not null check(confidence between 0 and 1),
 reviewed boolean not null default false,
 primary key(product_id,ingredient_id)
);

create table public.product_prices (
 id bigserial primary key,
 product_id uuid not null,
 store_id text not null,
 location_code text not null,
 amount_ron numeric(12,2) not null check(amount_ron>0),
 source_kind text not null check(source_kind in
   ('lidl_official_list','kaufland_public_offer','authorized_partner','manual_user')),
 source_url text,
 captured_on date not null,
 captured_at timestamptz not null default now(),
 valid_from date,
 valid_to date,
 membership_required boolean not null default false,
 price_scope text not null check(price_scope in ('national','site_default','branch','delivery')),
 unique(product_id,captured_on,amount_ron,source_kind,membership_required),
 foreign key(product_id,store_id) references public.products(id,store_id),
 check (valid_from is null or valid_to is null or valid_from <= valid_to),
 check (
  (store_id='lidl' and source_kind='lidl_official_list' and price_scope='national')
  or (store_id='kaufland' and source_kind='kaufland_public_offer' and price_scope in ('site_default','branch'))
  or source_kind in ('authorized_partner','manual_user')
 )
);
create index product_prices_latest on public.product_prices(product_id,captured_at desc);

-- Explicitly NOT a retailer-issued price. These are independent budget fallbacks.
create table public.price_estimates (
 store_id text not null references public.stores(id),
 ingredient_id uuid not null references public.ingredients(id),
 suggested_pack_quantity numeric(12,3) not null check(suggested_pack_quantity>0),
 pack_unit text not null check(pack_unit in ('g','ml','buc')),
 estimated_pack_price_ron numeric(12,2) not null check(estimated_pack_price_ron>0),
 estimate_method text not null default 'budget_model',
 updated_at timestamptz not null default now(),
 primary key(store_id,ingredient_id)
);

create table public.weekly_plans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 store_id text not null references public.stores(id),
 week_start date not null check(extract(isodow from week_start)=1),
 weekly_budget_ron numeric(12,2) not null check(weekly_budget_ron>0),
 created_at timestamptz not null default now(),
 unique(user_id,store_id,week_start),
 unique(id,store_id)
);
create index weekly_plans_user on public.weekly_plans(user_id,week_start);

create table public.planned_meals (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.weekly_plans(id) on delete cascade,
 meal_date date not null,
 meal_slot text not null check(meal_slot in ('breakfast','lunch','dinner','snack')),
 recipe_id uuid not null references public.recipes(id),
 portions numeric(5,2) not null check(portions between 0.5 and 50),
 created_at timestamptz not null default now(),
 unique(plan_id,meal_date,meal_slot)
);

create or replace function public.check_meal_week()
returns trigger language plpgsql set search_path = '' as $$
declare ws date;
begin
 select week_start into ws from public.weekly_plans where id=new.plan_id;
 if ws is null or new.meal_date < ws or new.meal_date > ws + 6
 then raise exception 'Meal date is outside weekly plan'; end if;
 return new;
end $$;
create trigger meal_date_guard before insert or update on public.planned_meals
for each row execute function public.check_meal_week();

create table public.shopping_items (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null,
 store_id text not null,
 ingredient_id uuid references public.ingredients(id),
 product_id uuid,
 description text not null,
 requested_quantity numeric(12,3) check(requested_quantity>0),
 requested_unit text check(requested_unit in ('g','ml','buc')),
 pack_count integer check(pack_count>0),
 pack_price_ron numeric(12,2) check(pack_price_ron>=0),
 budget_cost_ron numeric(12,2) check(budget_cost_ron>=0),
 price_status text not null default 'estimated'
    check(price_status in ('confirmed','estimated','user_entered')),
 price_observed_on date,
 purchased boolean not null default false,
 created_at timestamptz not null default now(),
 foreign key(plan_id,store_id) references public.weekly_plans(id,store_id) on delete cascade,
 foreign key(product_id,store_id) references public.products(id,store_id),
 check (ingredient_id is not null or product_id is not null)
);
create index shopping_items_plan on public.shopping_items(plan_id);

-- Server-side verification must eventually write these grants, not the Android app.
create table public.ad_rewards (
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_id uuid not null references public.weekly_plans(id) on delete cascade,
 verified_at timestamptz not null default now(),
 provider text not null default 'admob',
 transaction_id text unique,
 primary key(user_id,plan_id)
);

create table public.import_runs (
 id bigint generated always as identity primary key,
 retailer_id text not null references public.stores(id),
 source_kind text not null,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 status text not null check(status in ('started','succeeded','failed')),
 items_seen integer not null default 0,
 items_written integer not null default 0,
 error_message text
);

-- Explicit privileges + RLS. Anonymous visitors can read only public catalog data.
alter table public.stores enable row level security;
alter table public.store_locations enable row level security;
alter table public.profiles enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.products enable row level security;
alter table public.product_ingredient_matches enable row level security;
alter table public.product_prices enable row level security;
alter table public.price_estimates enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.planned_meals enable row level security;
alter table public.shopping_items enable row level security;
alter table public.ad_rewards enable row level security;
alter table public.import_runs enable row level security;

revoke all on public.stores,public.store_locations,public.profiles,public.ingredients,
  public.recipes,public.recipe_ingredients,public.products,public.product_ingredient_matches,
  public.product_prices,public.price_estimates,public.weekly_plans,public.planned_meals,
  public.shopping_items,public.ad_rewards,public.import_runs
  from anon,authenticated;
grant select on public.stores,public.store_locations,public.ingredients,public.recipes,
  public.recipe_ingredients,public.products,public.product_ingredient_matches,
  public.product_prices,public.price_estimates to anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update,delete on public.weekly_plans,public.planned_meals,public.shopping_items to authenticated;
grant select on public.ad_rewards to authenticated;

create policy stores_read on public.stores for select to anon,authenticated using(true);
create policy locations_read on public.store_locations for select to anon,authenticated using(true);
create policy ingredients_read on public.ingredients for select to anon,authenticated using(true);
create policy recipes_read on public.recipes for select to anon,authenticated using(published);
create policy recipe_ingredients_read on public.recipe_ingredients for select to anon,authenticated
 using(exists(select 1 from public.recipes r where r.id=recipe_id and r.published));
create policy products_read on public.products for select to anon,authenticated using(active);
create policy product_matches_read on public.product_ingredient_matches for select to anon,authenticated using(true);
create policy product_prices_read on public.product_prices for select to anon,authenticated using(true);
create policy estimates_read on public.price_estimates for select to anon,authenticated using(true);

create policy profiles_select on public.profiles for select to authenticated
 using(user_id=(select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated
 with check(user_id=(select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create policy plans_select on public.weekly_plans for select to authenticated
 using(user_id=(select auth.uid()));
create policy plans_insert on public.weekly_plans for insert to authenticated
 with check(user_id=(select auth.uid()));
create policy plans_update on public.weekly_plans for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy plans_delete on public.weekly_plans for delete to authenticated
 using(user_id=(select auth.uid()));

create policy meals_select on public.planned_meals for select to authenticated
 using(exists(select 1 from public.weekly_plans p where p.id=plan_id and p.user_id=(select auth.uid())));
create policy meals_insert on public.planned_meals for insert to authenticated
 with check(exists(select 1 from public.weekly_plans p where p.id=plan_id and p.user_id=(select auth.uid())));
create policy meals_update on public.planned_meals for update to authenticated
 using(exists(select 1 from public.weekly_plans p where p.id=plan_id and p.user_id=(select auth.uid())))
 with check(exists(select 1 from public.weekly_plans p where p.id=plan_id and p.user_id=(select auth.uid())));
create policy meals_delete on public.planned_meals for delete to authenticated
 using(exists(select 1 from public.weekly_plans p where p.id=plan_id and p.user_id=(select auth.uid())));

create policy items_select on public.shopping_items for select to authenticated
 using(exists(select 1 from public.weekly_plans p where p.id=plan_id and p.user_id=(select auth.uid())));
create policy items_insert on public.shopping_items for insert to authenticated
 with check(exists(select 1 from public.weekly_plans p where p.id=plan_id and p.user_id=(select auth.uid()) and p.store_id=shopping_items.store_id));
create policy items_update on public.shopping_items for update to authenticated
 using(exists(select 1 from public.weekly_plans p where p.id=plan_id and p.user_id=(select auth.uid())))
 with check(exists(select 1 from public.weekly_plans p where p.id=plan_id and p.user_id=(select auth.uid()) and p.store_id=shopping_items.store_id));
create policy items_delete on public.shopping_items for delete to authenticated
 using(exists(select 1 from public.weekly_plans p where p.id=plan_id and p.user_id=(select auth.uid())));

create policy rewards_read on public.ad_rewards for select to authenticated
 using(user_id=(select auth.uid()));

commit;
