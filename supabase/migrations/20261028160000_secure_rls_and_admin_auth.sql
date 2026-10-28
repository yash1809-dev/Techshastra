-- ====================================================================
-- TECHSHASTRA SECURITY REMEDIATION — SEC-01 & SEC-02
-- Migration: 20261028160000_secure_rls_and_admin_auth.sql
-- Description:
-- 1. Create secure session verification helper function `is_admin_session()`
--    that validates `x-admin-token` request header against active sessions.
-- 2. Create `is_super_admin_session()` for super admin actions.
-- 3. Create secure RPC functions for login and status check:
--    - `verify_admin_login(p_name, p_mobile, p_dob)`
--    - `is_super_admin_configured()`
--    - `setup_super_admin(p_name, p_mobile, p_dob)`
--    - `get_admin_request_status(p_mobile)`
-- 4. Secure RLS policies on `admin_credentials` and `admin_login_requests`.
-- 5. Restore strict RLS policies on CMS & sensitive data tables:
--    - Public: SELECT on public content, INSERT on contact/applications/registrations
--    - Admin: full manage privileges guarded by `is_admin_session()`
-- ====================================================================

-- 1. Helper function: Validate if incoming request has a valid active admin session token
CREATE OR REPLACE FUNCTION is_admin_session()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
BEGIN
    BEGIN
        v_token := current_setting('request.headers', true)::json->>'x-admin-token';
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;

    IF v_token IS NULL OR v_token = '' THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM admin_sessions s
        JOIN admin_credentials c ON s.admin_credential_id = c.id
        WHERE s.session_token = v_token
          AND s.is_active = TRUE
          AND c.is_blocked = FALSE
          AND s.last_activity > (NOW() - INTERVAL '12 hours')
    );
END;
$$;

-- 2. Helper function: Validate if incoming request is from an active super_admin
CREATE OR REPLACE FUNCTION is_super_admin_session()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
BEGIN
    BEGIN
        v_token := current_setting('request.headers', true)::json->>'x-admin-token';
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;

    IF v_token IS NULL OR v_token = '' THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM admin_sessions s
        JOIN admin_credentials c ON s.admin_credential_id = c.id
        WHERE s.session_token = v_token
          AND s.is_active = TRUE
          AND c.is_blocked = FALSE
          AND c.role = 'super_admin'
          AND s.last_activity > (NOW() - INTERVAL '12 hours')
    );
END;
$$;

-- 3. Secure Admin Login Verification RPC
CREATE OR REPLACE FUNCTION verify_admin_login(
    p_name TEXT,
    p_mobile TEXT,
    p_dob TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_name    TEXT;
    v_clean_mobile  TEXT;
    v_clean_dob     TEXT;
    v_dob_alt       TEXT;
    v_admin         RECORD;
    v_session_token TEXT;
    v_session_id    UUID;
BEGIN
    v_clean_name := LOWER(TRIM(REGEXP_REPLACE(p_name, '\s+', ' ', 'g')));
    v_clean_mobile := REGEXP_REPLACE(p_mobile, '[^0-9]', '', 'g');
    v_clean_dob    := TRIM(REPLACE(p_dob, '/', '-'));

    -- Normalise: browser always sends YYYY-MM-DD; DB may store DD-MM-YYYY.
    -- Build the opposite format so we can match either way.
    IF v_clean_dob ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN
        -- Input is YYYY-MM-DD -> also try DD-MM-YYYY
        v_dob_alt := SUBSTRING(v_clean_dob, 9, 2) || '-'
                  || SUBSTRING(v_clean_dob, 6, 2) || '-'
                  || SUBSTRING(v_clean_dob, 1, 4);
    ELSIF v_clean_dob ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN
        -- Input is DD-MM-YYYY -> also try YYYY-MM-DD
        v_dob_alt := SUBSTRING(v_clean_dob, 7, 4) || '-'
                  || SUBSTRING(v_clean_dob, 4, 2) || '-'
                  || SUBSTRING(v_clean_dob, 1, 2);
    ELSE
        v_dob_alt := v_clean_dob;
    END IF;

    SELECT * INTO v_admin
    FROM admin_credentials
    WHERE LOWER(TRIM(REGEXP_REPLACE(name, '\\s+', ' ', 'g'))) = v_clean_name
      AND (
          REGEXP_REPLACE(mobile, '[^0-9]', '', 'g') = v_clean_mobile
          OR (
              LENGTH(v_clean_mobile) >= 10
              AND RIGHT(REGEXP_REPLACE(mobile, '[^0-9]', '', 'g'), 10) = RIGHT(v_clean_mobile, 10)
          )
      )
      AND (
          TRIM(REPLACE(dob, '/', '-')) = v_clean_dob
          OR TRIM(REPLACE(dob, '/', '-')) = v_dob_alt
      )
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'blocked', FALSE,
            'error', 'Invalid credentials'
        );
    END IF;

    IF v_admin.is_blocked THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'blocked', TRUE,
            'name', v_admin.name,
            'reason', COALESCE(v_admin.block_reason, 'Account blocked by Super Admin')
        );
    END IF;

    -- Generate session token using gen_random_uuid() (no pgcrypto extension needed)
    v_session_token := 'sess_'
        || REPLACE(gen_random_uuid()::TEXT, '-', '')
        || REPLACE(gen_random_uuid()::TEXT, '-', '');

    INSERT INTO admin_sessions (
        admin_credential_id,
        admin_name,
        session_token,
        is_active,
        login_time,
        last_activity
    ) VALUES (
        v_admin.id,
        v_admin.name,
        v_session_token,
        TRUE,
        NOW(),
        NOW()
    ) RETURNING id INTO v_session_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'blocked', FALSE,
        'id', v_admin.id,
        'name', v_admin.name,
        'role', v_admin.role,
        'session_id', v_session_id,
        'session_token', v_session_token
    );
