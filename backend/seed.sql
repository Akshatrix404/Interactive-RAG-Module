-- =============================================================================
-- Iris AI — Test Data Seed
--
-- Run AFTER the backend has started once (init_db creates all tables).
--
-- Usage:
--   psql -U postgres -d helpdesk_db -f seed.sql
--
-- 10 users · all passwords: Test@1234
-- akshatkhandelwalunofficial@gmail.com → ADMIN
-- ak.professional47@gmail.com          → normal user
-- =============================================================================


-- ── Wipe existing test data (safe re-run) ────────────────────────────────────
TRUNCATE return_requests    RESTART IDENTITY CASCADE;
TRUNCATE return_sessions    RESTART IDENTITY CASCADE;
TRUNCATE browsing_history   RESTART IDENTITY CASCADE;
TRUNCATE orders             RESTART IDENTITY CASCADE;
TRUNCATE payment_profiles   RESTART IDENTITY CASCADE;
TRUNCATE addresses          RESTART IDENTITY CASCADE;
TRUNCATE customers          RESTART IDENTITY CASCADE;
DELETE FROM chat_messages;
DELETE FROM chat_sessions;
DELETE FROM users;
DELETE FROM admins;


-- ── 1. Admins ─────────────────────────────────────────────────────────────────
INSERT INTO admins (email) VALUES
    ('akshatkhandelwalunofficial@gmail.com')
ON CONFLICT (email) DO NOTHING;


