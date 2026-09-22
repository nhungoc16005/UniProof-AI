-- -------------------------------------------------------------------------
-- EDUPOINT — POSTGRESQL / SUPABASE DDL SCHEMA
-- Phiên bản chuẩn hóa theo Feature Specs & API Contract
-- -------------------------------------------------------------------------

-- 0. EXTENSIONS & ENUMS
-- -------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "vector";

create type role as enum ('STUDENT', 'STAFF', 'ADMIN');
create type term_status as enum ('UPCOMING', 'ACTIVE', 'REVIEWING', 'CLOSED');
create type activity_type as enum ('INTERNAL', 'EXTERNAL');
create type document_status as enum ('ACTIVE', 'EXPIRED');
create type rule_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
create type evidence_status as enum (
  'DRAFT', 'PROCESSING', 'VERIFIED', 'PLAUSIBLE',
  'NEEDS_SUPPLEMENT', 'NEEDS_HUMAN_REVIEW', 'INVALID',
  'APPROVED', 'REJECTED', 'APPEALING', 'WITHDRAWN'
);
create type verification_status as enum (
  'VERIFIED', 'PLAUSIBLE', 'SUSPICIOUS', 'INVALID', 'NEEDS_HUMAN_REVIEW'
);
create type anomaly_flag_type as enum (
  'DUPLICATE', 'INCONSISTENT_INFO', 'IMAGE_WEB_MATCH', 'MISSING_INFO', 'OTHER'
);
create type review_decision as enum (
  'APPROVED', 'REJECTED', 'SCORE_ADJUSTED', 'SUPPLEMENT_REQUESTED'
);
create type appeal_status as enum ('PENDING', 'ACCEPTED', 'REJECTED');

-- -------------------------------------------------------------------------
-- 1. CƠ CẤU TRƯỜNG ĐẠI HỌC & NGƯỜI DÙNG (TÀI KHOẢN TRƯỜNG CẤP SẴN)
-- -------------------------------------------------------------------------
create table faculties (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

create table classes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  cohort     text not null, -- vd: "K21"
  faculty_id uuid not null references faculties(id),
  created_at timestamptz not null default now()
);

create table users (
  id             uuid primary key default gen_random_uuid(), -- Map Supabase auth.users.id
  email          text not null unique,
  full_name      text not null,
  role           role not null,
  student_code   text unique,                                -- Cho Sinh viên
  class_id       uuid references classes(id),               -- Dành cho SV
  faculty_id     uuid references faculties(id),             -- Dành cho Cán bộ (STAFF)
  is_first_login boolean not null default true,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 2. KỲ ĐÁNH GIÁ & HOẠT ĐỘNG
-- -------------------------------------------------------------------------
create table terms (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,                         -- "Học kỳ 1 (2026-2027)"
  code                text not null unique,                  -- "2026_1"
  start_date          timestamptz not null,
  end_date            timestamptz not null,
  submission_deadline timestamptz not null,                  -- Hạn chót sinh viên nộp
  review_deadline     timestamptz not null,                  -- Hạn chót cán bộ duyệt
  appeal_deadline     timestamptz not null,                  -- Hạn chót khiếu nại
  status              term_status not null default 'UPCOMING',
  created_at          timestamptz not null default now()
);

create table activities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        activity_type not null,
  organizer   text not null,
  start_date  timestamptz,
  end_date    timestamptz,
  location    text,
  description text,
  created_at  timestamptz not null default now()
);

create table activity_participants (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id),
  student_id  uuid not null references users(id),
  form_role   text,
  source      text,
  created_at  timestamptz not null default now(),
  unique (activity_id, student_id)
);

-- -------------------------------------------------------------------------
-- 3. QUY ĐỊNH RAG, TIÊU CHÍ & BỘ QUY TẮC RULE ENGINE
-- -------------------------------------------------------------------------
create table regulation_documents (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  version         text not null,
  effective_date  timestamptz not null,
  expiry_date     timestamptz,
  file_url        text not null,
  status          document_status not null default 'ACTIVE',
  uploaded_by_id  uuid not null references users(id),
  created_at      timestamptz not null default now()
);

create table regulation_chunks (
  id                     uuid primary key default gen_random_uuid(),
  regulation_document_id uuid not null references regulation_documents(id),
  content                text not null,
  chunk_index            int not null,
  embedding              vector(1536)
);
create index idx_regulation_chunks_doc on regulation_chunks(regulation_document_id);

create table criteria (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,                  -- "3.1", "4.1"
  name                   text not null,
  description            text not null,
  min_score              real not null default 0.0,
  max_score              real not null,                         -- Điểm trần kiểu Float
  category               text,                                  -- "KHUNG_I" -> "KHUNG_V"
  roles_score            jsonb,                                 -- {"ORGANIZER": 4.0, "PARTICIPANT": 2.0}
  regulation_document_id uuid references regulation_documents(id),
  created_at             timestamptz not null default now()
);