END;
$$;

-- 4. Safe Super Admin Discovery & Setup RPCs
CREATE OR REPLACE FUNCTION is_super_admin_configured()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM admin_credentials
        WHERE role = 'super_admin'
    );
$$;

CREATE OR REPLACE FUNCTION setup_super_admin(
    p_name TEXT,
    p_mobile TEXT,
    p_dob TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM admin_credentials WHERE role = 'super_admin') THEN
        RETURN FALSE;
    END IF;

    INSERT INTO admin_credentials (name, mobile, dob, role, is_blocked)
    VALUES (p_name, p_mobile, p_dob, 'super_admin', FALSE);

    RETURN TRUE;
END;
$$;

-- 5. Safe Request Status Check RPC (No leak of other applicants)
CREATE OR REPLACE FUNCTION get_admin_request_status(p_mobile TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean TEXT;
    v_last10 TEXT;
    v_req RECORD;
    v_cred RECORD;
BEGIN
    v_clean := REGEXP_REPLACE(p_mobile, '[^0-9]', '', 'g');
    v_last10 := RIGHT(v_clean, 10);

    -- 1. Check if already an approved active admin in admin_credentials
    SELECT name, role INTO v_cred
    FROM admin_credentials
    WHERE REGEXP_REPLACE(mobile, '[^0-9]', '', 'g') = v_clean
       OR (LENGTH(v_clean) >= 10 AND RIGHT(REGEXP_REPLACE(mobile, '[^0-9]', '', 'g'), 10) = v_last10)
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'found', TRUE,
            'name', v_cred.name,
            'status', 'approved'
        );
    END IF;

    -- 2. Otherwise check admin_login_requests
    SELECT admin_name, status, requested_at, responded_at
    INTO v_req
    FROM admin_login_requests
    WHERE REGEXP_REPLACE(mobile, '[^0-9]', '', 'g') = v_clean
       OR (LENGTH(v_clean) >= 10 AND RIGHT(REGEXP_REPLACE(mobile, '[^0-9]', '', 'g'), 10) = v_last10)
    ORDER BY requested_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', FALSE);
    END IF;

    RETURN jsonb_build_object(
        'found', TRUE,
        'name', v_req.admin_name,
        'status', v_req.status,
        'requestedAt', v_req.requested_at,
        'respondedAt', v_req.responded_at
    );
END;
$$;

