create table if not exists tenants (
    id text primary key,
    slug text not null unique,
    name text not null,
    timezone text not null,
    brand_color text not null,
    enabled_channels jsonb not null default '[]'::jsonb,
    credential_refs jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists locations (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    slug text not null,
    name text not null,
    waiting_room_name text not null,
    created_at timestamptz not null default now()
);

create table if not exists staff_users (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    location_id text not null references locations(id) on delete cascade,
    name text not null,
    role text not null,
    email text not null,
    created_at timestamptz not null default now()
);

create table if not exists patients (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    display_name text not null,
    phone text not null,
    email text,
    preferred_channel text not null,
    created_at timestamptz not null default now()
);

create table if not exists patient_cases (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_id text not null references patients(id) on delete cascade,
    status text not null,
    status_source text not null,
    opened_at timestamptz not null,
    latest_activity_at timestamptz not null,
    closed_at timestamptz,
    last_inbound_at timestamptz,
    last_outbound_at timestamptz,
    summary jsonb not null default '{}'::jsonb
);

create table if not exists patient_case_links (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    entity_type text not null,
    entity_id text not null,
    relationship text not null,
    created_at timestamptz not null default now()
);

create table if not exists patient_case_timeline_events (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    type text not null,
    title text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists patient_case_actions (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    action text not null,
    title text not null,
    status text not null,
    channel text not null,
    rationale text not null,
    requires_human_approval boolean not null default false,
    source text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);

create table if not exists patient_case_approvals (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    type text not null,
    status text not null,
    reason text not null,
    requested_by text not null,
    resolved_by text,
    resolution_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    resolved_at timestamptz
);

create table if not exists callbacks (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    patient_id text not null references patients(id) on delete cascade,
    channel text not null,
    notes text not null,
    status text not null,
    created_at timestamptz not null default now()
);

create table if not exists appointments (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    location_id text not null references locations(id) on delete cascade,
    patient_id text not null references patients(id) on delete cascade,
    provider_name text not null,
    service_line text not null,
    status text not null,
    scheduled_start timestamptz not null,
    scheduled_end timestamptz not null,
    created_at timestamptz not null default now()
);

create table if not exists flow_events (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    appointment_id text references appointments(id) on delete set null,
    type text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists queue_tickets (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    location_id text not null references locations(id) on delete cascade,
    appointment_id text references appointments(id) on delete set null,
    patient_label text not null,
    ticket_number text not null,
    status text not null,
    created_at timestamptz not null default now()
);

create table if not exists conversation_threads (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    appointment_id text references appointments(id) on delete set null,
    channel text not null,
    status text not null,
    messages jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists agent_tasks (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    appointment_id text references appointments(id) on delete set null,
    type text not null,
    status text not null,
    recommendation jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists prepared_actions (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    version integer not null,
    status text not null,
    recommendation_action text not null,
    type text not null,
    title text not null,
    payload_draft jsonb not null default '{}'::jsonb,
    message_draft text,
    destination_system text not null,
    preconditions jsonb not null default '[]'::jsonb,
    requires_human_approval boolean not null default false,
    fingerprint text not null,
    basis_latest_activity_at timestamptz not null,
    execution_count integer not null default 0,
    stale_reason text,
    generated_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    executed_at timestamptz
);

create table if not exists prepared_action_dispatch_jobs (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    prepared_action_id text not null references prepared_actions(id) on delete cascade,
    trigger text not null,
    status text not null,
    actor_id text not null,
    attempt integer not null,
    message_override text,
    last_error text,
    execution jsonb,
    requested_at timestamptz not null default now(),
    available_at timestamptz not null default now(),
    lease_owner text,
    lease_expires_at timestamptz,
    started_at timestamptz,
    finished_at timestamptz
);

create table if not exists copilot_execution_receipts (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    prepared_action_id text not null references prepared_actions(id) on delete cascade,
    dispatch_job_id text not null references prepared_action_dispatch_jobs(id) on delete cascade,
    attempt integer not null,
    actor_id text not null,
    recommended_action text not null,
    destination_system text not null,
    adapter_key text not null,
    deduped boolean not null default false,
    provider_status text not null default 'pending',
    provider_confirmed_at timestamptz,
    last_provider_event_at timestamptz,
    last_provider_error text,
    receipt jsonb not null default '{}'::jsonb,
    recorded_at timestamptz not null default now()
);

create table if not exists copilot_execution_receipt_events (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    prepared_action_id text not null references prepared_actions(id) on delete cascade,
    dispatch_job_id text not null references prepared_action_dispatch_jobs(id) on delete cascade,
    receipt_record_id text not null references copilot_execution_receipts(id) on delete cascade,
    system text not null,
    event_type text not null,
    provider_status text not null,
    idempotency_key text not null,
    external_ref text,
    payload jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now(),
    recorded_at timestamptz not null default now()
);

alter table copilot_execution_receipts
    add column if not exists provider_status text not null default 'pending';

alter table copilot_execution_receipts
    add column if not exists provider_confirmed_at timestamptz;

alter table copilot_execution_receipts
    add column if not exists last_provider_event_at timestamptz;

alter table copilot_execution_receipts
    add column if not exists last_provider_error text;

alter table prepared_action_dispatch_jobs
    add column if not exists available_at timestamptz not null default now();

alter table prepared_action_dispatch_jobs
    add column if not exists lease_owner text;

alter table prepared_action_dispatch_jobs
    add column if not exists lease_expires_at timestamptz;

create table if not exists copilot_review_decisions (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    patient_case_id text not null references patient_cases(id) on delete cascade,
    recommendation_action text not null,
    decision text not null,
    actor text not null,
    timestamp timestamptz not null default now(),
    note text,
    prepared_action_id text
);

create table if not exists playbooks (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    name text not null,
    trigger_key text not null,
    is_enabled boolean not null default true,
    config jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists audit_entries (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    actor_type text not null,
    actor_id text not null,
    action text not null,
    entity_type text not null,
    entity_id text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