-- ── 2. Users  (bcrypt hash of "Test@1234") ────────────────────────────────────
INSERT INTO users (id, email, username, full_name, hashed_password, is_active, is_admin) VALUES
(gen_random_uuid(), 'akshatkhandelwalunofficial@gmail.com', 'akshat_admin',  'Akshat Khandelwal',   '$2b$12$lMAKnEbE8rab0Z/U30S8oOlN1LivVCD9YpabvczNO0eLk/NJf4Of2', TRUE, TRUE),
(gen_random_uuid(), 'ak.professional47@gmail.com',          'akshat_pro',    'Akshat Professional', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfO5cSQ4yEGGzVdOy', TRUE, FALSE),
(gen_random_uuid(), 'priya.sharma@gmail.com',               'priya_sharma',  'Priya Sharma',        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfO5cSQ4yEGGzVdOy', TRUE, FALSE),
(gen_random_uuid(), 'rahul.verma@gmail.com',                'rahul_verma',   'Rahul Verma',         '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfO5cSQ4yEGGzVdOy', TRUE, FALSE),
(gen_random_uuid(), 'neha.gupta@gmail.com',                 'neha_gupta',    'Neha Gupta',          '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfO5cSQ4yEGGzVdOy', TRUE, FALSE),
(gen_random_uuid(), 'arjun.mehta@gmail.com',                'arjun_mehta',   'Arjun Mehta',         '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfO5cSQ4yEGGzVdOy', TRUE, FALSE),
(gen_random_uuid(), 'kavya.nair@gmail.com',                 'kavya_nair',    'Kavya Nair',          '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfO5cSQ4yEGGzVdOy', TRUE, FALSE),
(gen_random_uuid(), 'rohit.singh@gmail.com',                'rohit_singh',   'Rohit Singh',         '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfO5cSQ4yEGGzVdOy', TRUE, FALSE),
(gen_random_uuid(), 'ananya.patel@gmail.com',               'ananya_patel',  'Ananya Patel',        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfO5cSQ4yEGGzVdOy', TRUE, FALSE),
(gen_random_uuid(), 'vikram.rao@gmail.com',                 'vikram_rao',    'Vikram Rao',          '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfO5cSQ4yEGGzVdOy', TRUE, FALSE);


-- ── 3. Customers ──────────────────────────────────────────────────────────────
INSERT INTO customers (username, first_name, last_name, primary_email, alt_email, primary_phone, is_admin) VALUES
('akshat_admin',  'Akshat',  'Khandelwal',   'akshatkhandelwalunofficial@gmail.com', 'akshat.work@gmail.com', '+91-9876543210', TRUE),
('akshat_pro',    'Akshat',  'Professional', 'ak.professional47@gmail.com',          'akshat.alt@gmail.com',  '+91-9876543211', FALSE),
('priya_sharma',  'Priya',   'Sharma',       'priya.sharma@gmail.com',               NULL,                    '+91-9823456780', FALSE),
('rahul_verma',   'Rahul',   'Verma',        'rahul.verma@gmail.com',                NULL,                    '+91-9812345670', FALSE),
('neha_gupta',    'Neha',    'Gupta',        'neha.gupta@gmail.com',                 NULL,                    '+91-9801234560', FALSE),
('arjun_mehta',   'Arjun',   'Mehta',        'arjun.mehta@gmail.com',                NULL,                    '+91-9790123450', FALSE),
('kavya_nair',    'Kavya',   'Nair',         'kavya.nair@gmail.com',                 NULL,                    '+91-9779012340', FALSE),
('rohit_singh',   'Rohit',   'Singh',        'rohit.singh@gmail.com',                NULL,                    '+91-9768901230', FALSE),
('ananya_patel',  'Ananya',  'Patel',        'ananya.patel@gmail.com',               NULL,                    '+91-9757890120', FALSE),
('vikram_rao',    'Vikram',  'Rao',          'vikram.rao@gmail.com',                 NULL,                    '+91-9746789010', FALSE);


-- ── 4. Addresses ──────────────────────────────────────────────────────────────
INSERT INTO addresses (customer_id, address_type, street, city, region, postal_code, country, is_default, delivery_instructions) VALUES
(1,  'both',     '12 MG Road, Bani Park',         'Jaipur',    'Rajasthan',   '302016', 'India', TRUE, 'Ring bell twice'),
(2,  'shipping', '45 Civil Lines',                 'Jaipur',    'Rajasthan',   '302006', 'India', TRUE, 'Leave at gate'),
(3,  'shipping', '78 Lajpat Nagar, Block C',       'New Delhi', 'Delhi',       '110024', 'India', TRUE, NULL),
(4,  'shipping', '23 Koregaon Park',               'Pune',      'Maharashtra', '411001', 'India', TRUE, 'Call before delivery'),
(5,  'both',     '56 Indiranagar, 100 Feet Road',  'Bengaluru', 'Karnataka',   '560038', 'India', TRUE, NULL),
(6,  'shipping', '9 Andheri West, Lokhandwala',    'Mumbai',    'Maharashtra', '400053', 'India', TRUE, 'Weekday delivery only'),
(7,  'shipping', '34 Viman Nagar',                 'Pune',      'Maharashtra', '411014', 'India', TRUE, NULL),
(8,  'both',     '67 Salt Lake, Sector V',         'Kolkata',   'West Bengal', '700091', 'India', TRUE, 'Hand to security'),
(9,  'shipping', '11 Navrangpura',                 'Ahmedabad', 'Gujarat',     '380009', 'India', TRUE, NULL),
(10, 'shipping', '88 Jubilee Hills, Road No. 36',  'Hyderabad', 'Telangana',   '500033', 'India', TRUE, NULL);


-- ── 5. Payment Profiles ───────────────────────────────────────────────────────
INSERT INTO payment_profiles (customer_id, payment_type, card_brand, last_four, upi_id, gift_card_balance, promo_credits, is_default) VALUES
(1,  'credit_card', 'HDFC Visa',        '4242', 'akshat@upi',    500.00, 250.00, TRUE),
(2,  'upi',          NULL,               NULL,   'akpro47@upi',   200.00, 100.00, TRUE),
(3,  'credit_card', 'ICICI Mastercard', '8765', 'priya@upi',       0.00, 150.00, TRUE),
(4,  'cod',          NULL,               NULL,   NULL,              0.00,   0.00, TRUE),
(5,  'credit_card', 'SBI Visa',         '3311', 'neha@upi',      300.00,  75.00, TRUE),
(6,  'upi',          NULL,               NULL,   'arjun@upi',       0.00, 200.00, TRUE),
(7,  'credit_card', 'Axis Bank',        '9900', 'kavya@upi',     100.00,  50.00, TRUE),
(8,  'cod',          NULL,               NULL,   NULL,              0.00,   0.00, TRUE),
(9,  'upi',          NULL,               NULL,   'ananya@upi',    150.00, 125.00, TRUE),
(10, 'credit_card', 'Kotak Visa',       '5567', 'vikram@upi',      0.00, 300.00, TRUE);


-- ── 6. Orders ─────────────────────────────────────────────────────────────────
-- ⚠️  Customer 1 (Akshat) has 3 FRESH delivered orders for testing all return flows:
--     • Sony WH-1000XM5   → test Damaged Product / Wrong Item (history MATCH)
--     • boAt Rockerz 255  → test Wrong Item (history NO MATCH — he searched for it)
--     • Belkin Charger     → test Changed Mind / Defective
INSERT INTO orders (customer_id, status, total_amount, currency, ordered_at, delivered_at, product_name, category, return_reason) VALUES

-- ── Akshat (customer 1) — TESTABLE delivered orders ──────────────────────────
(1,  'delivered', 4999.00,  'INR', NOW()-INTERVAL '8 days',  NOW()-INTERVAL '5 days',  'Sony WH-1000XM5 Headphones',  'electronics', NULL),
(1,  'delivered', 1299.00,  'INR', NOW()-INTERVAL '7 days',  NOW()-INTERVAL '4 days',  'boAt Rockerz 255 Earphones',  'electronics', NULL),
(1,  'delivered', 2499.00,  'INR', NOW()-INTERVAL '2 days',  NOW()-INTERVAL '1 day',   'Belkin Wireless Charger',     'accessories', NULL),
(1,  'shipped',   1299.00,  'INR', NOW()-INTERVAL '2 days',  NULL,                     'JBL Tune 510BT',              'electronics', NULL),
(1,  'returned',   899.00,  'INR', NOW()-INTERVAL '40 days', NOW()-INTERVAL '35 days', 'Anker USB-C Cable 2m',        'accessories', 'Product stopped working after 2 days'),

-- ── Other users ───────────────────────────────────────────────────────────────
(2,  'delivered',12999.00,  'INR', NOW()-INTERVAL '20 days', NOW()-INTERVAL '15 days', 'Samsung Galaxy Buds2 Pro',     'electronics', NULL),
(2,  'pending',   3499.00,  'INR', NOW()-INTERVAL '1 day',   NULL,                     'Logitech MX Keys Mini',        'electronics', NULL),
(2,  'delivered',  599.00,  'INR', NOW()-INTERVAL '8 days',  NOW()-INTERVAL '5 days',  'Nykaa Moisturiser SPF50',      'beauty',      NULL),
(3,  'delivered', 2499.00,  'INR', NOW()-INTERVAL '12 days', NOW()-INTERVAL '8 days',  'Lakme 9to5 Foundation',        'beauty',      NULL),
(3,  'cancelled',  799.00,  'INR', NOW()-INTERVAL '5 days',  NULL,                     'Maybelline Lipstick Set',      'beauty',      NULL),
(4,  'delivered', 8999.00,  'INR', NOW()-INTERVAL '25 days', NOW()-INTERVAL '20 days', 'Redmi Note 13 Pro Back Cover', 'accessories', NULL),
(4,  'shipped',   1599.00,  'INR', NOW()-INTERVAL '2 days',  NULL,                     'Zebronics Gaming Mouse',       'electronics', NULL),
(5,  'delivered', 5499.00,  'INR', NOW()-INTERVAL '7 days',  NOW()-INTERVAL '4 days',  'Philips Air Fryer HD9200',     'appliances',  NULL),
(5,  'returned',  1999.00,  'INR', NOW()-INTERVAL '45 days', NOW()-INTERVAL '40 days', 'Prestige Induction Cooktop',   'appliances',  'Received wrong model'),
(6,  'delivered', 3299.00,  'INR', NOW()-INTERVAL '9 days',  NOW()-INTERVAL '6 days',  'Noise ColorFit Ultra 3 Watch', 'electronics', NULL),
(7,  'pending',  14999.00,  'INR', NOW()-INTERVAL '1 day',   NULL,                     'JBL Flip 6 Bluetooth Speaker', 'electronics', NULL),
(8,  'delivered',  699.00,  'INR', NOW()-INTERVAL '18 days', NOW()-INTERVAL '14 days', 'Classmate Notebook Set',       'stationery',  NULL),
(8,  'delivered', 2199.00,  'INR', NOW()-INTERVAL '30 days', NOW()-INTERVAL '26 days', 'Puma Running Shoes Size 9',    'footwear',    NULL),
(9,  'shipped',   7499.00,  'INR', NOW()-INTERVAL '4 days',  NULL,                     'Titan Raga Watch Gold',        'fashion',     NULL),
(10, 'delivered',21999.00,  'INR', NOW()-INTERVAL '22 days', NOW()-INTERVAL '17 days', 'Apple AirPods 4',              'electronics', NULL);


-- ── 7. Browsing History ───────────────────────────────────────────────────────
-- ⚠️  Akshat's history is carefully crafted for Wrong Item testing:
--
--  Sony WH-1000XM5:
--    • He searched "Sony WH-1000XM4" (different model) before ordering XM5
--      → If he says "I wanted XM4", history MATCHES → legit wrong item ✅
--    • He also searched "Sony WH-1000XM5" itself
--      → If he says "I wanted XM5", that's what he ordered → no match ❌
--
--  boAt Rockerz 255:
--    • He searched "boAt Rockerz 255" directly before ordering
--      → Any wrong-item claim → history NO MATCH → comparison table shown ❌
--
--  Belkin Wireless Charger:
--    • He searched "Belkin Wireless Charger" before ordering
--      → Any wrong-item claim → history NO MATCH ❌

INSERT INTO browsing_history (customer_id, product_name, category, viewed_at) VALUES
-- Akshat (customer 1)
(1,  'Sony WH-1000XM4 Headphones',   'electronics', NOW()-INTERVAL '10 days'),  -- searched XM4, got XM5 → legit wrong item
(1,  'Sony WH-1000XM5 Headphones',   'electronics', NOW()-INTERVAL '9 days'),   -- also looked at XM5
(1,  'boAt Rockerz 255 Earphones',   'electronics', NOW()-INTERVAL '8 days'),   -- searched exactly what he ordered
(1,  'Belkin Wireless Charger',      'accessories', NOW()-INTERVAL '7 days'),   -- searched exactly what he ordered
(1,  'JBL Tune 510BT',               'electronics', NOW()-INTERVAL '3 days'),
(1,  'Anker USB-C Cable 2m',         'accessories', NOW()-INTERVAL '42 days'),

-- Other users (unchanged)
(2,  'Samsung Galaxy Buds2 Pro',     'electronics', NOW()-INTERVAL '22 days'),
(2,  'Logitech MX Keys Mini',        'electronics', NOW()-INTERVAL '2 days'),
(2,  'Nykaa Moisturiser SPF50',      'beauty',      NOW()-INTERVAL '9 days'),
(2,  'Logitech MX Master 3 Mouse',   'electronics', NOW()-INTERVAL '14 days'),
(3,  'Lakme 9to5 Foundation',        'beauty',      NOW()-INTERVAL '13 days'),
(3,  'Maybelline Lipstick Set',      'beauty',      NOW()-INTERVAL '6 days'),
(3,  'LOreal Paris Serum',           'beauty',      NOW()-INTERVAL '3 days'),
(4,  'Redmi Note 13 Pro Back Cover', 'accessories', NOW()-INTERVAL '27 days'),
(4,  'Zebronics Gaming Mouse',       'electronics', NOW()-INTERVAL '3 days'),
(4,  'Redmi 13C Tempered Glass',     'accessories', NOW()-INTERVAL '20 days'),
(5,  'Philips Air Fryer HD9200',     'appliances',  NOW()-INTERVAL '8 days'),
(5,  'Prestige Induction Cooktop',   'appliances',  NOW()-INTERVAL '47 days'),
(5,  'Instant Pot Duo 7-in-1',       'appliances',  NOW()-INTERVAL '5 days'),
(6,  'Noise ColorFit Ultra 3 Watch', 'electronics', NOW()-INTERVAL '11 days'),
(6,  'Fire-Boltt Phoenix Pro Watch', 'electronics', NOW()-INTERVAL '7 days'),
(7,  'JBL Flip 6 Bluetooth Speaker', 'electronics', NOW()-INTERVAL '2 days'),
(7,  'Sony SRS-XB33 Speaker',        'electronics', NOW()-INTERVAL '5 days'),
(8,  'Classmate Notebook Set',       'stationery',  NOW()-INTERVAL '19 days'),
(8,  'Puma Running Shoes Size 9',    'footwear',    NOW()-INTERVAL '31 days'),
(8,  'Reebok Training Shoes',        'footwear',    NOW()-INTERVAL '15 days'),
(9,  'Titan Raga Watch Gold',        'fashion',     NOW()-INTERVAL '5 days'),
(9,  'Fastrack Analog Watch',        'fashion',     NOW()-INTERVAL '10 days'),
(10, 'Apple AirPods 4',              'electronics', NOW()-INTERVAL '24 days'),
(10, 'Samsung Galaxy Buds FE',       'electronics', NOW()-INTERVAL '18 days');


-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT table_name, rows FROM (
    SELECT 'users'            AS table_name, COUNT(*) AS rows FROM users            UNION ALL
    SELECT 'customers',                      COUNT(*)          FROM customers        UNION ALL
    SELECT 'addresses',                      COUNT(*)          FROM addresses        UNION ALL
    SELECT 'payment_profiles',               COUNT(*)          FROM payment_profiles UNION ALL
    SELECT 'orders',                         COUNT(*)          FROM orders           UNION ALL
    SELECT 'browsing_history',               COUNT(*)          FROM browsing_history UNION ALL
    SELECT 'admins',                         COUNT(*)          FROM admins
) t ORDER BY table_name;

-- Show all users with role
SELECT
    ROW_NUMBER() OVER (ORDER BY created_at) AS "#",
    email,
    username,
    CASE WHEN is_admin THEN '★ Admin' ELSE 'Normal User' END AS role
FROM users ORDER BY is_admin DESC, created_at;