create table rules (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  criterion_id uuid not null references criteria(id),
  rule_type    text not null,
  logic_json   jsonb not null,
  status       rule_status not null default 'PUBLISHED',
  version      int not null default 1,
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 4. HỒ SƠ MINH CHỨNG
-- -------------------------------------------------------------------------
create table evidences (
  id                     uuid primary key default gen_random_uuid(),
  student_id             uuid not null references users(id),
  term_id                uuid not null references terms(id),
  activity_id            uuid references activities(id),
  declared_activity_name text,
  declared_role          text,
  evidence_type          text not null,
  status                 evidence_status not null default 'PROCESSING',
  participation_date     timestamptz,
  submitted_at           timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  locked_by_id           uuid references users(id),             -- Soft-lock cho cán bộ
  locked_at              timestamptz,
  version                int not null default 1                 -- Optimistic lock chống ghi đè
);
create index idx_evidences_student_term_status on evidences(student_id, term_id, status);

create table evidence_files (
  id          uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidences(id),
  file_url    text not null,
  file_type   text not null,
  uploaded_at timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 5. AI ENGINE: OCR, XÁC MINH, BẤT THƯỜNG, ĐỀ XUẤT
-- -------------------------------------------------------------------------
create table ocr_results (
  id                      uuid primary key default gen_random_uuid(),
  evidence_file_id        uuid not null references evidence_files(id),
  evidence_id             uuid not null references evidences(id),
  extracted_text          text not null,
  student_name_extracted  text,
  student_code_extracted  text,
  activity_name_extracted text,
  organizer_extracted     text,
  date_extracted          text,
  location_extracted      text,
  certificate_code        text,
  extracted_fields_json   jsonb,
  confidence_score        real,
  reviewed_by_human       boolean not null default false,
  created_at              timestamptz not null default now()
);
create index idx_ocr_results_evidence on ocr_results(evidence_id);

create table verification_results (
  id                             uuid primary key default gen_random_uuid(),
  evidence_id                    uuid not null references evidences(id),
  verification_level             int not null,                          -- 1 đến 5 (L1 - L5)
  status                         verification_status not null,
  activity_exists_verified       boolean not null default false,        -- Câu hỏi 1
  student_participation_verified boolean not null default false,        -- Câu hỏi 2
  source_description             text not null,
  evidence_gap                   jsonb,                                 -- Bằng chứng còn thiếu
  created_at                     timestamptz not null default now()
);
create index idx_verification_results_evidence on verification_results(evidence_id);

create table anomaly_flags (
  id                uuid primary key default gen_random_uuid(),
  evidence_id       uuid not null references evidences(id),
  flag_type         anomaly_flag_type not null,
  description       text not null,
  severity          text not null,
  resolved_by_human boolean not null default false,
  created_at        timestamptz not null default now()
);
create index idx_anomaly_flags_evidence on anomaly_flags(evidence_id);

create table ai_suggestions (
  id               uuid primary key default gen_random_uuid(),
  evidence_id      uuid not null references evidences(id),
  criterion_id     uuid references criteria(id),
  suggested_score  real,                                                -- Điểm số thực kiểu real/float
  suggested_role   text,
  reasoning        text not null,
  confidence_score real,
  created_at       timestamptz not null default now()
);
create index idx_ai_suggestions_evidence on ai_suggestions(evidence_id);

-- -------------------------------------------------------------------------
-- 6. PHÊ DUYỆT (OFFICER), KHIẾU NẠI & ĐIỂM CHÍNH THỨC
-- -------------------------------------------------------------------------
create table reviews (
  id           uuid primary key default gen_random_uuid(),
  evidence_id  uuid not null references evidences(id),
  reviewer_id  uuid not null references users(id),
  decision     review_decision not null,
  criterion_id uuid references criteria(id),
  final_score  real,                                                    -- Điểm chốt kiểu real/float
  reject_basis text,                                                    -- Căn cứ từ chối
  reason       text not null,
  created_at   timestamptz not null default now()
);
create index idx_reviews_evidence on reviews(evidence_id);

create table supplement_requests (
  id            uuid primary key default gen_random_uuid(),
  evidence_id   uuid not null references evidences(id),
  review_id     uuid not null references reviews(id),
  missing_item  text not null,
  deadline      timestamptz,                                            -- Hạn chót bổ sung
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index idx_supplement_requests_evidence on supplement_requests(evidence_id);

create table appeals (
  id              uuid primary key default gen_random_uuid(),
  evidence_id     uuid not null references evidences(id),
  student_id      uuid not null references users(id),
  content         text not null,
  requested_score real,
  status          appeal_status not null default 'PENDING',
  resolver_id     uuid references users(id),                           -- Cán bộ giải quyết
  resolution_note text,                                                 -- Lý do chấp nhận/bác bỏ
  adjusted_score  real,                                                 -- Điểm sau khiếu nại
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

create table conduct_scores (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references users(id),
  term_id        uuid not null references terms(id),
  total_score    real not null,                                         -- Tổng điểm kiểu real/float
  classification text,
  finalized_at   timestamptz not null default now(),
  unique (student_id, term_id)
);

-- -------------------------------------------------------------------------
-- 7. AUDIT LOG & THÔNG BÁO
-- -------------------------------------------------------------------------
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  old_value   jsonb,
  new_value   jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);

create table notifications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id),
  title               text not null,
  content             text not null,
  type                text not null,
  is_read             boolean not null default false,
  related_evidence_id uuid references evidences(id),
  created_at          timestamptz not null default now()
);
create index idx_notifications_user_read on notifications(user_id, is_read);