-- 6. SECURE RLS POLICIES FOR ADMIN_CREDENTIALS
ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to admin_credentials" ON admin_credentials;
DROP POLICY IF EXISTS "Admins can view admin credentials" ON admin_credentials;
DROP POLICY IF EXISTS "Admins can manage admin credentials" ON admin_credentials;

CREATE POLICY "Admins can view admin credentials" ON admin_credentials
    FOR SELECT USING (is_admin_session());

CREATE POLICY "Admins can manage admin credentials" ON admin_credentials
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- 7. SECURE RLS POLICIES FOR ADMIN_SESSIONS
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to admin_sessions" ON admin_sessions;
DROP POLICY IF EXISTS "Admins can insert or update sessions" ON admin_sessions;
DROP POLICY IF EXISTS "Admins can view all admin sessions" ON admin_sessions;

CREATE POLICY "Admins can manage sessions" ON admin_sessions
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- 8. SECURE RLS POLICIES FOR ADMIN_LOGIN_REQUESTS
ALTER TABLE admin_login_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to admin_login_requests" ON admin_login_requests;

CREATE POLICY "Public can insert login request" ON admin_login_requests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage login requests" ON admin_login_requests
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- 9. SECURE RLS POLICIES FOR CMS & CONTENT TABLES
-- PROJECTS
DROP POLICY IF EXISTS "Admin manage projects" ON projects;
CREATE POLICY "Admin manage projects" ON projects
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- EVENTS
DROP POLICY IF EXISTS "Admin manage events" ON events;
CREATE POLICY "Admin manage events" ON events
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- BLOG POSTS
DROP POLICY IF EXISTS "Admin manage blogs" ON blog_posts;
CREATE POLICY "Admin manage blogs" ON blog_posts
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- PUBLICATIONS
DROP POLICY IF EXISTS "Admin manage publications" ON publications;
CREATE POLICY "Admin manage publications" ON publications
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- GALLERY
DROP POLICY IF EXISTS "Admin manage gallery" ON gallery_photos;
CREATE POLICY "Admin manage gallery" ON gallery_photos
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- LEARNING RESOURCES
DROP POLICY IF EXISTS "Admin manage resources" ON learning_resources;
CREATE POLICY "Admin manage resources" ON learning_resources
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- FAQS
DROP POLICY IF EXISTS "Admin manage faqs" ON faqs;
CREATE POLICY "Admin manage faqs" ON faqs
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- ACHIEVEMENTS
DROP POLICY IF EXISTS "Admin manage achievements" ON achievements;
CREATE POLICY "Admin manage achievements" ON achievements
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- SOCIAL LINKS
DROP POLICY IF EXISTS "Admin manage social links" ON social_links;
CREATE POLICY "Admin manage social links" ON social_links
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- CERTIFICATES
DROP POLICY IF EXISTS "Admins can manage certificates" ON certificates;
DROP POLICY IF EXISTS "Admins can manage certificate jobs" ON certificate_jobs;
CREATE POLICY "Admins can manage certificates" ON certificates
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());
CREATE POLICY "Admins can manage certificate jobs" ON certificate_jobs
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- PAGE VISIBILITY
DROP POLICY IF EXISTS "Admins can update page visibility" ON page_visibility;
CREATE POLICY "Admins can update page visibility" ON page_visibility
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- CODING PROBLEMS
DROP POLICY IF EXISTS "Admins can manage all problems" ON coding_problems;
CREATE POLICY "Admins can manage all problems" ON coding_problems
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- CONTACT MESSAGES: Public can insert, only admins can view/manage
DROP POLICY IF EXISTS "Admins can manage contact messages" ON contact_messages;
CREATE POLICY "Admins can manage contact messages" ON contact_messages
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- MEMBERSHIP APPLICATIONS: Public can insert, only admins can view/manage
DROP POLICY IF EXISTS "Admins can manage membership applications" ON membership_applications;
CREATE POLICY "Admins can manage membership applications" ON membership_applications
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());

-- EVENT REGISTRATIONS: Public can insert, only admins can view/manage
DROP POLICY IF EXISTS "Admin manage registrations" ON event_registrations;
CREATE POLICY "Admin manage registrations" ON event_registrations
    FOR ALL USING (is_admin_session()) WITH CHECK (is_admin_session());
