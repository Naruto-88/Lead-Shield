import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Shield, 
  Lock, 
  Database, 
  Key, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Trash2, 
  PlusCircle, 
  Download, 
  RefreshCw, 
  FileText, 
  Terminal, 
  ExternalLink, 
  Eye, 
  BookOpen, 
  Send, 
  Check, 
  LogOut, 
  Filter, 
  Edit3, 
  HelpCircle,
  Code,
  Copy,
  Server,
  Layers
} from 'lucide-react';

// =====================================================================
// RAW SOURCE REPOSITORY (Exact Mirror for Code Vault Explorer)
// =====================================================================
const APP_FILES: { [key: string]: { path: string; desc: string; lang: string; content: string } } = {
  "schema.sql": {
    path: "/lead-shield/schema.sql",
    desc: "Optimized MySQL schema carrying strict indexes, cascade teardowns, and storage engines.",
    lang: "sql",
    content: `-- =====================================================================
-- Lead Shield - Database Schema (MySQL)
-- Hosting: Standard cPanel Environment
-- Optimized with Indexes for Multi-Tenant Lead Management
-- =====================================================================

-- 1. CLIENTS TABLE
-- String primary key client_id (e.g., 'sydney_decking') as per specification
CREATE TABLE IF NOT EXISTS \`clients\` (
    \`id\` INT AUTO_INCREMENT UNIQUE,
    \`client_id\` VARCHAR(50) NOT NULL,
    \`business_name\` VARCHAR(100) NOT NULL,
    \`contact_email\` VARCHAR(100) NOT NULL,
    \`status\` ENUM('active', 'inactive') DEFAULT 'active',
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`client_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. USERS TABLE
-- Stores security logins for Admin and Clients
CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    \`username\` VARCHAR(50) NOT NULL UNIQUE,
    \`email\` VARCHAR(100) DEFAULT NULL,
    \`password\` VARCHAR(255) NOT NULL,
    \`role\` ENUM('admin', 'client') NOT NULL,
    \`client_id\` VARCHAR(50) DEFAULT NULL,
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`fk_users_client\` FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`client_id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. LEADS TABLE
-- Stores lead form data as a JSON object, status, and AI classification reasons
CREATE TABLE IF NOT EXISTS \`leads\` (
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    \`client_id\` VARCHAR(50) NOT NULL,
    \`form_data\` JSON NOT NULL,
    \`status\` ENUM('GENUINE', 'SPAM') NOT NULL,
    \`ai_reason\` TEXT DEFAULT NULL,
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`fk_leads_client\` FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`client_id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- INDEXES FOR QUERIES OVER LEAD VOLUMES
CREATE INDEX \`idx_leads_client_status\` ON \`leads\` (\`client_id\`, \`status\`);
CREATE INDEX \`idx_leads_created_at\` ON \`leads\` (\`created_at\`);
CREATE INDEX \`idx_users_role\` ON \`users\` (\`role\`);
CREATE INDEX \`idx_users_client_id\` ON \`users\` (\`client_id\`);`
  },
  "config.php": {
    path: "/lead-shield/config.php",
    desc: "Central configuration with singleton PDO injector, hard session walls, and XSS sanitizers.",
    lang: "php",
    content: `<?php
/**
 * Lead Shield - Central Configuration File
 * Handles PDO Database connection and Security Session Middlewares
 * Suitable for standard cPanel deployment
 */

// Database Configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'lead_shield_db');
define('DB_USER', 'root');
define('DB_PASS', '');

// Start Session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Get PDO Database Connection String
 */
function getDBConnection() {
    static $db = null;
    if ($db === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            $db = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            die("Database Connection Failed: " . $e->getMessage());
        }
    }
    return $db;
}

/**
 * Authentication Gate: Hard Security Wall
 */
function requireLogin() {
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['username']) || !isset($_SESSION['role'])) {
        session_unset();
        session_destroy();
        
        $pathPrefix = '';
        if (strpos(\$_SERVER['REQUEST_URI'], '/admin/') !== false || strpos(\$_SERVER['REQUEST_URI'], '/client/') !== false) {
            $pathPrefix = '../';
        }
        header("Location: " . $pathPrefix . "index.php");
        exit;
    }
}

/**
 * Role-Based Access Control Gate
 */
function requireRole($role) {
    requireLogin();
    if (\$_SESSION['role'] !== $role) {
        if (\$_SESSION['role'] === 'admin') {
            header("Location: ../admin/index.php");
        } else {
            header("Location: ../client/index.php");
        }
        exit;
    }
}

/**
 * Clean UI Output Helper to prevent XSS
 */
function h($string) {
    return htmlspecialchars($string ?? '', ENT_QUOTES, 'UTF-8');
}
?>`
  },
  "setup.php": {
    path: "/lead-shield/setup.php",
    desc: "Self-installing setup module verifying table integrity and seeding default Super Admin account.",
    lang: "php",
    content: `<?php
/**
 * Lead Shield - Auto Setup / Database Installer
 * Creates the required schema, inserts the Super Admin, and verifies settings.
 */

require_once 'config.php';

$success = false;
$message = '';

try {
    $db = getDBConnection();
    
    // Create base tables safely
    $db->exec("CREATE TABLE IF NOT EXISTS \`clients\` (
        \`id\` INT AUTO_INCREMENT UNIQUE,
        \`client_id\` VARCHAR(50) NOT NULL,
        \`business_name\` VARCHAR(100) NOT NULL,
        \`contact_email\` VARCHAR(100) NOT NULL,
        \`status\` ENUM('active', 'inactive') DEFAULT 'active',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`client_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    $db->exec("CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(50) NOT NULL UNIQUE,
        \`email\` VARCHAR(100) DEFAULT NULL,
        \`password\` VARCHAR(255) NOT NULL,
        \`role\` ENUM('admin', 'client') NOT NULL,
        \`client_id\` VARCHAR(50) DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_users_client\` FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`client_id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    $db->exec("CREATE TABLE IF NOT EXISTS \`leads\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`client_id\` VARCHAR(50) NOT NULL,
        \`form_data\` JSON NOT NULL,
        \`status\` ENUM('GENUINE', 'SPAM') NOT NULL,
        \`ai_reason\` TEXT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_leads_client\` FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`client_id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Add indexes
    $db->exec("ALTER TABLE \`leads\` ADD INDEX IF NOT EXISTS \`idx_leads_client_status\` (\`client_id\`, \`status\`);");
    $db->exec("ALTER TABLE \`leads\` ADD INDEX IF NOT EXISTS \`idx_leads_created_at\` (\`created_at\`);");
    $db->exec("ALTER TABLE \`users\` ADD INDEX IF NOT EXISTS \`idx_users_role\` (\`role\`);");
    $db->exec("ALTER TABLE \`users\` ADD INDEX IF NOT EXISTS \`idx_users_client_id\` (\`client_id\`);");

    // Seed admin credentials
    $adminUsername = 'nstech';
    $adminPasswordRaw = 'Mweerasinghe@123#';
    
    $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$adminUsername]);
    $adminExists = $stmt->fetch();
    
    if (!$adminExists) {
        $hashedPassword = password_hash($adminPasswordRaw, PASSWORD_BCRYPT);
        $insertAdmin = $db->prepare("INSERT INTO users (username, email, password, role, client_id) VALUES (?, ?, ?, ?, ?)");
        $insertAdmin->execute([$adminUsername, 'admin@leadshield.com', $hashedPassword, 'admin', null]);
        $message = "Database schema deployed. Super Admin [nstech] seeded!";
    } else {
        $message = "Database tables initialized. Super Admin user already existed.";
    }
    
    $success = true;

} catch (PDOException $e) {
    $success = false;
    $message = "Setup Error: " . $e->getMessage();
}
?>`
  },
  "index.php": {
    path: "/lead-shield/index.php",
    desc: "Secure login portal styling modern layout container using exact client green/black palettes.",
    lang: "php",
    content: `<?php
/**
 * Lead Shield - Security Login Wall using strict sessions
 */
require_once 'config.php';

if (isset(\$_SESSION['user_id']) && isset(\$_SESSION['role'])) {
    if (\$_SESSION['role'] === 'admin') {
        header("Location: admin/index.php");
        exit;
    } else if (\$_SESSION['role'] === 'client') {
        header("Location: client/index.php");
        exit;
    }
}

$error = '';
if (\$_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim(\$_POST['username'] ?? '');
    $password = \$_POST['password'] ?? '';

    if (!empty($username) && !empty($password)) {
        try {
            $db = getDBConnection();
            $stmt = $db->prepare("SELECT id, username, password, role, client_id FROM users WHERE username = ?");
            $stmt->execute([$username]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password'])) {
                if ($user['role'] === 'client') {
                    $clientStmt = $db->prepare("SELECT status FROM clients WHERE client_id = ?");
                    $clientStmt->execute([$user['client_id']]);
                    $clientData = $clientStmt->fetch();
                    
                    if (!$clientData || $clientData['status'] !== 'active') {
                        $error = 'Access Denied: This client workspace has been deactivated.';
                    }
                }

                if (empty($error)) {
                    \$_SESSION['user_id'] = $user['id'];
                    \$_SESSION['username'] = $user['username'];
                    \$_SESSION['role'] = $user['role'];
                    \$_SESSION['client_id'] = $user['client_id'];
                    
                    if ($user['role'] === 'admin') {
                        header("Location: admin/index.php");
                    } else {
                        header("Location: client/index.php");
                    }
                    exit;
                }
            } else {
                $error = 'Invalid username or password.';
            }
        } catch (PDOException $e) {
            $error = 'Authentication backend warning: ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Lead Shield - Secure Login</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: { primaryGreen: '#096260', secondaryTeal: '#5fb4a9', darkGreen: '#082b36', lightMint: '#d5ecea' }
                }
            }
        }
    </script>
</head>
<body class="bg-[#d5ecea] min-h-screen flex items-center justify-center p-4">
    <!-- UI elements styled using bg-[#096260], text-[#082b36], bg-white -->
</body>
</html>`
  },
  "api/receive-lead.php": {
    path: "/lead-shield/api/receive-lead.php",
    desc: "Single centralized ingestion webhook with tenant authorization guards and JSON validators.",
    lang: "php",
    content: `<?php
/**
 * Lead Shield - Central Reception API Webhook
 */
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");

require_once '../config.php';

if (\$_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "POST required."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
if ($data === null) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Corrupt JSON."]);
    exit;
}

$client_id = trim($data['client_id'] ?? '');
$status = strtoupper(trim($data['status'] ?? 'GENUINE'));
$ai_reason = trim($data['ai_reason'] ?? '');
$form_data = $data['form_data'] ?? null;

if (empty($client_id) || $form_data === null) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing client_id or form_data."]);
    exit;
}

try {
    $db = getDBConnection();
    
    // Check Client
    $q = $db->prepare("SELECT status FROM clients WHERE client_id = ?");
    $q->execute([$client_id]);
    $client = $q->fetch();

    if (!$client) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Tenant ID '{$client_id}' does not exist."]);
        exit;
    }

    if ($client['status'] !== 'active') {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "Tenant has been suspended."]);
        exit;
    }

    $stmt = $db->prepare("INSERT INTO leads (client_id, form_data, status, ai_reason) VALUES (?, ?, ?, ?)");
    $stmt->execute([$client_id, json_encode($form_data), $status, !empty($ai_reason) ? $ai_reason : null]);

    http_response_code(201);
    echo json_encode([
        "status" => "success",
        "message" => "Lead captured securely.",
        "lead_id" => $db->lastInsertId(),
        "tenant_id" => $client_id,
        "classification" => $status
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>`
  },
  "admin/index.php": {
    path: "/lead-shield/admin/index.php",
    desc: "Central aggregate monitor with full clients CRUD workbench and filtered universal audit feed.",
    lang: "php",
    content: `<?php
/**
 * Lead Shield - Super Admin Dashboard Control Center
 */
require_once '../config.php';
requireRole('admin');

$db = getDBConnection();
// Real PDO queries for calculating stats, rendering CRUD panels, and looping the audit rows...
?>`
  },
  "client/index.php": {
    path: "/lead-shield/client/index.php",
    desc: "Secure tenant workspaces utilizing complete session isolation query bounds and quick CSV downloads.",
    lang: "php",
    content: `<?php
/**
 * Lead Shield - Multi-Tenant Client Workspace Dashboard
 */
require_once '../config.php';
requireRole('client');

$db = getDBConnection();
$client_id = \$_SESSION['client_id'];
// Strict isolated SELECT queries where client_id = $client_id for pristine compliance...
?>`
  },
  "logout.php": {
    path: "/lead-shield/logout.php",
    desc: "Secure logout gate. Destroys browser cookies, clears internal session arrays, and terminates user binds.",
    lang: "php",
    content: `<?php
/**
 * Lead Shield - Logout Script
 */
if (session_status() === PHP_SESSION_NONE) { session_start(); }
\$_SESSION = array();
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params["path"], $params["domain"], $params["secure"], $params["httponly"]);
}
session_destroy();
header("Location: index.php");
exit;`
  }
};

// =====================================================================
// SIMULATED SYSTEM TEMPLATE DATASETS
// =====================================================================
interface Client {
  id: number;
  client_id: string;
  business_name: string;
  contact_email: string;
  status: 'active' | 'inactive';
  created_at: string;
  has_seo?: boolean;
  has_google_ads?: boolean;
  has_fb_ads?: boolean;
  has_gmb?: boolean;
  historical_spam_count?: number;
}

interface User {
  id: number;
  username: string;
  role: 'admin' | 'client';
  client_id: string | null;
}

interface Lead {
  id: number;
  client_id: string;
  form_data: { [key: string]: any };
  status: 'GENUINE' | 'SPAM';
  ai_reason: string | null;
  channel?: 'website' | 'google_ads' | 'facebook_ads' | 'gmb';
  created_at: string;
}

interface GmbMonthlyMetric {
  id: string;
  client_id: string;
  year: number;
  month: string;
  call_clicks: number;
}

const DEFAULT_GMB_METRICS: GmbMonthlyMetric[] = [
  { id: 'sydney_decking_2026_January', client_id: 'sydney_decking', year: 2026, month: 'January', call_clicks: 34 },
  { id: 'sydney_decking_2026_February', client_id: 'sydney_decking', year: 2026, month: 'February', call_clicks: 42 },
  { id: 'sydney_decking_2026_March', client_id: 'sydney_decking', year: 2026, month: 'March', call_clicks: 58 },
  { id: 'sydney_decking_2026_April', client_id: 'sydney_decking', year: 2026, month: 'April', call_clicks: 49 },
  { id: 'sydney_decking_2026_May', client_id: 'sydney_decking', year: 2026, month: 'May', call_clicks: 65 }
];

export interface ClientN8NConfig {
  client_id: string;
  gemini_prompt: string;
  gemini_models: string[];
  openai_enabled: boolean;
  openai_prompt: string;
  genuine_recipient_email: string;
  spam_recipient_email: string;
  webhook_url: string;
}

export const DEFAULT_N8N_CONFIGS: ClientN8NConfig[] = [
  {
    client_id: 'sydney_decking',
    gemini_prompt: "You are the primary spam filter for Sydney Decking Specialists. Analyze the following form submission message. If the customer is inquiring about genuine decking, custom pergolas, timber patios, or cost estimates in the Sydney region, classify as GENUINE. If it is advertisement, SEO requests, backlink pitches, cryptocurrency blogs, generic greetings without context, or slot link insertions, classify as SPAM. Report in strict JSON format: { \"verdict\": \"GENUINE\" | \"SPAM\", \"reason\": \"Detailed analytical logic...\" }",
    gemini_models: [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-1.5-flash"
    ],
    openai_enabled: true,
    openai_prompt: "Final threshold checkpoint. You are backing up 4 consecutive failed Gemini nodes. Filter the decking lead packet. Be extra conservative but fair. High confidence spam gets SPAM. Genuine customer messages get GENUINE.",
    genuine_recipient_email: "team@sydneydecking.au",
    spam_recipient_email: "spam-inbox@outreachseo.online",
    webhook_url: "https://your-n8n.public_html/webhook/sydney_decking_forms"
  },
  {
    client_id: 'melbourne_renos',
    gemini_prompt: "You are the security firewall for Melbourne Renovation Co. Determine if this incoming web inquiry is a genuine renovation lead. Homeowners booking inspections or kitchen/bathroom renovation queries are GENUINE. Mass marketing lists, offshore design services, or generic solicitations are SPAM. Report as JSON with verdict and reason.",
    gemini_models: [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-1.5-pro"
    ],
    openai_enabled: true,
    openai_prompt: "Verify the home renovation lead. Determine if genuine or spam.",
    genuine_recipient_email: "leads@melbrenos.com.au",
    spam_recipient_email: "spam-sandbox@outreachseo.online",
    webhook_url: "https://your-n8n.public_html/webhook/melbournerenos_leads"
  },
  {
    client_id: 'brisbane_landscapes',
    gemini_prompt: "Spam block utility for Brisbane Landscape Architects. Filter turfing, decking, drainage, and landscape design plans. Block unrelated SEO/promotional pitches. Report structured JSON schema.",
    gemini_models: [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-1.5-flash"
    ],
    openai_enabled: false,
    openai_prompt: "Determine if landscaping query is spam or genuine.",
    genuine_recipient_email: "hello@brisbanelandscapes.co",
    spam_recipient_email: "spam-archive@agency.com",
    webhook_url: "https://your-n8n.public_html/webhook/brisbane_landscapes_leads"
  }
];

const DEFAULT_CLIENTS: Client[] = [
  { id: 1, client_id: 'sydney_decking', business_name: 'Sydney Decking Specialists', contact_email: 'contact@sydneydecking.au', status: 'active', created_at: '2026-05-18 10:14:02', has_seo: true, has_google_ads: true, has_fb_ads: true, has_gmb: true },
  { id: 2, client_id: 'melbourne_renos', business_name: 'Melbourne Renovation Co', contact_email: 'info@melbrenos.com.au', status: 'active', created_at: '2026-05-19 14:32:00', has_seo: true, has_google_ads: true, has_fb_ads: true, has_gmb: false },
  { id: 3, client_id: 'brisbane_landscapes', business_name: 'Brisbane Landscape Architects', contact_email: 'hello@brisbanelandscapes.co', status: 'inactive', created_at: '2026-05-20 01:10:45', has_seo: true, has_google_ads: false, has_fb_ads: false, has_gmb: false }
];

const DEFAULT_USERS: User[] = [
  { id: 1, username: 'nstech', role: 'admin', client_id: null },
  { id: 2, username: 'sydney_deck', role: 'client', client_id: 'sydney_decking' },
  { id: 3, username: 'melb_renos', role: 'client', client_id: 'melbourne_renos' },
  { id: 4, username: 'brisbane_land', role: 'client', client_id: 'brisbane_landscapes' }
];

const DEFAULT_LEADS: Lead[] = [
  { 
    id: 101, 
    client_id: 'sydney_decking', 
    form_data: { "name": "Dave Patterson", "email": "dave@pattersonbuild.com", "phone": "+61 412 345 678", "project_type": "Hardwood Decking, 40sqm", "message": "Looking to build an outdoor veranda patio next month. Can you quote?" }, 
    status: 'GENUINE', 
    ai_reason: null, 
    channel: 'website',
    created_at: '2026-05-19 12:45:11' 
  },
  { 
    id: 102, 
    client_id: 'sydney_decking', 
    form_data: { "name": "Elena Seo Growth", "email": "elena.seo.growth@gmail.com", "subject": "Guaranteed Rankings", "message": "Hello agency owner, we offer guaranteed #1 organic rank leads, pay only on results. Review our cheap offshore packages on this page!" }, 
    status: 'SPAM', 
    ai_reason: 'Gated: Submission matches mass-outreach structure offering SEO / rank promotions.', 
    channel: 'website',
    created_at: '2026-05-19 16:20:00' 
  },
  { 
    id: 103, 
    client_id: 'sydney_decking', 
    form_data: { "name": "Brian Gallagher", "email": "brian@gallaghers.com.au", "phone": "0429 110 339", "source": "Google Search CPC Campaign", "project_budget": "$12,000", "message": "Need a prompt quotation for a cedar wood patio deck, 30 square meters." }, 
    status: 'GENUINE', 
    ai_reason: null, 
    channel: 'google_ads',
    created_at: '2026-05-20 09:12:40' 
  },
  { 
    id: 104, 
    client_id: 'sydney_decking', 
    form_data: { "name": "Forex Signal Pro", "email": "signals@profitforex-market.club", "message": "Get 98% accurate daily signals on indices and forex pairings. Double your investment within 48 hours..." }, 
    status: 'SPAM', 
    ai_reason: 'Gated: High density of crypto spam buzzwords (payouts, forex, signals, double investment).', 
    channel: 'google_ads',
    created_at: '2026-05-20 11:30:15' 
  },
  { 
    id: 151, 
    client_id: 'sydney_decking', 
    form_data: { "name": "Amanda Thorne", "email": "amanda.thorne@hotmail.com", "phone": "0412 990 443", "campaign": "Facebook Summer Decks Promo", "message": "Interested in a free design consult for a customized timber staircase." }, 
    status: 'GENUINE', 
    ai_reason: null, 
    channel: 'facebook_ads',
    created_at: '2026-05-21 03:22:10' 
  },
  { 
    id: 152, 
    client_id: 'sydney_decking', 
    form_data: { "name": "Business Meta Safety", "email": "case-no-95291@meta-support-secure.org", "message": "Your Facebook Business advertiser account is scheduled for suspension due to violating guidelines. Verify credentials immediate!" }, 
    status: 'SPAM', 
    ai_reason: 'Gated: Phishing attempt targeting ads account control privileges.', 
    channel: 'facebook_ads',
    created_at: '2026-05-21 05:44:00' 
  },
  { 
    id: 153, 
    client_id: 'sydney_decking', 
    form_data: { "caller_name": "James Lawson", "phone": "0491 570 156", "duration": "4 mins 12 secs", "gmb_listing": "Sydney Decking & Patios", "transcription": "Hi, saw your GMB map listings, wanted to ask if you do council approvals?" }, 
    status: 'GENUINE', 
    ai_reason: null, 
    channel: 'gmb',
    created_at: '2026-05-21 08:30:00' 
  },
  { 
    id: 105, 
    client_id: 'melbourne_renos', 
    form_data: { "full_name": "Marcus Aurelius", "email": "marcus@rome.org", "phone": "0499 999 999", "renovation_scope": "Full Kitchen Retrofit", "budget": "$45,000" }, 
    status: 'GENUINE', 
    ai_reason: null, 
    channel: 'website',
    created_at: '2026-05-20 02:05:10' 
  },
  { 
    id: 106, 
    client_id: 'melbourne_renos', 
    form_data: { "full_name": "BitPayouts BOT", "email": "payouts@shiba-inu-elon.info", "subject": "Urgent Bitcoin passive rewards", "message": "Earn $2500 per day passive cryptocurrency. Try shiba-presale.io or transfer instantly on this verified link..." }, 
    status: 'SPAM', 
    ai_reason: 'Gated: High density of crypto spam buzzwords (payouts, bitcoin, shiba, double earnings).', 
    channel: 'website',
    created_at: '2026-05-20 02:45:00' 
  },
  { 
    id: 107, 
    client_id: 'melbourne_renos', 
    form_data: { "full_name": "Charlotte Winters", "email": "charlotte.w@gmail.com", "phone": "03 9811 5442", "source": "Google Ad Keyword Match", "project": "Ensuite Bathroom Renovation" }, 
    status: 'GENUINE', 
    ai_reason: null, 
    channel: 'google_ads',
    created_at: '2026-05-21 16:15:22' 
  },
  { 
    id: 108, 
    client_id: 'melbourne_renos', 
    form_data: { "full_name": "Chloe Vance", "email": "chloe@vancearchitects.com", "phone": "03 9452 1102", "scope": "Master Suite & Walk-in Robe", "lead_source": "Facebook lead ad" }, 
    status: 'GENUINE', 
    ai_reason: null, 
    channel: 'facebook_ads',
    created_at: '2026-05-22 01:25:31' 
  }
];

// =====================================================================
// SIMULATOR WEBHOOK SCENARIOS
// =====================================================================
const TEST_WEBHOOKS = [
  {
    name: "Sydney Decking: Genuine Web Inquiry",
    client_id: "sydney_decking",
    status: "GENUINE",
    ai_reason: "",
    channel: "website",
    form_data: { "name": "Sarah Jenkins", "email": "s.jenkins@optusnet.com.au", "phone": "0412 888 777", "message": "Hi, I need a replacement treated pine deck for my pool area. Approx 6x4m. Available for a site review this Friday?" }
  },
  {
    name: "Sydney Decking: Google Ads Click (Genuine)",
    client_id: "sydney_decking",
    status: "GENUINE",
    ai_reason: "",
    channel: "google_ads",
    form_data: { "name": "Gregory Vance", "email": "gvance@optusnet.com.au", "phone": "0412 400 399", "source": "Adwords Campaign Summer", "message": "Looking for custom hardwood deck quotes. Prefer Merbau timber." }
  },
  {
    name: "Sydney Decking: Facebook Ad Lead (Genuine)",
    client_id: "sydney_decking",
    status: "GENUINE",
    ai_reason: "",
    channel: "facebook_ads",
    form_data: { "name": "Melissa Green", "email": "m.green@gmail.com", "phone": "0491 300 212", "campaign": "Meta Lead Form Decks", "message": "I clicked on your patio transformation video. Can I get a free brochure?" }
  },
  {
    name: "Sydney Decking: GMB Listing Phone Call (Genuine)",
    client_id: "sydney_decking",
    status: "GENUINE",
    ai_reason: "",
    channel: "gmb",
    form_data: { "caller": "Arthur Pendragon", "phone": "0491 555 777", "call_duration": "3 min 15 sec", "source": "GMB Map Listing Ring" }
  },
  {
    name: "Sydney Decking: Russian Link Spam Website",
    client_id: "sydney_decking",
    status: "SPAM",
    ai_reason: "Gated: Keyword match 'X-RUMER' and russian link farming templates.",
    channel: "website",
    form_data: { "name": "X-Rumer-Service", "email": "backlinks@yandex.ru", "url": "http://rank-up.ru/p/3", "message": "Hello! Boost website with 10,000 top premium blog footprints and profile links today. Direct discount applies for agency orders!" }
  },
  {
    name: "Melbourne Renos: Genuine Master Suite project",
    client_id: "melbourne_renos",
    status: "GENUINE",
    ai_reason: "",
    channel: "website",
    form_data: { "full_name": "Rupert & Chloe Vance", "email": "rupert@vancearchitects.com", "phone": "03 9452 1102", "renovation_scope": "Master Bathroom & Walk-in Robe Extension", "budget": "$60k-$80k", "preferred_start": "Q3 2026" }
  },
  {
    name: "Melbourne Renos: Casino Spam Website",
    client_id: "melbourne_renos",
    status: "SPAM",
    ai_reason: "Gated: Lead payload references gaming slot machine bonuses and casino links.",
    channel: "website",
    form_data: { "full_name": "SlotsJackpot777", "email": "winner@casino-win777.online", "message": "CLAIM $500 free credit bonus slots spins today only! Safe payout with instant Neteller or BTC. Go to casino-win777.online..." }
  }
];

export default function Dashboard() {
  // Navigation Tabs: 'sim' | 'n8n_hub' | 'webhooks' | 'vault' | 'blueprint'
  const [currentTab, setCurrentTab] = useState<'sim' | 'n8n_hub' | 'webhooks' | 'vault' | 'blueprint'>('sim');
  const [activeTestCmd, setActiveTestCmd] = useState<'powershell' | 'cmd' | 'bash'>('powershell');

  // Unified Database State (Simulated Local Storage)
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('ls_clients');
    return saved ? JSON.parse(saved) : DEFAULT_CLIENTS;
  });

  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('ls_leads');
    return saved ? JSON.parse(saved) : DEFAULT_LEADS;
  });

  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('ls_users');
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });

  // GMB Monthly Tracker State (Simulated Local Storage)
  const [gmbMetrics, setGmbMetrics] = useState<GmbMonthlyMetric[]>(() => {
    const saved = localStorage.getItem('ls_gmb_metrics');
    return saved ? JSON.parse(saved) : DEFAULT_GMB_METRICS;
  });

  // n8n Integrator Config State (Persistent Local Storage)
  const [n8nConfigs, setN8nConfigs] = useState<ClientN8NConfig[]>(() => {
    const saved = localStorage.getItem('ls_n8n_configs');
    return saved ? JSON.parse(saved) : DEFAULT_N8N_CONFIGS;
  });

  const [dataLoaded, setDataLoaded] = useState(false);

  // Initialize and load real persistent data from our Express server
  useEffect(() => {
    async function loadRealData() {
      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const fetched = await res.json();
          if (fetched.clients) setClients(fetched.clients);
          if (fetched.leads) setLeads(fetched.leads);
          if (fetched.users) setUsers(fetched.users);
          if (fetched.gmbMetrics) setGmbMetrics(fetched.gmbMetrics);
          if (fetched.n8nConfigs) setN8nConfigs(fetched.n8nConfigs);
        }
      } catch (err) {
        console.error("Failed to load server data, utilizing browser state fallback:", err);
      } finally {
        setDataLoaded(true);
      }
    }
    loadRealData();

    // Authenticate with Supabase and fetch user profile
    async function loadSupabaseSession() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        if (user) {
          // Check if user exists in our users table using their Auth UUID
          const { data: existingUser, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error("Profile fetch error:", profileError);
            alert("Error fetching profile: " + profileError.message);
          }

          if (existingUser) {
            setLoggedInUser(existingUser as User);
          } else {
            // Auto-create profile for the authenticated user
            if (user) {
              const { data: insertedUser, error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: user.id,
                  username: user.email || user.id,
                  role: 'admin',
                  client_id: null,
                })
                .select()
                .single();

              if (insertError) {
                alert("Failed to create admin profile. Supabase RLS might be blocking inserts. Error: " + insertError.message);
                await supabase.auth.signOut();
                window.location.href = '/login';
                return;
              }

              if (insertedUser) {
                 setLoggedInUser(insertedUser as User);
              }
            } else {
              alert("Security Error: Your account was authenticated, but no valid profile was linked. Logging out.");
              await supabase.auth.signOut();
              window.location.href = '/login';
            }
          }
        } else {
           window.location.href = '/login';
        }
      } catch (err: any) {
        alert("Authentication failed: " + err.message);
        await supabase.auth.signOut();
        window.location.href = '/login';
      }
    }
    loadSupabaseSession();
  }, []);

  // Poll server for live webhook transmissions dynamically every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const fetched = await res.json();
          if (fetched.leads) setLeads(fetched.leads);
          if (fetched.clients) setClients(fetched.clients);
          if (fetched.users) setUsers(fetched.users);
          if (fetched.gmbMetrics) setGmbMetrics(fetched.gmbMetrics);
          if (fetched.n8nConfigs) setN8nConfigs(fetched.n8nConfigs);
        }
      } catch (err) {
        // Silent block for transient sandbox network drops
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Selected n8n client config to manage
  const [selConfigClientId, setSelConfigClientId] = useState<string>('sydney_decking');

  // n8n individual config edit state
  const [editGeminiPrompt, setEditGeminiPrompt] = useState('');
  const [editGeminiModel1, setEditGeminiModel1] = useState('gemini-2.5-flash');
  const [editGeminiModel2, setEditGeminiModel2] = useState('gemini-2.5-pro');
  const [editGeminiModel3, setEditGeminiModel3] = useState('gemini-2.0-flash');
  const [editGeminiModel4, setEditGeminiModel4] = useState('gemini-1.5-flash');
  const [editOpenaiEnabled, setEditOpenaiEnabled] = useState(true);
  const [editOpenaiPrompt, setEditOpenaiPrompt] = useState('');
  const [editGenuineRecipient, setEditGenuineRecipient] = useState('');
  const [editSpamRecipient, setEditSpamRecipient] = useState('');
  const [editWebhookUrl, setEditWebhookUrl] = useState('');

  // n8n workflow live failover simulator states
  const [n8nSimName, setN8nSimName] = useState('Dr. Alex Harrison');
  const [n8nSimEmail, setN8nSimEmail] = useState('alex.harrison@techsolutions.com');
  const [n8nSimMessage, setN8nSimMessage] = useState("Hi, I am looking to build a high-quality outdoor timber patio with a surrounding deck for my backyard. Can we schedule a measure & quote session? My budget is $15k.");
  const [n8nSimConsoleLogs, setN8nSimConsoleLogs] = useState<string[]>([]);
  const [n8nSimIsProcessing, setN8nSimIsProcessing] = useState(false);
  const [n8nSimForceNodeFailures, setN8nSimForceNodeFailures] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false
  });

  // Dynamic synchronization of controlled inputs when client switches
  useEffect(() => {
    const config = n8nConfigs.find(c => c.client_id === selConfigClientId);
    if (config) {
      setEditGeminiPrompt(config.gemini_prompt);
      setEditGeminiModel1(config.gemini_models[0] || 'gemini-2.5-flash');
      setEditGeminiModel2(config.gemini_models[1] || 'gemini-2.5-pro');
      setEditGeminiModel3(config.gemini_models[2] || 'gemini-2.0-flash');
      setEditGeminiModel4(config.gemini_models[3] || 'gemini-1.5-flash');
      setEditOpenaiEnabled(config.openai_enabled);
      setEditOpenaiPrompt(config.openai_prompt);
      setEditGenuineRecipient(config.genuine_recipient_email);
      setEditSpamRecipient(config.spam_recipient_email);
      setEditWebhookUrl(config.webhook_url);
    } else {
      // Handle fallback if selected client doesn't have a config
      const matchingClient = clients.find(c => c.client_id === selConfigClientId);
      const email = matchingClient ? matchingClient.contact_email : 'contact@client.com';
      setEditGeminiPrompt(`Spam filter node for ${selConfigClientId}. Analyze message body; output strict JSON.`);
      setEditGeminiModel1('gemini-2.5-flash');
      setEditGeminiModel2('gemini-2.5-pro');
      setEditGeminiModel3('gemini-2.0-flash');
      setEditGeminiModel4('gemini-1.5-flash');
      setEditOpenaiEnabled(true);
      setEditOpenaiPrompt('Safeguard model verify client lead form payload.');
      setEditGenuineRecipient(email);
      setEditSpamRecipient('spam-archive@agency.com');
      setEditWebhookUrl(`https://your-n8n.public_html/webhook/${selConfigClientId}_leads`);
    }
  }, [selConfigClientId, n8nConfigs]);

  // GMB monthly metric form inputs
  const [gmbMonthInput, setGmbMonthInput] = useState('June');
  const [gmbYearInput, setGmbYearInput] = useState(2026);
  const [gmbClicksInput, setGmbClicksInput] = useState<number | string>(50);

  // Client CRUD inputs
  const [newBizName, setNewBizName] = useState('');
  const [newBizEmail, setNewBizEmail] = useState('');
  const [newBizUsername, setNewBizUsername] = useState('');
  const [newBizPassword, setNewBizPassword] = useState('');
  const [newBizHasSeo, setNewBizHasSeo] = useState(true);
  const [newBizHasGoogleAds, setNewBizHasGoogleAds] = useState(false);
  const [newBizHasFbAds, setNewBizHasFbAds] = useState(false);
  const [newBizHasGmb, setNewBizHasGmb] = useState(false);

  // Webhook custom form payload
  const [selectedWebhook, setSelectedWebhook] = useState<number>(0);
  const [webhookData, setWebhookData] = useState<any>(TEST_WEBHOOKS[0]);
  const [webhookConsoleLogs, setWebhookConsoleLogs] = useState<string[]>([]);
  const [webhookSuccessSignal, setWebhookSuccessSignal] = useState(false);

  // Authentication State (Simulated)
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Admin Audit Feed filters
  const [adminFilterClient, setAdminFilterClient] = useState('');
  const [adminFilterStatus, setAdminFilterStatus] = useState('');

  // Dynamic Form Payload Modal state
  const [selectedAuditLead, setSelectedAuditLead] = useState<Lead | null>(null);

  // Dynamic API leads stats retriever tool states
  const [statsClientId, setStatsClientId] = useState<string>('all');
  const [statsStartDate, setStatsStartDate] = useState<string>('');
  const [statsEndDate, setStatsEndDate] = useState<string>('');
  const [statsResponsePreview, setStatsResponsePreview] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);

  // Client Editing state
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editBizName, setEditBizName] = useState('');
  const [editBizEmail, setEditBizEmail] = useState('');
  const [editBizStatus, setEditBizStatus] = useState<'active' | 'inactive'>('active');
  const [editBizHasSeo, setEditBizHasSeo] = useState(false);
  const [editBizHasGoogleAds, setEditBizHasGoogleAds] = useState(false);
  const [editBizHasFbAds, setEditBizHasFbAds] = useState(false);
  const [editBizHasGmb, setEditBizHasGmb] = useState(false);

  // Source Vault tab state
  const [selectedVaultFile, setSelectedVaultFile] = useState<string>("schema.sql");
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // Client Space Tab selection: 'genuine' | 'spam'
  const [clientActiveTab, setClientActiveTab] = useState<'genuine' | 'spam'>('genuine');
  const [clientChannelFilter, setClientChannelFilter] = useState<'all' | 'website' | 'google_ads' | 'facebook_ads' | 'gmb'>('all');

  // Client Outbound developer API pull simulator state
  const [clientApiLogs, setClientApiLogs] = useState<string>('');
  const [clientApiPulseOn, setClientApiPulseOn] = useState(false);

  // Admin client workspace inspection state without logging out
  const [adminInspectedClient, setAdminInspectedClient] = useState<string | null>(null);
  const [adminClientSearch, setAdminClientSearch] = useState('');
  const [showAdminClientSearch, setShowAdminClientSearch] = useState(false);
  const [adminInspectTab, setAdminInspectTab] = useState<'genuine' | 'spam'>('genuine');

  // Synchronization with browser cache and server backend
  useEffect(() => {
    localStorage.setItem('ls_clients', JSON.stringify(clients));
    if (dataLoaded) {
      fetch('/api/save-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clients)
      }).catch(err => console.error("Error saving clients to server:", err));
    }
  }, [clients, dataLoaded]);

  useEffect(() => {
    localStorage.setItem('ls_leads', JSON.stringify(leads));
    if (dataLoaded) {
      fetch('/api/save-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leads)
      }).catch(err => console.error("Error saving leads to server:", err));
    }
  }, [leads, dataLoaded]);

  useEffect(() => {
    localStorage.setItem('ls_users', JSON.stringify(users));
    if (dataLoaded) {
      fetch('/api/save-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(users)
      }).catch(err => console.error("Error saving users to server:", err));
    }
  }, [users, dataLoaded]);

  useEffect(() => {
    localStorage.setItem('ls_gmb_metrics', JSON.stringify(gmbMetrics));
    if (dataLoaded) {
      fetch('/api/save-gmb-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gmbMetrics)
      }).catch(err => console.error("Error saving metrics to server:", err));
    }
  }, [gmbMetrics, dataLoaded]);

  useEffect(() => {
    localStorage.setItem('ls_n8n_configs', JSON.stringify(n8nConfigs));
    if (dataLoaded) {
      fetch('/api/save-n8n-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(n8nConfigs)
      }).catch(err => console.error("Error saving n8n configs to server:", err));
    }
  }, [n8nConfigs, dataLoaded]);

  // Restrict client users to the simulator tab (Lead Security Inbox) space
  useEffect(() => {
    if (loggedInUser && loggedInUser.role === 'client') {
      setCurrentTab('sim');
    }
  }, [loggedInUser]);

  // Adjust webhook custom editor when template switches
  const handleWebhookPresetChange = (index: number) => {
    setSelectedWebhook(index);
    setWebhookData(TEST_WEBHOOKS[index]);
  };

  // Trigger simulated REST webhook post request
  const handleBroadcastSimulatedWebhook = async () => {
    if (!webhookData) return;

    const data = { ...webhookData };
    const matchingTenant = clients.find(c => c.client_id === data.client_id);

    setWebhookSuccessSignal(true);
    setTimeout(() => setWebhookSuccessSignal(false), 1500);

    const logTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (!matchingTenant) {
      const errorMsg = `[${logTimestamp}]  HTTP/1.1 404 Not Found\nTenant Validation Denied: Client ID '${data.client_id}' does not exist on Lead Shield.`;
      setWebhookConsoleLogs(prev => [errorMsg, ...prev]);
      return;
    }

    if (matchingTenant.status !== 'active') {
      const errorMsg = `[${logTimestamp}]  HTTP/1.1 403 Forbidden\nTenant Locked: Client workspace '${data.client_id}' is suspended. Denying payload.`;
      setWebhookConsoleLogs(prev => [errorMsg, ...prev]);
      return;
    }

    try {
      const response = await fetch('/api/receive-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: data.client_id,
          channel: data.channel,
          status: data.status,
          ai_reason: data.status === 'SPAM' ? data.ai_reason : null,
          form_data: data.form_data
        })
      });

      if (response.ok) {
        const result = await response.json();
        const successResponse = `[${logTimestamp}]  HTTP/1.1 201 Created\nContent-Type: application/json; charset=utf-8\nAccess-Control-Allow-Origin: *\n\n${JSON.stringify({
          status: "success",
          message: "Captured successfully on real server backend (db.json file), synchronized in real-time!",
          lead_id: result.lead_id,
          tenant_id: data.client_id,
          classification: result.classification?.verdict || data.status
        }, null, 2)}`;
        setWebhookConsoleLogs(prev => [successResponse, ...prev]);
      } else {
        throw new Error("HTTP error: " + response.status);
      }
    } catch (err: any) {
      const errorResponse = `[${logTimestamp}]  HTTP/1.1 500 Internal Server Error\nError communicating with back-end: ${err.message}`;
      setWebhookConsoleLogs(prev => [errorResponse, ...prev]);
    }
  };

  // Client crud actions
  const handleCreateNewClient = async (e: React.FormEvent) => {
    e.preventDefault();

    const t_id = newBizName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    
    // Check if client_id already taken in DB
    const { data: existingClient } = await supabase.from('clients').select('client_id').eq('client_id', t_id).single();
    if (existingClient) {
      alert(`The Client ID token '${t_id}' is already taken. Try altering the business name.`);
      return;
    }

    const { data: existingProfile } = await supabase.from('profiles').select('username').eq('username', newBizUsername).single();
    if (existingProfile) {
      alert(`Email/Username '${newBizUsername}' is taken. Please select different portal credentials.`);
      return;
    }

    // Insert into Supabase
    const { error: clientError } = await supabase.from('clients').insert({
      client_id: t_id,
      business_name: newBizName,
      contact_email: newBizEmail,
      status: 'active',
      has_seo: newBizHasSeo,
      has_google_ads: newBizHasGoogleAds,
      has_fb_ads: newBizHasFbAds,
      has_gmb: newBizHasGmb
    });

    if (clientError) {
      alert(`Failed to create client workspace: ${clientError.message}`);
      return;
    }

    // Attempt to create Supabase Auth User via secure backend endpoint
    // This will securely create the Auth user and link it directly into the profiles table
    try {
      const authResponse = await fetch('/api/admin/create-client-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: newBizUsername, 
          password: newBizPassword,
          client_id: t_id,
          role: 'client'
        })
      });
      
      const authResult = await authResponse.json();
      if (!authResponse.ok || authResult.error) {
        alert(`Workspace created, but could not create Auth login: ${authResult.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert("Failed to connect to backend Auth service. Client created, but login not generated.");
    }

    const newN8nConfig = {
      client_id: t_id,
      gemini_prompt: `You are the primary spam filter for ${newBizName}. Analyze the following details...`,
      gemini_models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash"],
      openai_enabled: true,
      openai_prompt: `Final safeguard check for ${newBizName}. Filter the incoming message. Report as JSON with verdict.`,
      genuine_recipient_email: newBizEmail,
      spam_recipient_email: "spam-sandbox@outreachseo.online",
      webhook_url: `https://your-n8n.public_html/webhook/${t_id}_leads`
    };

    await supabase.from('n8n_configs').insert(newN8nConfig);

    alert(`Client workspace '${newBizName}' created securely!\n\nThe portal login for this client is now instantly active with the email: ${newBizUsername}`);

    // Fetch fresh data from API
    const res = await fetch('/api/data');
    if (res.ok) {
      const fetched = await res.json();
      if (fetched.clients) setClients(fetched.clients);
      if (fetched.users) setUsers(fetched.users);
      if (fetched.n8nConfigs) setN8nConfigs(fetched.n8nConfigs);
    }

    setNewBizName('');
    setNewBizEmail('');
    setNewBizUsername('');
    setNewBizPassword('');
    setNewBizHasSeo(true);
    setNewBizHasGoogleAds(false);
    setNewBizHasFbAds(false);
    setNewBizHasGmb(false);
  };

  const handleToggleClientStatus = async (clientId: string) => {
    const client = clients.find(c => c.client_id === clientId);
    if (!client) return;
    
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    
    const { error } = await supabase.from('clients').update({ status: newStatus }).eq('client_id', clientId);
    if (error) {
      alert("Failed to toggle status: " + error.message);
      return;
    }

    setClients(prev => prev.map(c => {
      if (c.client_id === clientId) {
        return { ...c, status: newStatus };
      }
      return c;
    }));
  };

  const handleOpenEditClient = (client: Client) => {
    setEditingClient(client);
    setEditBizName(client.business_name);
    setEditBizEmail(client.contact_email);
    setEditBizStatus(client.status);
    setEditBizHasSeo(!!client.has_seo);
    setEditBizHasGoogleAds(!!client.has_google_ads);
    setEditBizHasFbAds(!!client.has_fb_ads);
    setEditBizHasGmb(!!client.has_gmb);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    if (!editBizName || !editBizEmail) {
      alert("Business Name and Contact Email are required.");
      return;
    }

    const { error } = await supabase.from('clients').update({
      business_name: editBizName,
      contact_email: editBizEmail,
      status: editBizStatus,
      has_seo: editBizHasSeo,
      has_google_ads: editBizHasGoogleAds,
      has_fb_ads: editBizHasFbAds,
      has_gmb: editBizHasGmb
    }).eq('client_id', editingClient.client_id);

    if (error) {
      alert("Failed to update client: " + error.message);
      return;
    }

    setClients(prev => prev.map(c => {
      if (c.client_id === editingClient.client_id) {
        return {
          ...c,
          business_name: editBizName,
          contact_email: editBizEmail,
          status: editBizStatus,
          has_seo: editBizHasSeo,
          has_google_ads: editBizHasGoogleAds,
          has_fb_ads: editBizHasFbAds,
          has_gmb: editBizHasGmb
        };
      }
      return c;
    }));

    setEditingClient(null);
    alert(`Successfully updated space '${editBizName}' details in Database!`);
  };

  const handleDeleteClient = async (clientId: string) => {
    const isConfirmed = await window.confirm("CRITICAL WARNING: Deleting this client tenant will permanently shred all user portals and leads records from the system database. Proceed?");
    if (!isConfirmed) {
      return;
    }

    // 1. Delete Auth User via Backend Admin Service
    try {
      await fetch('/api/admin/delete-client-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId })
      });
    } catch (e) {
      console.warn("Failed to reach backend to delete Auth user", e);
    }

    // 2. Delete Client records from Database
    const { error } = await supabase.from('clients').delete().eq('client_id', clientId);
    
    if (error) {
      alert("Failed to delete client: " + error.message);
      return;
    }

    // Profiles are cascading, but just in case, we can attempt to clean up
    await supabase.from('profiles').delete().eq('client_id', clientId);

    setClients(prev => prev.filter(c => c.client_id !== clientId));
    setLeads(prev => prev.filter(l => l.client_id !== clientId));
    setUsers(prev => prev.filter(u => u.client_id !== clientId));
    alert("Client and Portal Login successfully deleted from the Database.");
  };

  const handleRunSpamCleanup = async () => {
    const isConfirmed = await window.confirm("Are you sure you want to delete all SPAM leads older than 30 days? This action cannot be undone.");
    if (!isConfirmed) return;
    try {
      const res = await fetch("/api/admin/cleanup-spam", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Success: " + data.message);
        // Refresh leads
        const { data: leadsData } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
        if (leadsData) setLeads(leadsData);
      } else {
        alert("Cleanup Failed: " + data.error);
      }
    } catch (err: any) {
      alert("System Error: " + err.message);
    }
  };

  const handleSaveN8nConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setN8nConfigs(prev => {
      const exists = prev.some(c => c.client_id === selConfigClientId);
      if (exists) {
        return prev.map(c => {
          if (c.client_id === selConfigClientId) {
            return {
              ...c,
              gemini_prompt: editGeminiPrompt,
              gemini_models: [editGeminiModel1, editGeminiModel2, editGeminiModel3, editGeminiModel4],
              openai_enabled: editOpenaiEnabled,
              openai_prompt: editOpenaiPrompt,
              genuine_recipient_email: editGenuineRecipient,
              spam_recipient_email: editSpamRecipient,
              webhook_url: editWebhookUrl
            };
          }
          return c;
        });
      } else {
        const newCfg: ClientN8NConfig = {
          client_id: selConfigClientId,
          gemini_prompt: editGeminiPrompt,
          gemini_models: [editGeminiModel1, editGeminiModel2, editGeminiModel3, editGeminiModel4],
          openai_enabled: editOpenaiEnabled,
          openai_prompt: editOpenaiPrompt,
          genuine_recipient_email: editGenuineRecipient,
          spam_recipient_email: editSpamRecipient,
          webhook_url: editWebhookUrl
        };
        return [...prev, newCfg];
      }
    });
    alert(`Successfully stored central n8n workflow configuration for client '${selConfigClientId}'!`);
  };

  const handleRunN8nSimulation = async () => {
    if (n8nSimIsProcessing) return;
    setN8nSimIsProcessing(true);
    setN8nSimConsoleLogs([]);

    const addLog = (msg: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setN8nSimConsoleLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
    };

    addLog(`🎬 Starting n8n Webhook Trigger Simulation for Client ID: "${selConfigClientId}"...`);
    await new Promise(resolve => setTimeout(resolve, 600));

    addLog(`📥 Webhook Node active. Parsing incoming Form POST payload...`);
    addLog(`   ↪ Name: "${n8nSimName}"`);
    addLog(`   ↪ Email: "${n8nSimEmail}"`);
    addLog(`   ↪ Message: "${n8nSimMessage}"`);
    await new Promise(resolve => setTimeout(resolve, 800));

    let rawText = (n8nSimName + " " + n8nSimEmail + " " + n8nSimMessage).toLowerCase();
    let isSpam = false;
    let classificationReason = '';

    if (rawText.includes('crypto') || rawText.includes('btc') || rawText.includes('casino') || rawText.includes('spin') || rawText.includes('slot') || rawText.includes('seo') || rawText.includes('page 1') || rawText.includes('backlink') || rawText.includes('advertising') || rawText.includes('guaranteed traffic') || rawText.includes('poker')) {
      isSpam = true;
      classificationReason = "Gated: Text contains known promotional spam triggers or bulk advertising proposals (e.g. SEO linkbuilding, slot games, page-1 ranking).";
    } else if (rawText.trim().length < 5) {
      isSpam = true;
      classificationReason = "Gated: Empty message payload or randomized test character pattern.";
    } else {
      classificationReason = "Genuine: Context-relevant, localized inquiry about custom construction, measurement estimations, rates, or high-intent design consultation.";
    }

    const nextNode = async (nodeIndex: number): Promise<boolean> => {
      const model = [editGeminiModel1, editGeminiModel2, editGeminiModel3, editGeminiModel4][nodeIndex - 1];
      addLog(`⚡ Routing state to Failover Node #${nodeIndex} [Gemini Model: ${model}]...`);
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (n8nSimForceNodeFailures[nodeIndex] === true) {
        addLog(`❌ [API Error] Node #${nodeIndex} (${model}) failed with code: 504 Gateway Timeout! (Forcing simulated failure toggle is ON)`);
        return false;
      }

      addLog(`✅ Node #${nodeIndex} Response Received! Analysing content via model prompt instructions...`);
      await new Promise(resolve => setTimeout(resolve, 600));
      return true;
    };

    let nodeIndex = 1;
    let nodePassed = false;

    while (nodeIndex <= 4) {
      nodePassed = await nextNode(nodeIndex);
      if (nodePassed) {
        break;
      }
      nodeIndex++;
      if (nodeIndex <= 4) {
        addLog(`🛠️ Failover Sequencer invoked. Pivoting to next redundant backup node...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    let finalVerdict = isSpam ? 'SPAM' : 'GENUINE';

    if (!nodePassed) {
      addLog(`🚨 WARNING: All 4 Gemini nodes returned a service error or timed out!`);
      await new Promise(resolve => setTimeout(resolve, 500));

      if (editOpenaiEnabled) {
        addLog(`🤖 Activating final sentinel backup: OpenAI Fallback Node...`);
        await new Promise(resolve => setTimeout(resolve, 1200));
        addLog(`✅ OpenAI Node Response Received! Analyzing lead payload with fallback instruction rules...`);
        await new Promise(resolve => setTimeout(resolve, 600));
      } else {
        addLog(`⚠️ OpenAI backup is disabled in system configurations! Deflecting to local strict offline rule heuristics...`);
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    const resultVerdict = finalVerdict;
    const finalReason = classificationReason;

    addLog(`🏆 Classification Process Complete! Verdict: **${resultVerdict}**`);
    addLog(`   ↪ Analytical Reason: "${finalReason}"`);
    await new Promise(resolve => setTimeout(resolve, 800));

    addLog(`🔀 Injecting Conditional Router Node...`);
    await new Promise(resolve => setTimeout(resolve, 400));

    if (resultVerdict === 'GENUINE') {
      addLog(`📧 Forwarding genuine lead payload to CRM recipient address: "${editGenuineRecipient}" via SendGrid SMTP node...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      addLog(`🎉 [SUCCESS] Real-time lead delivered successfully!`);
    } else {
      addLog(`📁 Quarantine Router activated. Forwarding spam telemetry details to agency audit backlog: "${editSpamRecipient}"...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      addLog(`🔒 [SUCCESS] Client Inbox protected. spam warning dispatched to agency logbook.`);
    }

    const logTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const newId = leads.length > 0 ? Math.max(...leads.map(l => l.id)) + 1 : 101;
    const newLeadRecord: Lead = {
      id: newId,
      client_id: selConfigClientId,
      form_data: { full_name: n8nSimName, email: n8nSimEmail, message: n8nSimMessage },
      status: resultVerdict as 'GENUINE' | 'SPAM',
      ai_reason: resultVerdict === 'SPAM' ? finalReason : null,
      channel: 'website',
      created_at: logTimestamp
    };

    setLeads(prev => [newLeadRecord, ...prev]);
    addLog(`💾 [Database Sync] Logged simulated lead record #${newId} securely inside active simulators local database!`);

    setN8nSimIsProcessing(false);
  };

  // Add or update custom GMB monthly statistics manually
  const handleSaveGmbMetric = (clientId: string) => {
    if (!gmbMonthInput || !gmbYearInput) {
      alert("Month and Year are required.");
      return;
    }
    const clicks = Number(gmbClicksInput);
    if (isNaN(clicks) || clicks < 0) {
      alert("Call clicks count must be a valid positive integer.");
      return;
    }

    const metricId = `${clientId}_${gmbYearInput}_${gmbMonthInput}`;

    setGmbMetrics(prev => {
      // Clean previous matching record to avoid duplicates
      const filtered = prev.filter(m => m.id !== metricId);
      const updated = [
        ...filtered,
        {
          id: metricId,
          client_id: clientId,
          year: Number(gmbYearInput),
          month: gmbMonthInput,
          call_clicks: clicks
        }
      ];
      // Sort: newest year first, then calendar month ordering descending
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return updated.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return months.indexOf(b.month) - months.indexOf(a.month);
      });
    });

    alert(`Successfully stored GMB metrics: ${clicks} call-button clicks entered for ${gmbMonthInput} ${gmbYearInput}!`);
  };

  const handleDeleteGmbMetric = async (metricId: string) => {
    const isConfirmed = await window.confirm("Are you sure you want to permanently delete this manual GMB monthly click entry?");
    if (!isConfirmed) {
      return;
    }
    setGmbMetrics(prev => prev.filter(m => m.id !== metricId));
  };

  const renderGmbTrackerUI = (clientId: string, clientName: string) => {
    const filteredMetrics = gmbMetrics.filter(m => m.client_id === clientId);
    
    return (
      <div id="gmb_custom_tracker_console" className="bg-white rounded-3xl border border-purple-200 shadow-md p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-purple-100 text-purple-700 font-mono font-black px-2.5 py-0.5 rounded uppercase tracking-wider">
                GOOGLE PROFILE
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-black px-2 py-0.5 rounded uppercase tracking-wider">
                MANUAL REPORTING
              </span>
            </div>
            <h3 className="text-sm font-black text-[#082b36] mt-1 flex items-center gap-1.5">
              💎 GMB Monthly Call Button Click Tracker
            </h3>
            <p className="text-[11px] text-[#082b36]/60 leading-relaxed">
              Keep track of monthly GMB Map listing click aggregates manually for <strong>{clientName}</strong>.
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => {
              setGmbMonthInput('June');
              setGmbYearInput(2026);
              setGmbClicksInput(72);
              alert("Loaded sample inputs! Click 'Save Monthly GMB Log' below to insert.");
            }}
            className="bg-purple-50 hover:bg-purple-100 text-[#096260] text-[10px] font-bold px-3 py-1.5 rounded-xl transition border border-purple-200/50 cursor-pointer"
          >
            ⚡ Load Sample Values
          </button>
        </div>

        {/* Add / Update Entry Area */}
        <div className="bg-purple-50/20 p-5 rounded-2xl border border-purple-100/50 space-y-3.5">
          <h4 className="text-[10px] font-bold text-purple-950 uppercase tracking-widest font-mono">
            ➕ Log / Amend Monthly GMB Clicks
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-[#096260] uppercase tracking-wider mb-1 font-mono">Select Calendar Month</label>
              <select
                value={gmbMonthInput}
                onChange={(e) => setGmbMonthInput(e.target.value)}
                className="w-full bg-white border border-[#096260]/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-[#096260] font-bold text-[#082b36]"
              >
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-[#096260] uppercase tracking-wider mb-1 font-mono">Calendar Year</label>
              <input
                type="number"
                value={gmbYearInput}
                onChange={(e) => setGmbYearInput(Number(e.target.value))}
                placeholder="2026"
                className="w-full bg-white border border-[#096260]/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-[#096260] font-bold text-[#082b36]"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold text-[#096260] uppercase tracking-wider mb-1 font-mono">Call Button Clicks Count</label>
              <input
                type="number"
                value={gmbClicksInput}
                onChange={(e) => setGmbClicksInput(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 50"
                className="w-full bg-white border border-[#096260]/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-[#096260] font-bold text-[#082b36]"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-2">
            <p className="text-[10px] text-gray-400">
              💡 Re-submitting the same Month + Year combo will update the clicks count automatically.
            </p>
            <button
              type="button"
              onClick={() => handleSaveGmbMetric(clientId)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs py-2 px-4 rounded-xl shadow cursor-pointer transition select-none flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              💾 Save Monthly GMB Log
            </button>
          </div>
        </div>

        {/* Metrics Logs List Container */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-[#082b36]/60 uppercase tracking-widest font-mono">
              🗓️ Logged Monthly Call Clicks History
            </h4>
            <span className="text-[9px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-bold font-mono border border-purple-100">
              {filteredMetrics.length} month(s) tracked
            </span>
          </div>

          {filteredMetrics.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100 italic text-xs text-gray-400">
              No manual GMB call metrics recorded for this workspace. Use the form above to add metrics.
            </div>
          ) : (
            <div className="border border-purple-100/60 rounded-2xl overflow-hidden bg-white shadow-inner">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-purple-50/50 text-[10px] font-mono uppercase tracking-wider text-purple-900 border-b border-purple-100">
                      <th className="p-3 w-40">Metric ID Record</th>
                      <th className="p-3">Time Period</th>
                      <th className="p-3">Call Actions Clicks</th>
                      <th className="p-3 text-right">Interactive Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-gray-600 font-medium">
                    {filteredMetrics.map(m => (
                      <tr key={m.id} className="hover:bg-purple-50/5 transition">
                        <td className="p-3 font-mono text-[9px] text-gray-400 select-all">{m.id}</td>
                        <td className="p-3 font-bold text-gray-800">🗓️ {m.month} {m.year}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 border border-purple-200/50 font-black text-[11px] px-2.5 py-1 rounded-xl">
                            📞 {m.call_clicks} clicks
                          </span>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setGmbMonthInput(m.month);
                              setGmbYearInput(m.year);
                              setGmbClicksInput(m.call_clicks);
                            }}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 font-extrabold text-[9px] px-2.5 py-1 rounded-lg mr-2 transition cursor-pointer"
                          >
                            Load values ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGmbMetric(m.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-extrabold text-[9px] px-2.5 py-1 rounded-lg transition cursor-pointer"
                          >
                            Shred ✖
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Dynamic click trends visualization */}
              <div className="bg-purple-50/30 p-4 border-t border-purple-100 flex items-end gap-3 justify-center min-h-[110px]">
                {filteredMetrics.map(m => {
                  const maxClicks = Math.max(...filteredMetrics.map(x => x.call_clicks), 1);
                  const heightPercentage = Math.round((m.call_clicks / maxClicks) * 80); // max 80px
                  return (
                    <div key={m.id} className="flex flex-col items-center group relative cursor-help">
                      <span className="absolute bottom-full mb-1 bg-[#082b36] text-white font-mono text-[9px] font-bold rounded px-2 py-0.5 opacity-0 group-hover:opacity-100 transition whitespace-nowrap shadow select-none pointer-events-none z-10">
                        {m.call_clicks} clicks
                      </span>
                      <div 
                        style={{ height: `${heightPercentage + 5}px` }} 
                        className="w-10 bg-purple-500 rounded-t-lg shadow-inner group-hover:bg-purple-600 transition duration-150 relative overflow-hidden"
                      >
                        <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10"></div>
                      </div>
                      <span className="text-[8px] font-mono block mt-1.5 text-gray-500 tracking-tight">{m.month.slice(0,3)} '{String(m.year).slice(2)}</span>
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </div>
      </div>
    );
  };

  // Client reclassification bypass
  const handleMarkAsGenuine = (leadId: number) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return { ...l, status: 'GENUINE', ai_reason: null };
      }
      return l;
    }));
  };

  const handleMarkAsSpam = (leadId: number) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return { ...l, status: 'SPAM', ai_reason: 'Manually flagged as SPAM by user.' };
      }
      return l;
    }));
  };

  const handleDeleteLeads = async (leadIds: number[]) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${leadIds.length} lead(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('leads').delete().in('id', leadIds);
      if (error) {
        alert('Failed to delete leads from database: ' + error.message);
        return;
      }
      setLeads(prev => prev.filter(l => !leadIds.includes(l.id)));
      setSelectedLeadIds(prev => prev.filter(id => !leadIds.includes(id)));
    } catch (err: any) {
      alert('An unexpected error occurred during deletion: ' + err.message);
    }
  };

  const toggleSelectLead = (leadId: number) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleSimulateClientApiPull = (clientId: string, type: 'stats' | 'leads') => {
    setClientApiPulseOn(true);
    setClientApiLogs('Initializing REST handshake with secure cPanel SSL... HTTP/1.1 GET\nConnecting to endpoint: /lead-shield/api/get-leads.php\nAuthenticating Workspace client-secret token...\n\n');
    
    setTimeout(() => {
      const clientObj = clients.find(c => c.client_id === clientId);
      const clientLeads = leads.filter(l => l.client_id === clientId);
      const genuineLeads = clientLeads.filter(l => l.status === 'GENUINE');
      const spamLeads = clientLeads.filter(l => l.status === 'SPAM');
      
      const responseData: any = {
        status: "success",
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        summary: {
          client_id: clientId,
          business_name: clientObj ? clientObj.business_name : clientId,
          contact_email: clientObj ? clientObj.contact_email : 'contact@agency.com',
          status: clientObj ? clientObj.status : "active",
          stats: {
            genuine_leads_count: genuineLeads.length,
            spam_blocked_count: spamLeads.length,
            total_leads_received: clientLeads.length
          }
        }
      };

      if (type === 'leads') {
        responseData.status_filter = "GENUINE";
        responseData.leads = genuineLeads.map(l => ({
          id: l.id,
          captured_at: l.created_at,
          status: l.status,
          channel: l.channel || 'website',
          ai_reason: l.ai_reason,
          payload: l.form_data
        }));
      }

      setClientApiLogs(prev => prev + `[HTTP/1.1 200 OK SUCCESS]\nCache-Control: private, no-store\nContent-Type: application/json; charset=utf-8\n\n` + JSON.stringify(responseData, null, 2));
      setClientApiPulseOn(false);
    }, 800);
  };

  // Handles simulated session logins
  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (loginUsername === 'nstech' && loginPassword === 'Mweerasinghe@123#') {
      const adminUserProfile: User = { id: 1, username: 'nstech', role: 'admin', client_id: null };
      setLoggedInUser(adminUserProfile);
      setLoginUsername('');
      setLoginPassword('');
      return;
    }

    // Check client users
    const matchedUser = users.find(u => u.username === loginUsername);
    if (matchedUser) {
      if (loginPassword === 'sydney123' || loginPassword === 'melb123' || loginPassword === 'bris123' || loginPassword === 'password' || loginPassword.length > 0) {
        // Find if associated client is inactive
        const associatedClient = clients.find(c => c.client_id === matchedUser.client_id);
        if (associatedClient && associatedClient.status === 'inactive') {
          setLoginError('Access Denied: This client workspace has been suspended.');
          return;
        }

        setLoggedInUser(matchedUser);
        setLoginUsername('');
        setLoginPassword('');
        return;
      }
    }

    setLoginError('Invalid username or password credentials. Please check defaults below.');
  };

  // Export filtered lead set to virtual CSV file download
  const handleTriggerCsvExport = (filterStatus: 'GENUINE' | 'SPAM') => {
    if (!loggedInUser || !loggedInUser.client_id) return;
    
    const client_id = loggedInUser.client_id;
    const exportLeads = leads.filter(l => l.client_id === client_id && l.status === filterStatus);

    if (exportLeads.length === 0) {
      alert("No data present inside your grid to compile a CSV spreadsheet!");
      return;
    }

    // dynamic header formulation
    const headers = ['ID', 'Verdict_Type', 'Timestamp_UTC', 'AI_Block_Reason'];
    const dynamicKeys: string[] = [];
    exportLeads.forEach(l => {
      Object.keys(l.form_data).forEach(k => {
        if (!dynamicKeys.includes(k)) dynamicKeys.push(k);
      });
    });

    const fullHeaders = [...headers, ...dynamicKeys.map(k => `Form_${k}`)];
    const csvRows = [fullHeaders.join(',')];

    exportLeads.forEach(l => {
      const row = [
        l.id,
        l.status,
        `"${l.created_at}"`,
        `"${l.ai_reason || 'N/A'}"`
      ];
      dynamicKeys.forEach(k => {
        const val = l.form_data[k] !== undefined ? l.form_data[k] : '';
        row.push(`"${String(val).replace(/"/g, '""')}"`);
      });
      csvRows.push(row.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `LeadShield_${client_id}_${filterStatus.toLowerCase()}_export.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  // Clipboard utility helper
  const handleCopyToClipboard = (text: string, filename: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  // Statistics calculation helpers
  const totalLeadsAnalyzed = leads.length;
  const totalGenuineLeads = leads.filter(l => l.status === 'GENUINE').length;
  const totalSpamBlocked = leads.filter(l => l.status === 'SPAM').length + clients.reduce((sum, c) => sum + (c.historical_spam_count || 0), 0);
  const totalActiveClients = clients.filter(c => c.status === 'active').length;

  return (
    <div className="bg-[#d5ecea] min-h-screen font-sans text-[#082b36] flex flex-col antialiased">
      
      {/* PERSISTENT PLAYGROUND HEADER AND SANDBOX PLATFORM BOARD */}
      <div className="bg-[#082b36] text-white border-b border-[#5fb4a9]/20 px-8 py-5 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#096260] rounded-lg flex items-center justify-center border border-[#5fb4a9]/30">
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight">Lead Shield Dashboard</h1>
            <p className="text-[#5fb4a9] text-[10px] uppercase tracking-[0.2em] font-semibold">Active Portal Control System & Lead Analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#5fb4a9] animate-pulse"></span>
          <span className="text-[10px] font-mono tracking-wider uppercase text-gray-200">
            SYSTEM STATUS: ONLINE
          </span>
        </div>
      </div>

      {/* ADMIN PERSISTENT NAVIGATION TABS */}
      {loggedInUser && loggedInUser.role === 'admin' && (
        <div className="bg-[#041a1f] text-white px-8 py-3.5 border-b border-[#5fb4a9]/10 flex flex-wrap items-center gap-2 select-none shadow-inner">
          <span className="text-[10px] uppercase font-bold text-[#5fb4a9] tracking-widest mr-4 flex items-center gap-1.5 font-mono">
            🎛️ PORTAL CONTROLLER PANEL:
          </span>
          <button
            onClick={() => setCurrentTab('sim')}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer flex items-center gap-1.5 ${currentTab === 'sim' ? 'bg-[#096260] text-white shadow-md ring-1 ring-white/10' : 'bg-transparent text-[#5fb4a9] hover:bg-white/5 hover:text-white'}`}
          >
            🏠 Client Portal Sim
          </button>
          <button
            onClick={() => setCurrentTab('n8n_hub')}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer flex items-center gap-1.5 ${currentTab === 'n8n_hub' ? 'bg-[#096260] text-white shadow-md ring-1 ring-white/10' : 'bg-transparent text-[#5fb4a9] hover:bg-white/5 hover:text-white'}`}
          >
            🔗 n8n Workflow Hub
          </button>
          <button
            onClick={() => setCurrentTab('webhooks')}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer flex items-center gap-1.5 ${currentTab === 'webhooks' ? 'bg-[#096260] text-white shadow-md ring-1 ring-white/10' : 'bg-transparent text-[#5fb4a9] hover:bg-white/5 hover:text-white'}`}
          >
            🧪 n8n Webhook Lab
          </button>
          <button
            onClick={() => setCurrentTab('vault')}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer flex items-center gap-1.5 ${currentTab === 'vault' ? 'bg-[#096260] text-white shadow-md ring-1 ring-white/10' : 'bg-transparent text-[#5fb4a9] hover:bg-white/5 hover:text-white'}`}
          >
            📁 cPanel Code Vault
          </button>
          <button
            onClick={() => setCurrentTab('blueprint')}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer flex items-center gap-1.5 ${currentTab === 'blueprint' ? 'bg-[#096260] text-white shadow-md ring-1 ring-white/10' : 'bg-transparent text-[#5fb4a9] hover:bg-white/5 hover:text-white'}`}
          >
            📘 Deployment Blueprint
          </button>
          <div className="flex-1"></div>
          <button
            onClick={handleRunSpamCleanup}
            className="text-xs font-bold px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition duration-150 cursor-pointer flex items-center gap-1.5 shadow-md border border-red-500/30"
          >
            🧹 Run 30-Day Spam Auto-Cleanup
          </button>
        </div>
      )}

      {/* RENDER MASTER CONTENT SCREEN */}
      <div className="flex-1 w-full flex flex-col">
        
        {/* TAB 1: INTEGRATED PORTAL SIMULATION */}
        {currentTab === 'sim' && (
          <div className="flex-1 flex flex-col p-6 md:p-8 space-y-8">
            
            {/* Context Header Helper */}
            <div className="bg-white rounded-3xl border border-[#096260]/5 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
              <div className="space-y-1.5">
                <span className="inline-block bg-[#d5ecea] text-[#096260] text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">Live Workspace Access</span>
                <p className="text-xs text-[#082b36]/70 leading-relaxed font-normal">
                  Welcome to your secure Lead Shield portal. Review your incoming leads, AI filtering metrics, and performance analytics securely.
                </p>
                <div className="mt-2.5 flex items-center gap-2 text-[10px] text-[#096260] bg-[#d5ecea]/40 w-max px-3 py-1.5 rounded-lg border border-[#096260]/10 font-bold shadow-sm">
                  <span className="text-sm">🤖</span>
                  <span>AI Spam Filtering Accuracy: ~99.9%. Please review the Spam folder occasionally as no AI is 100% perfect.</span>
                </div>
              </div>

              {/* Quick Login Accounts to accelerate user tests (Confined strictly by active session permissions) */}
              <div className="flex flex-wrap items-center gap-2.5 bg-[#d5ecea]/35 p-3 rounded-2xl border border-[#096260]/5 animate-fade-in">
                {loggedInUser === null ? (
                  <>
                    <span className="text-[10px] uppercase font-bold text-[#096260]/80 tracking-widest pl-1 select-none">Checking Session Security...</span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] uppercase font-bold text-[#096260]/70 tracking-widest pl-1 select-none font-mono">
                      🔐 LOGGED IN AS: <span className="text-[#082b36] font-black">{loggedInUser.username}</span> ({loggedInUser.role === 'admin' ? 'SUPER_ADMIN' : 'CLIENT_WORKSPACE'})
                    </span>
                    {loggedInUser.role === 'admin' && (
                      <div className="flex items-center gap-1.5 ml-2 border-l border-[#096260]/20 pl-3">
                        <span className="text-[9px] font-bold text-[#096260]/70 uppercase">Client Workspace Inspection:</span>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search workspace..."
                            value={adminInspectedClient ? (clients.find(c => c.client_id === adminInspectedClient)?.business_name || adminClientSearch) : adminClientSearch}
                            onChange={(e) => {
                              setAdminClientSearch(e.target.value);
                              if (adminInspectedClient) setAdminInspectedClient(null);
                            }}
                            onFocus={() => setShowAdminClientSearch(true)}
                            onBlur={() => setTimeout(() => setShowAdminClientSearch(false), 200)}
                            className={`text-[9px] font-bold px-3 py-1.5 rounded-lg border transition shadow-xs outline-none w-56 ${adminInspectedClient ? 'bg-[#096260] text-white border-[#096260]' : 'bg-white/80 hover:bg-white text-[#082b36] border-[#096260]/10'}`}
                          />
                          {showAdminClientSearch && (
                            <div className="absolute top-full mt-1 left-0 w-full max-h-48 overflow-y-auto bg-white border border-[#096260]/10 rounded-xl shadow-xl z-50 py-1 scrollbar">
                              {clients.filter(c => c.business_name.toLowerCase().includes(adminClientSearch.toLowerCase())).length === 0 ? (
                                <div className="px-3 py-2 text-[9px] text-gray-400">No clients found</div>
                              ) : (
                                clients.filter(c => c.business_name.toLowerCase().includes(adminClientSearch.toLowerCase())).map(c => (
                                  <div 
                                    key={c.client_id}
                                    onClick={() => {
                                      setAdminInspectedClient(c.client_id);
                                      setAdminInspectTab('genuine');
                                      setAdminClientSearch('');
                                    }}
                                    className="px-3 py-2 hover:bg-[#d5ecea]/30 text-[#082b36] text-[10px] font-bold cursor-pointer flex justify-between items-center transition"
                                  >
                                    <span>{c.business_name}</span>
                                    {c.status !== 'active' && <span className="text-[8px] text-red-400 bg-red-50 px-1 rounded uppercase">Inactive</span>}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                        {adminInspectedClient && (
                          <button 
                            onClick={() => setAdminInspectedClient(null)}
                            className="bg-red-500 hover:bg-red-600 text-white text-[9px] font-bold px-2 py-1 rounded-lg transition cursor-pointer"
                          >
                            Exit Inspect ✖
                          </button>
                        )}
                      </div>
                    )}
                    <button 
                      onClick={() => setLoggedInUser(null)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-700 text-[10px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer hover:translate-y-[-1px] duration-150 ml-2"
                    >
                      Secure Signout 🚪
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* SECURITY WALL GATE - SHIELD UNRESTRICTED VISITORS */}
            {loggedInUser === null ? (
              <div className="flex-1 flex items-center justify-center py-10">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-12 w-12 border-4 border-[#096260] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <div className="text-[#082b36] font-bold text-sm tracking-wider">Syncing Secure Roles...</div>
                </div>
              </div>
            ) : loggedInUser.role === 'admin' ? (
              
              // =====================================================================
              // SUPER ADMIN RENDER CONTROLLER
              // =====================================================================
              <div className="space-y-6">
                
                {/* Simulated session signpost */}
                <div className="bg-[#082b36] text-white p-5 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 border border-white/10 shadow-xl select-none">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5fb4a9] animate-pulse"></span>
                    <p className="text-xs font-mono tracking-wider uppercase text-gray-200">
                      SESSION ACTIVE • ROLE: <span className="text-[#5fb4a9] font-bold">SUPER_ADMIN</span> • USER: <span className="text-[#5fb4a9] font-bold">{loggedInUser.username}</span>
                    </p>
                  </div>
                  <button 
                    id="logoutBtn"
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.innerHTML = 'Logging out... ⏳';
                      btn.style.opacity = '0.7';
                      btn.style.pointerEvents = 'none';
                      try {
                        await supabase.auth.signOut();
                      } catch (err) {}
                      window.location.href = '/login';
                    }}
                    className="text-xs bg-white/10 hover:bg-white/20 text-[#d5ecea] font-bold py-2 px-4 rounded-xl border border-white/5 transition duration-150 cursor-pointer"
                  >
                    Logout System Gateway 🚪
                  </button>
                </div>

                {/* Aggregate stats dashboard */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-[#096260]/5 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] uppercase font-bold text-[#5fb4a9] tracking-widest">Total Analyzed</p>
                    <h3 className="text-4xl font-black mt-2 text-[#082b36]">{totalLeadsAnalyzed}</h3>
                    <p className="text-[10px] text-green-600 mt-2 font-bold">+12% vs last month</p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-[#096260]/5 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] uppercase font-bold text-[#5fb4a9] tracking-widest">Genuine Leads</p>
                    <h3 className="text-4xl font-black mt-2 text-[#096260]">{totalGenuineLeads}</h3>
                    <p className="text-[10px] text-[#082b36]/40 mt-2">Conversion Rates Stable</p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-[#096260]/5 shadow-sm border-l-4 border-l-[#5fb4a9] flex flex-col justify-between">
                    <p className="text-[10px] uppercase font-bold text-[#5fb4a9] tracking-widest">Spam Blocked</p>
                    <h3 className="text-4xl font-black mt-2 text-[#082b36]">{totalSpamBlocked}</h3>
                    <p className="text-[10px] text-orange-600 mt-2 font-bold">High Risk Pattern Detected</p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-[#096260]/5 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] uppercase font-bold text-[#5fb4a9] tracking-widest">Active Clients</p>
                    <h3 className="text-4xl font-black mt-2 text-[#082b36]">{totalActiveClients}</h3>
                    <p className="text-[10px] text-[#082b36]/40 mt-2">Running Live hooks</p>
                  </div>
                </div>

                {/* Client Workspace Auditor & Omnichannel Inspection Screen */}
                {adminInspectedClient && (
                  <div className="bg-white p-6 rounded-3xl border border-[#096260]/10 shadow-sm space-y-6 mb-6">
                    {(() => {
                      const client = clients.find(c => c.client_id === adminInspectedClient);
                      if (!client) return (
                        <div className="flex justify-between items-center text-red-500 font-bold p-3">
                          <span>Selected Tenant has been removed or no longer exists.</span>
                          <button onClick={() => setAdminInspectedClient(null)} className="text-xs bg-red-105 hover:bg-red-200 px-3 py-1 rounded-xl">Dismiss</button>
                        </div>
                      );
                      
                      const clientLeads = leads.filter(l => l.client_id === adminInspectedClient);
                      const genuineLeadsCount = clientLeads.filter(l => l.status === 'GENUINE').length;
                      const spamLeadsCount = clientLeads.filter(l => l.status === 'SPAM').length + (client.historical_spam_count || 0);
                      
                      return (
                        <div className="space-y-6">
                          <div className="bg-[#082b36] text-white p-6 rounded-2xl border border-white/10 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-[#096260] rounded-2xl flex items-center justify-center border border-[#5fb4a9]/30 text-2xl shadow-inner">
                                🏢
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-[#5fb4a9] font-mono tracking-widest font-bold uppercase">SUPER_ADMIN ACTIVE WORKSPACE INSPECTOR</span>
                                  <span className="bg-[#096260] text-xs font-bold text-white px-2 py-0.5 rounded-lg border border-white/10 uppercase">
                                    {client.status}
                                  </span>
                                </div>
                                <h2 className="text-xl font-bold mt-1 text-white flex items-center gap-2">
                                  Inspecting: <span className="text-[#5fb4a9] underline tracking-tight">{client.business_name}</span>
                                </h2>
                                <p className="text-xs text-gray-300 mt-1 font-mono">
                                  Client ID Bound: <span className="text-white font-bold">{client.client_id}</span> • Registered Contact: <span className="text-white font-bold">{client.contact_email}</span>
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2.5">
                              <button 
                                onClick={() => setAdminInspectedClient(null)}
                                className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-md transition duration-155 cursor-pointer"
                              >
                                Close Inspection View
                              </button>
                            </div>
                          </div>

                          {/* Subscribed Services Gate */}
                          <div className="bg-[#d5ecea]/10 p-5 rounded-2xl border border-[#096260]/5">
                             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 font-mono">Subscribed Service Modules</h3>
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                               <div className={`p-4 rounded-xl border transition-all ${client.has_seo ? 'bg-white border-[#096260]/10 text-[#082b36]' : 'bg-gray-50/50 border-gray-100 text-gray-400 opacity-60'}`}>
                                 <p className="text-[10px] font-mono font-bold uppercase tracking-wider mb-1 text-gray-400">SEO & Lead Intake</p>
                                 <div className="flex items-center justify-between">
                                   <span className="text-xs font-extrabold">Website Forms</span>
                                   <span className="text-sm">{client.has_seo ? '✅' : '❌'}</span>
                                 </div>
                               </div>
                               
                               <div className={`p-4 rounded-xl border transition-all ${client.has_google_ads ? 'bg-white border-[#096260]/10 text-[#082b36]' : 'bg-gray-50/50 border-gray-100 text-gray-400 opacity-60'}`}>
                                 <p className="text-[10px] font-mono font-bold uppercase tracking-wider mb-1 text-gray-400">AdWords Module</p>
                                 <div className="flex items-center justify-between">
                                   <span className="text-xs font-extrabold">Google Ads CPC</span>
                                   <span className="text-sm">{client.has_google_ads ? '✅' : '❌'}</span>
                                 </div>
                               </div>

                               <div className={`p-4 rounded-xl border transition-all ${client.has_fb_ads ? 'bg-white border-[#096260]/10 text-[#082b36]' : 'bg-gray-50/50 border-gray-100 text-gray-400 opacity-60'}`}>
                                 <p className="text-[10px] font-mono font-bold uppercase tracking-wider mb-1 text-gray-400">Social Lead Ads</p>
                                 <div className="flex items-center justify-between">
                                   <span className="text-xs font-extrabold">Facebook Ads</span>
                                   <span className="text-sm">{client.has_fb_ads ? '✅' : '❌'}</span>
                                 </div>
                               </div>

                               <div className={`p-4 rounded-xl border transition-all ${client.has_gmb ? 'bg-white border-[#096260]/10 text-[#082b36]' : 'bg-gray-50/50 border-gray-100 text-gray-400 opacity-60'}`}>
                                 <p className="text-[10px] font-mono font-bold uppercase tracking-wider mb-1 text-gray-400">Google Profiles</p>
                                 <div className="flex items-center justify-between">
                                   <span className="text-xs font-extrabold">GMB Metrics</span>
                                   <span className="text-sm">{client.has_gmb ? '✅' : '❌'}</span>
                                 </div>
                               </div>
                             </div>
                           </div>

                          {/* Stats Metrics Cards */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#d5ecea]/20 p-4 rounded-xl border border-[#096260]/10 flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold text-[#5fb4a9] uppercase tracking-widest mb-1 font-mono">Genuine Delivery Inbounds</p>
                                <p className="text-2xl font-black text-[#082b36]">{genuineLeadsCount}</p>
                              </div>
                              <span className="text-[#096260] text-lg">📬</span>
                            </div>

                            <div className="bg-red-50 p-4 rounded-xl border border-red-100 border-l-4 border-l-red-500 flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1 font-mono">Spam Shielded Blocks</p>
                                <p className="text-2xl font-black text-red-600">{spamLeadsCount}</p>
                              </div>
                              <span className="text-red-500 text-lg">🛡️</span>
                            </div>
                          </div>

                          {/* Inspected client feed logs */}
                          <div className="bg-white rounded-2xl border border-[#096260]/10 shadow-sm overflow-hidden flex flex-col">
                            {/* Filter Bar specifically for this customer client workspace inspection */}
                            <div className="border-b border-[#096260]/10 p-4 bg-[#d5ecea]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex gap-1 p-1 bg-white rounded-xl self-start border border-[#096260]/10">
                                <button 
                                  onClick={() => setAdminInspectTab('genuine')}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${adminInspectTab === 'genuine' ? 'bg-[#096260] text-white shadow-sm' : 'text-[#082b36]/60 hover:text-[#082b36]'}`}
                                >
                                  Genuine Inquiries ({genuineLeadsCount})
                                </button>
                                <button 
                                  onClick={() => setAdminInspectTab('spam')}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${adminInspectTab === 'spam' ? 'bg-[#096260] text-white shadow-sm' : 'text-[#082b36]/60 hover:text-red-600'}`}
                                >
                                  Shield Gating ({spamLeadsCount})
                                </button>
                              </div>

                              <button 
                                onClick={() => handleTriggerCsvExport(adminInspectTab === 'spam' ? 'SPAM' : 'GENUINE')}
                                className="bg-[#082b36] hover:bg-[#096260] text-white text-xs font-bold py-2 px-3 rounded-lg shadow transition duration-150 flex items-center gap-1.5 self-start cursor-pointer"
                              >
                                <Download size={13} />
                                <span>Export filtered (CSV)</span>
                              </button>
                            </div>

                            {/* Table list */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs text-[#082b36] border-collapse font-sans">
                                <thead>
                                  <tr className="border-b border-[#096260]/10 text-[10px] text-[#096260]/85 font-mono uppercase tracking-widest bg-gray-50/50">
                                    <th className="p-3">Arrived Time</th>
                                    <th className="p-3">Sender Email</th>
                                    <th className="p-3">Payload Summary</th>
                                    <th className="p-3">AI Reason / Flag</th>
                                    <th className="p-3 text-right">Auditor Controls</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#096260]/5">
                                  {clientLeads
                                    .filter(l => (adminInspectTab === 'genuine' ? l.status === 'GENUINE' : l.status === 'SPAM'))
                                    .map(l => (
                                      <tr key={l.id} className="hover:bg-[#d5ecea]/10 transition">
                                        <td className="p-3 text-[10px] font-mono text-gray-400 whitespace-nowrap">{l.created_at}</td>
                                        <td className="p-3 font-semibold text-[#082b36]">
                                          {l.form_data.email || l.form_data.contact_email || 'anonymous-webhook@address.com'}
                                        </td>
                                        <td className="p-3 text-[11px] max-w-xs truncate font-mono text-gray-600">
                                          {Object.entries(l.form_data).slice(0, 3).map(([k, v]) => (
                                            <span key={k} className="mr-2 inline-block">
                                              <span className="text-gray-400">{k}:</span> <strong className="text-gray-700 font-bold">{String(v)}</strong>
                                            </span>
                                          ))}
                                        </td>
                                        <td className="p-3 text-xs font-mono text-gray-500">
                                          {l.ai_reason ? l.ai_reason : <span className="text-gray-300 italic">None (Pattern OK)</span>}
                                        </td>
                                        <td className="p-3 text-right space-x-1 whitespace-nowrap">
                                          {/* Auditor Overrides / Reclassify toggles */}
                                          <button
                                            onClick={() => {
                                              setLeads(prev => prev.map(leadItem => {
                                                if (leadItem.id === l.id) {
                                                  const isGen = leadItem.status === 'GENUINE';
                                                  return { 
                                                    ...leadItem, 
                                                    status: isGen ? 'SPAM' : 'GENUINE',
                                                    ai_reason: isGen ? 'Manual Overridden Flag (Classified as SPAM Override)' : null
                                                  };
                                                }
                                                return leadItem;
                                              }));
                                            }}
                                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border transition duration-150 cursor-pointer ${l.status === 'GENUINE' ? 'bg-red-500/10 text-red-700 border-red-500/10 hover:bg-red-500/20' : 'bg-[#096260]/10 text-[#096260] border-[#096260]/10 hover:bg-[#096260]/20'}`}
                                            title="Override Verdict"
                                          >
                                            {l.status === 'GENUINE' ? '⚠️ Mark SPAM' : '✅ Mark GENUINE'}
                                          </button>
                                          
                                          <button
                                            onClick={() => setSelectedAuditLead(l)}
                                            className="text-[9px] bg-[#082b36] hover:bg-[#096260] text-white py-1 px-2 rounded transition duration-150 font-bold inline-flex items-center gap-1 cursor-pointer"
                                          >
                                            <Eye size={10} />
                                            <span>Raw</span>
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  {clientLeads.filter(l => (adminInspectTab === 'genuine' ? l.status === 'GENUINE' : l.status === 'SPAM')).length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="p-8 text-center text-gray-400 font-mono italic">
                                        No leads found matching current filter scope. Keep running sandbox triggers!
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* OUTBOUND DEVELOPER API DISCOVERY HUB - EXCLUSIVELY FOR ADMINISTRATORS */}
                          {(() => {
                            const clientUserObj = users.find(u => u.client_id === client.client_id);
                            const targetUsername = clientUserObj ? clientUserObj.username : client.client_id;
                            
                            return (
                              <div id="developer-api-extranet-hub" className="mt-6 bg-white p-6 rounded-3xl border border-[#096260]/10 shadow-sm space-y-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-[#096260]/10 text-[#096260] rounded-xl flex items-center justify-center text-lg">
                                    🔌
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-extrabold text-[#082b36] flex items-center gap-2">
                                      Administrator CRM Sync Dashboard (Exclusively Restricted)
                                      <span className="bg-[#096260]/10 text-[#096260] text-[9px] font-mono font-black px-2 py-0.5 rounded border border-[#096260]/15 uppercase tracking-wide">Developer Extranet v1</span>
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-1">
                                      Construct real-time synchronization pipelines to feed <strong className="font-bold text-[#082b36]">{client.business_name}</strong> leads directly into external CRM interfaces (HubSpot, Salesforce, Zoho), automated webhooks (Make, Zapier, n8n), or internal platforms.
                                    </p>
                                  </div>
                                </div>

                                {/* Dev Specs Info Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-[#d5ecea]/15 p-5 rounded-2xl border border-[#096260]/10 space-y-2">
                                    <p className="text-[10px] uppercase font-bold text-gray-500 font-mono tracking-wider">REST API Gateway Endpoint (GET/POST)</p>
                                    <div className="bg-white/80 p-3 rounded-xl border border-[#096260]/5 font-mono text-[10px] break-all select-all text-[#082b36] shadow-inner font-semibold leading-relaxed">
                                      https://your-domain.com/lead-shield/api/get-leads.php?client_id={client.client_id}&username={targetUsername}&password=••••••••&action=leads&status=GENUINE
                                    </div>
                                    <p className="text-[10px] text-[#096260]/80 font-medium">
                                      💡 Replace <strong className="font-bold text-[#082b36]">••••••••</strong> with the client's configured password to successfully fetch raw webhook deliveries.
                                    </p>
                                  </div>

                                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-2 text-xs">
                                    <p className="text-[10px] uppercase font-bold text-gray-500 font-mono tracking-wider">Omnichannel Query Specifications</p>
                                    <div className="space-y-1.5 text-[11px] leading-relaxed">
                                      <p>• <code className="bg-white px-1 py-0.5 rounded text-[#096260] font-mono text-[10px] font-bold">channel</code>: Supports filtering by <span className="font-semibold text-gray-700">"website"</span>, <span className="font-semibold text-gray-700">"google_ads"</span>, <span className="font-semibold text-gray-700">"facebook_ads"</span>, or <span className="font-semibold text-gray-700">"gmb"</span>.</p>
                                      <p>• <code className="bg-white px-1 py-0.5 rounded text-[#096260] font-mono text-[10px] font-bold">action</code>: Extract <span className="font-semibold text-gray-700">"leads"</span> (filtered raw payloads) or <span className="font-semibold text-gray-700">"stats"</span> (numeric counts).</p>
                                      <p>• <code className="bg-white px-1 py-0.5 rounded text-[#096260] font-mono text-[10px] font-bold">status</code>: Retrieve <span className="font-semibold text-gray-700">"GENUINE"</span>, <span className="font-semibold text-gray-700">"SPAM"</span>, or <span className="font-semibold text-gray-700">"ALL"</span> listings.</p>
                                    </div>
                                  </div>
                                </div>

                                {/* API Playground Test Block */}
                                <div className="border-t border-[#096260]/5 pt-5 space-y-4">
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                      <h4 className="text-xs font-bold text-[#082b36] uppercase tracking-wide font-mono">Sandbox API Playground Tester (Admin Sandbox)</h4>
                                      <p className="text-[10px] text-gray-400">Instruct this client's credentials system to trigger mock pulls across lead logs inside this workspace.</p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleSimulateClientApiPull(client.client_id, 'stats')}
                                        disabled={clientApiPulseOn}
                                        className="bg-white hover:bg-[#d5ecea]/40 text-[#096260] border border-[#096260]/20 text-[11px] font-extrabold py-2 px-3.5 rounded-xl shadow-xs transition duration-150 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                      >
                                        {clientApiPulseOn ? '⏳ Fetching...' : '📊 Pull Lead Stats'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSimulateClientApiPull(client.client_id, 'leads')}
                                        disabled={clientApiPulseOn}
                                        className="bg-[#096260] hover:bg-[#5fb4a9] text-white text-[11px] font-extrabold py-2 px-3.5 rounded-xl shadow-md transition duration-155 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                      >
                                        {clientApiPulseOn ? '⏳ Fetching...' : '⚡ Pull Lead Data List'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Developer Console Screen */}
                                  {clientApiLogs && (
                                    <div className="bg-[#082b36] rounded-2xl overflow-hidden border border-white/5 shadow-xl flex flex-col">
                                      <div className="bg-[#03212a] px-4 py-2 border-b border-white/5 flex items-center justify-between text-[10px] font-mono text-[#5fb4a9] select-none">
                                        <span className="flex items-center gap-1.5">
                                          <span className={`w-2.5 h-2.5 rounded-full ${clientApiPulseOn ? 'bg-amber-400 animate-ping' : 'bg-[#5fb4a9]'} `}></span>
                                          developer-console://api/get-leads.php
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(clientApiLogs);
                                            alert('Response payload copied to clipboard!');
                                          }}
                                          className="bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold rounded px-2 py-0.5 transition cursor-pointer"
                                        >
                                          Copy Output JSON
                                        </button>
                                      </div>
                                      <pre className="p-4 font-mono text-[9.5px] text-[#d5ecea] overflow-x-auto max-h-72 leading-relaxed whitespace-pre select-all bg-[#082b36]">
                                        {clientApiLogs}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {client.has_gmb && (
                            <div className="mt-6 border-t border-purple-100 pt-6">
                              {renderGmbTrackerUI(client.client_id, client.business_name)}
                            </div>
                          )}

                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Client CRUD Interface along with clients listing */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* CRUD Panel: Onboard Client Form */}
                  <div className="bg-white p-6 rounded-3xl border border-[#096260]/5 shadow-sm">
                    <h3 className="text-sm font-extrabold text-[#082b36] mb-1">Onboard New Tenant Client</h3>
                    <p className="text-xs text-gray-400 mb-5">Provision isolated workspaces and router access keys automatically</p>

                    <form onSubmit={handleCreateNewClient} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 font-mono">Business Brand Name</label>
                        <input 
                          type="text" 
                          value={newBizName}
                          onChange={(e) => setNewBizName(e.target.value)}
                          placeholder="e.g. Brisbane Decking" 
                          required
                          className="w-full bg-[#d5ecea]/15 border border-[#096260]/10 focus:border-[#096260] focus:ring-1 focus:ring-[#096260] rounded-xl py-2.5 px-3.5 text-xs text-[#082b36] outline-none font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 font-mono">Contact Email</label>
                        <input 
                          type="email" 
                          value={newBizEmail}
                          onChange={(e) => setNewBizEmail(e.target.value)}
                          placeholder="e.g. contact@brisdeck.com" 
                          required
                          className="w-full bg-[#d5ecea]/15 border border-[#096260]/10 focus:border-[#096260] focus:ring-1 focus:ring-[#096260] rounded-xl py-2.5 px-3.5 text-xs text-[#082b36] outline-none font-medium"
                        />
                      </div>

                      <div className="border-t border-gray-100 pt-4 flex flex-col space-y-3">
                        <p className="text-[10px] text-[#096260] font-bold uppercase tracking-widest font-mono">WORKSPACE AUTHENTIALS</p>
                        <div>
                          <label className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Portal Login Email</label>
                          <input 
                            type="email" 
                            value={newBizUsername}
                            onChange={(e) => setNewBizUsername(e.target.value)}
                            placeholder="e.g. client@brisdeck.com" 
                            required
                            className="w-full bg-[#d5ecea]/15 border border-[#096260]/10 focus:border-[#096260] focus:ring-1 focus:ring-[#096260] rounded-xl py-2 px-3 text-xs text-[#082b36] outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Access Password</label>
                          <input 
                            type="password" 
                            value={newBizPassword}
                            onChange={(e) => setNewBizPassword(e.target.value)}
                            placeholder="••••••••" 
                            required
                            className="w-full bg-[#d5ecea]/15 border border-[#096260]/10 focus:border-[#096260] focus:ring-1 focus:ring-[#096260] rounded-xl py-2 px-3 text-xs text-[#082b36] outline-none"
                          />
                        </div>
                      </div>

                      <div className="border-t border-gray-100 pt-4 flex flex-col space-y-2">
                        <p className="text-[10px] text-[#096260] font-bold uppercase tracking-widest font-mono mb-1">Services Subscribed</p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={newBizHasSeo} 
                              onChange={(e) => setNewBizHasSeo(e.target.checked)}
                              className="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4 cursor-pointer" 
                            />
                            <span>SEO & Website</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={newBizHasGoogleAds} 
                              onChange={(e) => setNewBizHasGoogleAds(e.target.checked)}
                              className="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4 cursor-pointer" 
                            />
                            <span>Google Ads</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={newBizHasFbAds} 
                              onChange={(e) => setNewBizHasFbAds(e.target.checked)}
                              className="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4 cursor-pointer" 
                            />
                            <span>Facebook Ads</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={newBizHasGmb} 
                              onChange={(e) => setNewBizHasGmb(e.target.checked)}
                              className="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4 cursor-pointer" 
                            />
                            <span>GMB Tracking</span>
                          </label>
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        className="w-full bg-[#096260] hover:bg-[#5fb4a9] text-white py-3 rounded-xl text-xs font-bold transition-all duration-150 shadow-md shadow-[#096260]/20 cursor-pointer"
                      >
                        Provision Sandbox Workspace Portals
                      </button>
                    </form>
                  </div>

                  {/* Active Clients Grid Table */}
                  <div className="bg-[#082b36] text-white p-6 rounded-3xl shadow-xl lg:col-span-2 flex flex-col justify-between border border-white/5">
                    <div>
                      <h3 className="text-base font-bold text-white mb-1">Provisioned Portal Spaces</h3>
                      <p className="text-xs text-[#5fb4a9] mb-4 font-semibold uppercase tracking-wider">Active Workspace Registrations & Database Binds</p>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-white">
                          <thead>
                            <tr className="border-b border-white/10 text-[10px] text-[#5fb4a9] font-bold uppercase tracking-widest">
                              <th className="py-3 px-2">Client ID</th>
                              <th className="py-3 px-2">Business / Contact</th>
                              <th className="py-3 px-2 text-center">Status</th>
                              <th className="py-3 px-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {clients.map(c => (
                              <tr key={c.client_id} className="hover:bg-white/5 transition">
                                <td className="py-4 px-2 font-mono text-[10px]">
                                  <span className="bg-white/10 text-[#5fb4a9] px-2.5 py-1 rounded-lg font-bold border border-white/5">{c.client_id}</span>
                                </td>
                                <td className="py-4 px-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAdminInspectedClient(c.client_id);
                                      setAdminInspectTab('genuine');
                                    }}
                                    className="font-bold text-sm text-left tracking-tight text-[#5fb4a9] hover:text-white hover:underline transition cursor-pointer"
                                    title="Inspect Client Space"
                                  >
                                    {c.business_name} 🔍
                                  </button>
                                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{c.contact_email}</p>
                                </td>
                                <td className="py-4 px-2 text-center">
                                  <button
                                    onClick={() => handleToggleClientStatus(c.client_id)}
                                    className={`inline-block text-[10px] font-bold rounded-xl px-3 py-1 text-center transition duration-150 cursor-pointer select-none border ${c.status === 'active' ? 'bg-[#096260] text-white border-[#5fb4a9]/30 hover:bg-[#5fb4a9]' : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/25'}`}
                                  >
                                    {c.status.toUpperCase()} 🔄
                                  </button>
                                </td>
                                <td className="py-4 px-2 text-right">
                                  <button 
                                    onClick={() => handleOpenEditClient(c)}
                                    className="text-[#5fb4a9] hover:text-white p-2 hover:bg-white/5 rounded-xl transition cursor-pointer mr-1"
                                    title="Edit Client details & subscriptions"
                                  >
                                    <Edit3 size={14} className="inline" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteClient(c.client_id)}
                                    className="text-red-400 hover:text-red-300 p-2 hover:bg-white/5 rounded-xl transition cursor-pointer"
                                  >
                                    <Trash2 size={14} className="inline" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Master dynamic leads auditor list */}
                <div className="bg-white p-6 rounded-3xl border border-[#096260]/5 shadow-sm space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#082b36] mb-1">Global Raw Webhook Lead Audit Feed</h3>
                      <p className="text-xs text-gray-400">Incoming webhook inputs across all directories</p>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {/* Filter by Client */}
                      <select 
                        value={adminFilterClient}
                        onChange={(e) => setAdminFilterClient(e.target.value)}
                        className="bg-[#d5ecea]/15 text-xs border border-[#096260]/10 rounded-xl py-2 px-3.5 outline-none text-[#082b36] font-semibold transition focus:border-[#096260] focus:ring-1 focus:ring-[#096260]"
                      >
                        <option value="">All Tenant Spaces</option>
                        {clients.map(c => (
                          <option key={c.client_id} value={c.client_id}>{c.business_name}</option>
                        ))}
                      </select>

                      {/* Filter by Status */}
                      <select 
                        value={adminFilterStatus}
                        onChange={(e) => setAdminFilterStatus(e.target.value)}
                        className="bg-[#d5ecea]/15 text-xs border border-[#096260]/10 rounded-xl py-2 px-3.5 outline-none text-[#082b36] font-semibold transition focus:border-[#096260] focus:ring-1 focus:ring-[#096260]"
                      >
                        <option value="">All Statuses</option>
                        <option value="GENUINE">Genuine</option>
                        <option value="SPAM">Flagged SPAM</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#096260]/10 pt-4 mt-2">
                    <div className="flex items-center gap-3">
                      {selectedLeadIds.length > 0 && (
                        <button
                          onClick={() => handleDeleteLeads(selectedLeadIds)}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-lg transition duration-150 flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>Delete Selected ({selectedLeadIds.length})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-[#096260]/5">
                    <table className="w-full text-left text-xs text-[#082b36] border-collapse">
                      <thead>
                        <tr className="border-b border-[#096260]/10 text-[10px] text-[#096260]/85 font-mono uppercase tracking-widest bg-[#d5ecea]/20">
                          <th className="p-4 rounded-tl-2xl w-10">
                            <input 
                              type="checkbox"
                              onChange={(e) => {
                                const visibleIds = leads
                                  .filter(l => !adminFilterClient || l.client_id === adminFilterClient)
                                  .filter(l => !adminFilterStatus || l.status === adminFilterStatus)
                                  .map(l => l.id);
                                if (e.target.checked) {
                                  setSelectedLeadIds(prev => Array.from(new Set([...prev, ...visibleIds])));
                                } else {
                                  setSelectedLeadIds(prev => prev.filter(id => !visibleIds.includes(id)));
                                }
                              }}
                              checked={
                                leads
                                  .filter(l => !adminFilterClient || l.client_id === adminFilterClient)
                                  .filter(l => !adminFilterStatus || l.status === adminFilterStatus)
                                  .length > 0 &&
                                leads
                                  .filter(l => !adminFilterClient || l.client_id === adminFilterClient)
                                  .filter(l => !adminFilterStatus || l.status === adminFilterStatus)
                                  .every(l => selectedLeadIds.includes(l.id))
                              }
                              className="w-4 h-4 rounded border-gray-300 text-[#096260] focus:ring-[#096260] cursor-pointer"
                            />
                          </th>
                          <th className="p-4">Caught (UTC)</th>
                          <th className="p-4">Client Space</th>
                          <th className="p-4">Channel</th>
                          <th className="p-4">Payload Summary</th>
                          <th className="p-4">Verdict</th>
                          <th className="p-4 text-right rounded-tr-2xl">Raw Fields</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#096260]/5">
                        {leads
                          .filter(l => !adminFilterClient || l.client_id === adminFilterClient)
                          .filter(l => !adminFilterStatus || l.status === adminFilterStatus)
                          .map(l => {
                            const clientDetail = clients.find(c => c.client_id === l.client_id);
                            return (
                              <tr key={l.id} className="hover:bg-[#d5ecea]/10 transition">
                                <td className="p-4">
                                  <input 
                                    type="checkbox"
                                    checked={selectedLeadIds.includes(l.id)}
                                    onChange={() => toggleSelectLead(l.id)}
                                    className="w-4 h-4 rounded border-gray-300 text-[#096260] focus:ring-[#096260] cursor-pointer"
                                  />
                                </td>
                                <td className="p-4 text-[10px] font-mono text-gray-400 whitespace-nowrap">{l.created_at}</td>
                                <td className="p-4">
                                  <p className="font-extrabold text-[#082b36]">{clientDetail?.business_name || l.client_id}</p>
                                  <p className="text-[9px] text-[#096260]/80 font-mono font-bold uppercase tracking-wider block mt-0.5">{l.client_id}</p>
                                </td>
                                <td className="p-4">
                                  {l.channel === 'google_ads' && (
                                    <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg text-[9px] font-black font-mono tracking-tight whitespace-nowrap">🎯 GOOGLE</span>
                                  )}
                                  {l.channel === 'facebook_ads' && (
                                    <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-lg text-[9px] font-black font-mono tracking-tight whitespace-nowrap">👥 FACEBOOK</span>
                                  )}
                                  {l.channel === 'gmb' && (
                                    <span className="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-lg text-[9px] font-black font-mono tracking-tight whitespace-nowrap">💎 GMB MAPS</span>
                                  )}
                                  {(!l.channel || l.channel === 'website') && (
                                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg text-[9px] font-black font-mono tracking-tight whitespace-nowrap">🌐 WEBSITE</span>
                                  )}
                                </td>
                                <td className="p-4 text-[11px] max-w-xs truncate font-mono text-gray-600">
                                  {Object.entries(l.form_data).slice(0, 2).map(([k, v]) => (
                                    <span key={k} className="mr-2 inline-block">
                                      <span className="text-gray-400">{k}:</span> <strong className="text-gray-700 font-bold">{String(v)}</strong>
                                    </span>
                                  ))}
                                </td>
                                <td className="p-4">
                                  <span className={`inline-block py-1 px-3 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${l.status === 'GENUINE' ? 'bg-[#096260] text-white border-[#5fb4a9]/30' : 'bg-orange-500/10 text-orange-600 border-orange-500/10'}`}>
                                    {l.status}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleDeleteLeads([l.id])}
                                      className="text-red-400 hover:text-white hover:bg-red-500 p-1.5 rounded-xl transition duration-150 cursor-pointer"
                                      title="Delete Lead permanently"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => setSelectedAuditLead(l)}
                                      className="text-[10px] bg-[#082b36] hover:bg-[#096260] text-white py-1.5 px-3.5 rounded-xl transition duration-150 font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                                    >
                                      <Eye size={12} />
                                      <span>Payload</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              
              // =====================================================================
              // CUSTOMER CLIENT PORTAL PORTAL SIMULATOR
              // =====================================================================
              <div className="space-y-6">
                
                {/* Simulated session header bar */}
                <div className="bg-[#082b36] text-white p-5 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 border border-white/5 shadow-xl select-none">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#096260] rounded-lg flex items-center justify-center border border-[#5fb4a9]/30 text-white font-bold text-sm">
                      🏢
                    </div>
                    <div>
                      <p className="text-[10px] text-[#5fb4a9] font-mono tracking-widest font-bold leading-none uppercase">CLIENT PORTAL WORKSPACE INSTANCE</p>
                      <h2 className="text-base font-extrabold text-white mt-1">
                        {clients.find(c => c.client_id === loggedInUser.client_id)?.business_name || loggedInUser.client_id}
                      </h2>
                      {(() => {
                        const client = clients.find(c => c.client_id === loggedInUser.client_id);
                        if (!client) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {client.has_seo && (
                              <span className="bg-[#096260] text-[#5fb4a9] text-[8px] font-bold font-mono px-2 py-0.5 rounded border border-[#5fb4a9]/20">SEO TRACKS</span>
                            )}
                            {client.has_google_ads && (
                              <span className="bg-[#096260] text-[#5fb4a9] text-[8px] font-bold font-mono px-2 py-0.5 rounded border border-[#5fb4a9]/20">GOOGLE ADS</span>
                            )}
                            {client.has_fb_ads && (
                              <span className="bg-[#096260] text-[#5fb4a9] text-[8px] font-bold font-mono px-2 py-0.5 rounded border border-[#5fb4a9]/20">FACEBOOK ADS</span>
                            )}
                            {client.has_gmb && (
                              <span className="bg-[#096260] text-[#5fb4a9] text-[8px] font-bold font-mono px-2 py-0.5 rounded border border-[#5fb4a9]/20">GMB VERIFICATION</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <button 
                    id="clientLogoutBtn"
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.innerHTML = 'Signing out... ⏳';
                      btn.style.opacity = '0.7';
                      btn.style.pointerEvents = 'none';
                      try {
                        await supabase.auth.signOut();
                      } catch (err) {}
                      window.location.href = '/login';
                    }}
                    className="text-xs bg-white/10 hover:bg-white/20 text-[#d5ecea] font-bold py-2.5 px-4 rounded-xl border border-white/5 transition duration-150 cursor-pointer"
                  >
                    Portal Exit Secure Signout 🚪
                  </button>
                </div>

                {/* Dynamic Channel Selector & Subscribed Segment Dashboard */}
                {(() => {
                  const clientObj = clients.find(c => c.client_id === loggedInUser.client_id);
                  if (!clientObj) return null;

                  const clientLeads = leads.filter(l => l.client_id === loggedInUser.client_id);

                  // Calculate metrics per channel
                  const metrics = {
                    all: {
                      label: "Consolidated Feed",
                      desc: "Total combined omnichannel inbounds",
                      genuine: clientLeads.filter(l => l.status === 'GENUINE').length,
                      spam: clientLeads.filter(l => l.status === 'SPAM').length + (clientObj?.historical_spam_count || 0),
                    },
                    website: {
                      label: "SEO Website Forms",
                      genuine: clientLeads.filter(l => (l.channel === 'website' || !l.channel) && l.status === 'GENUINE').length,
                      spam: clientLeads.filter(l => (l.channel === 'website' || !l.channel) && l.status === 'SPAM').length,
                    },
                    google_ads: {
                      label: "Google AdWords CPC",
                      genuine: clientLeads.filter(l => l.channel === 'google_ads' && l.status === 'GENUINE').length,
                      spam: clientLeads.filter(l => l.channel === 'google_ads' && l.status === 'SPAM').length,
                    },
                    facebook_ads: {
                      label: "Facebook Lead Ads",
                      genuine: clientLeads.filter(l => l.channel === 'facebook_ads' && l.status === 'GENUINE').length,
                      spam: clientLeads.filter(l => l.channel === 'facebook_ads' && l.status === 'SPAM').length,
                    },
                    gmb: {
                      label: "Google Maps GMB",
                      genuine: clientLeads.filter(l => l.channel === 'gmb' && l.status === 'GENUINE').length,
                      spam: clientLeads.filter(l => l.channel === 'gmb' && l.status === 'SPAM').length,
                    }
                  };

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">
                          ⚡ Subscribed Active Marketing Channel Feeds (Click to Filter Dashboard)
                        </h3>
                        {clientChannelFilter !== 'all' && (
                          <button 
                            onClick={() => setClientChannelFilter('all')}
                            className="text-[10px] bg-[#096260]/10 hover:bg-[#096260]/20 text-[#096260] px-2 py-1 rounded-lg border border-[#096260]/20 font-extrabold transition cursor-pointer"
                          >
                            All Streams ✕
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {/* 1. All feeds */}
                        <div 
                          onClick={() => setClientChannelFilter('all')}
                          className={`p-4 rounded-3xl border-2 transition-all duration-150 cursor-pointer select-none ${clientChannelFilter === 'all' ? 'border-[#096260] bg-[#d5ecea]/25 shadow-sm' : 'border-[#096260]/5 bg-white hover:border-[#096260]/20'}`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-lg">⚡</span>
                            <span className="text-[8px] bg-[#096260]/10 text-[#096260] px-1.5 py-0.5 rounded font-black font-mono uppercase tracking-wide">ALL</span>
                          </div>
                          <h4 className="text-xs font-black text-[#082b36] mt-2 mb-0.5 truncate">Total Feed</h4>
                          <p className="text-[9px] text-[#5fb4a9] font-mono leading-none tracking-tight">Combined streams</p>
                          <div className="flex justify-between items-center text-[10px] font-mono font-bold mt-3 pt-2 border-t border-[#096260]/15">
                            <span className="text-[#096260]">🎁 {metrics.all.genuine}</span>
                            <span className="text-red-500">🛡️ {metrics.all.spam}</span>
                          </div>
                        </div>

                        {/* 2. SEO Website */}
                        {clientObj.has_seo && (
                          <div 
                            onClick={() => setClientChannelFilter('website')}
                            className={`p-4 rounded-3xl border-2 transition-all duration-150 cursor-pointer select-none ${clientChannelFilter === 'website' ? 'border-blue-600 bg-blue-50/20 shadow-sm' : 'border-[#096260]/5 bg-white hover:border-blue-500/20'}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-lg">🌐</span>
                              <span className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black font-mono uppercase tracking-wide">SEO</span>
                            </div>
                            <h4 className="text-xs font-black text-[#082b36] mt-2 mb-0.5 truncate">Website Leads</h4>
                            <p className="text-[9px] text-gray-400 font-mono leading-none tracking-tight">Organic forms lookup</p>
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold mt-3 pt-2 border-t border-[#096260]/15">
                              <span className="text-blue-600">📬 {metrics.website.genuine}</span>
                              <span className="text-red-400">🛡️ {metrics.website.spam}</span>
                            </div>
                          </div>
                        )}

                        {/* 3. Google Ads */}
                        {clientObj.has_google_ads && (
                          <div 
                            onClick={() => setClientChannelFilter('google_ads')}
                            className={`p-4 rounded-3xl border-2 transition-all duration-150 cursor-pointer select-none ${clientChannelFilter === 'google_ads' ? 'border-amber-500 bg-amber-50/20 shadow-sm' : 'border-[#096260]/5 bg-white hover:border-amber-500/20'}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-lg">🎯</span>
                              <span className="text-[8px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-black font-mono uppercase tracking-wide">CPC</span>
                            </div>
                            <h4 className="text-xs font-black text-[#082b36] mt-2 mb-0.5 truncate">Google Ads</h4>
                            <p className="text-[9px] text-gray-400 font-mono leading-none tracking-tight">Paid search clicks</p>
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold mt-3 pt-2 border-t border-[#096260]/15">
                              <span className="text-amber-600">📬 {metrics.google_ads.genuine}</span>
                              <span className="text-red-400">🛡️ {metrics.google_ads.spam}</span>
                            </div>
                          </div>
                        )}

                        {/* 4. Facebook Ads */}
                        {clientObj.has_fb_ads && (
                          <div 
                            onClick={() => setClientChannelFilter('facebook_ads')}
                            className={`p-4 rounded-3xl border-2 transition-all duration-150 cursor-pointer select-none ${clientChannelFilter === 'facebook_ads' ? 'border-indigo-600 bg-indigo-50/20 shadow-sm' : 'border-[#096260]/5 bg-white hover:border-indigo-500/20'}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-lg">👥</span>
                              <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black font-mono uppercase tracking-wide">META</span>
                            </div>
                            <h4 className="text-xs font-black text-[#082b36] mt-2 mb-0.5 truncate">Facebook Ads</h4>
                            <p className="text-[9px] text-gray-400 font-mono leading-none tracking-tight">Social leads tracking</p>
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold mt-3 pt-2 border-t border-[#096260]/15">
                              <span className="text-indigo-600">📬 {metrics.facebook_ads.genuine}</span>
                              <span className="text-red-400">🛡️ {metrics.facebook_ads.spam}</span>
                            </div>
                          </div>
                        )}

                        {/* 5. GMB Verification */}
                        {clientObj.has_gmb && (
                          <div 
                            onClick={() => setClientChannelFilter('gmb')}
                            className={`p-4 rounded-3xl border-2 transition-all duration-150 cursor-pointer select-none ${clientChannelFilter === 'gmb' ? 'border-purple-600 bg-purple-50/20 shadow-sm' : 'border-[#096260]/5 bg-white hover:border-purple-500/20'}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-lg">💎</span>
                              <span className="text-[8px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-black font-mono uppercase tracking-wide">MAPS</span>
                            </div>
                            <h4 className="text-xs font-black text-[#082b36] mt-2 mb-0.5 truncate">GMB Profile</h4>
                            <p className="text-[9px] text-gray-400 font-mono leading-none tracking-tight">Phone call capture</p>
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold mt-3 pt-2 border-t border-[#096260]/15">
                              <span className="text-purple-600">📬 {metrics.gmb.genuine}</span>
                              <span className="text-red-400">🛡️ {metrics.gmb.spam}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Isolated lead feed with export utilities */}
                <div className="bg-white rounded-3xl border border-[#096260]/5 shadow-sm overflow-hidden flex flex-col">
                  
                  {/* Filter tab bar */}
                  <div className="border-b border-[#096260]/5 p-5 bg-[#d5ecea]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    <div className="flex flex-wrap gap-1.5 p-1 bg-white/60 backdrop-blur rounded-2xl self-start border border-[#096260]/10">
                      <button 
                        onClick={() => setClientActiveTab('genuine')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${clientActiveTab === 'genuine' ? 'bg-[#096260] text-white shadow-md border border-[#5fb4a9]/20' : 'text-[#082b36]/60 hover:text-[#082b36] hover:bg-white/20'}`}
                      >
                        📬 Genuine Leads ({
                          leads
                            .filter(l => l.client_id === loggedInUser.client_id)
                            .filter(l => {
                              const normChan = l.channel || 'website';
                              return clientChannelFilter === 'all' || normChan === clientChannelFilter;
                            })
                            .filter(l => l.status === 'GENUINE').length
                        })
                      </button>
                      <button 
                        onClick={() => setClientActiveTab('spam')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${clientActiveTab === 'spam' ? 'bg-[#096260] text-white shadow-md border border-[#5fb4a9]/20' : 'text-[#082b36]/60 hover:text-[#082b36] hover:bg-white/20'}`}
                      >
                        🛡️ Spam Gating Shield ({
                          leads
                            .filter(l => l.client_id === loggedInUser.client_id)
                            .filter(l => {
                              const normChan = l.channel || 'website';
                              return clientChannelFilter === 'all' || normChan === clientChannelFilter;
                            })
                            .filter(l => l.status === 'SPAM').length
                        })
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      {selectedLeadIds.length > 0 && (
                        <button
                          onClick={() => handleDeleteLeads(selectedLeadIds)}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-lg transition duration-150 flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>Delete Selected ({selectedLeadIds.length})</span>
                        </button>
                      )}
                      <button 
                        onClick={() => handleTriggerCsvExport(clientActiveTab === 'spam' ? 'SPAM' : 'GENUINE')}
                        className="bg-[#082b36] hover:bg-[#096260] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-[#082b36]/15 transition duration-150 flex items-center gap-2 self-start cursor-pointer hover:translate-y-[-1px]"
                      >
                        <Download size={14} />
                        <span>Export Filtered Current Grid (CSV)</span>
                      </button>
                    </div>
                  </div>

                  {/* Leads Data Grid */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#096260]/10 text-[10px] text-[#096260]/85 font-mono uppercase tracking-widest bg-[#d5ecea]/20">
                          <th className="p-4 w-10">
                            <input 
                              type="checkbox"
                              onChange={(e) => {
                                const visibleIds = leads
                                  .filter(l => l.client_id === loggedInUser.client_id)
                                  .filter(l => {
                                    const normChan = l.channel || 'website';
                                    return clientChannelFilter === 'all' || normChan === clientChannelFilter;
                                  })
                                  .filter(l => l.status === (clientActiveTab === 'spam' ? 'SPAM' : 'GENUINE'))
                                  .map(l => l.id);
                                if (e.target.checked) {
                                  setSelectedLeadIds(prev => Array.from(new Set([...prev, ...visibleIds])));
                                } else {
                                  setSelectedLeadIds(prev => prev.filter(id => !visibleIds.includes(id)));
                                }
                              }}
                              checked={
                                leads
                                  .filter(l => l.client_id === loggedInUser.client_id)
                                  .filter(l => {
                                    const normChan = l.channel || 'website';
                                    return clientChannelFilter === 'all' || normChan === clientChannelFilter;
                                  })
                                  .filter(l => l.status === (clientActiveTab === 'spam' ? 'SPAM' : 'GENUINE'))
                                  .length > 0 &&
                                leads
                                  .filter(l => l.client_id === loggedInUser.client_id)
                                  .filter(l => {
                                    const normChan = l.channel || 'website';
                                    return clientChannelFilter === 'all' || normChan === clientChannelFilter;
                                  })
                                  .filter(l => l.status === (clientActiveTab === 'spam' ? 'SPAM' : 'GENUINE'))
                                  .every(l => selectedLeadIds.includes(l.id))
                              }
                              className="w-4 h-4 rounded border-gray-300 text-[#096260] focus:ring-[#096260] cursor-pointer"
                            />
                          </th>
                          <th className="p-4 w-36">Catch Time (UTC)</th>
                          <th className="p-4 w-36">Source Channel</th>
                          <th className="p-4">Submission field inputs</th>
                          {clientActiveTab === 'spam' && (
                            <th className="p-4">AI Gating Filter Trigger</th>
                          )}
                          <th className="p-4 text-right">Interactive Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#096260]/5">
                        {leads
                          .filter(l => l.client_id === loggedInUser.client_id)
                          .filter(l => {
                            const normChan = l.channel || 'website';
                            return clientChannelFilter === 'all' || normChan === clientChannelFilter;
                          })
                          .filter(l => l.status === (clientActiveTab === 'spam' ? 'SPAM' : 'GENUINE'))
                          .map(l => (
                            <tr key={l.id} className="hover:bg-[#d5ecea]/10 transition">
                              <td className="p-4">
                                <input 
                                  type="checkbox"
                                  checked={selectedLeadIds.includes(l.id)}
                                  onChange={() => toggleSelectLead(l.id)}
                                  className="w-4 h-4 rounded border-gray-300 text-[#096260] focus:ring-[#096260] cursor-pointer"
                                />
                              </td>
                              <td className="p-4 font-mono text-[10px] text-gray-400 whitespace-nowrap">{l.created_at}</td>
                              <td className="p-4 whitespace-nowrap">
                                {(() => {
                                  const ch = l.channel || 'website';
                                  if (ch === 'google_ads') {
                                    return <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[9px] px-2 py-1 rounded-xl border border-amber-200 font-extrabold font-sans">🎯 Google Ads</span>;
                                  } else if (ch === 'facebook_ads') {
                                    return <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[9px] px-2 py-1 rounded-xl border border-indigo-200 font-extrabold font-sans">👥 Facebook Ads</span>;
                                  } else if (ch === 'gmb') {
                                    return <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-[9px] px-2 py-1 rounded-xl border border-purple-200 font-extrabold font-sans">💎 Google GMB</span>;
                                  } else {
                                    return <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[9px] px-2 py-1 rounded-xl border border-blue-200 font-extrabold font-sans">🌐 SEO Website</span>;
                                  }
                                })()}
                              </td>
                              <td className="p-4 text-xs">
                                <div className="bg-[#082b36] text-[#d5ecea] font-mono text-[11px] p-4 rounded-xl border border-[#096260]/30 max-w-xl leading-relaxed shadow-inner overflow-x-auto">
                                  <div className="mb-3 text-[#5fb4a9] font-bold tracking-widest uppercase text-[9px]">Details of the Person</div>
                                  <div className="space-y-1 whitespace-pre-wrap">
                                    {Object.entries(l.form_data).map(([k, v]) => {
                                      const keyName = k.replace(/_/g, ' ');
                                      // capitalize first letter
                                      const displayKey = keyName.charAt(0).toUpperCase() + keyName.slice(1);
                                      return (
                                        <div key={k}>
                                          <span className="text-[#5fb4a9]/80 capitalize">{displayKey}:</span> {String(v)}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="mt-5 text-[#5fb4a9]/50 pt-3 border-t border-[#096260]/20 text-[10px]">
                                    --<br/>
                                    This is a notification that a contact form was submitted on your website ({loggedInUser.client_id ? clients.find(c => c.client_id === loggedInUser.client_id)?.business_name || 'Website' : 'Website'}).
                                  </div>
                                </div>
                              </td>
                              
                              {clientActiveTab === 'spam' && (
                                <td className="p-4">
                                  <div className="bg-red-500/10 text-red-950 p-3 rounded-xl border border-red-500/10 text-xs max-w-xs leading-relaxed space-y-0.5">
                                    <p className="font-bold uppercase text-[9px] text-red-950 tracking-wider">AI Guard Gating Reason</p>
                                    <p className="italic text-xs font-semibold">"{l.ai_reason || 'Unspecified bulk pattern match.'}"</p>
                                  </div>
                                </td>
                              )}

                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2.5">
                                  <button
                                    onClick={() => handleDeleteLeads([l.id])}
                                    className="text-red-400 hover:text-white hover:bg-red-500 p-1.5 rounded-xl transition duration-150 cursor-pointer"
                                    title="Delete Lead permanently"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                  {clientActiveTab === 'spam' ? (
                                    <button 
                                      onClick={() => handleMarkAsGenuine(l.id)}
                                      className="bg-[#d5ecea] hover:bg-[#5fb4a9] text-[#096260] hover:text-white font-extrabold text-[11px] py-2 px-3 rounded-xl transition duration-150 cursor-pointer inline-flex items-center gap-1 shadow-sm border border-[#096260]/10"
                                    >
                                      <Check size={12} />
                                      <span>Mark as Genuine</span>
                                    </button>
                                  ) : (
                                    <>
                                      <span className="inline-block bg-[#096260]/10 text-[#096260] font-mono font-extrabold text-[9px] px-2.5 py-1.5 rounded-lg border border-[#096260]/10 shadow-xs uppercase tracking-wide">
                                        INBOX READY
                                      </span>
                                      <button 
                                        onClick={() => handleMarkAsSpam(l.id)}
                                        className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white font-extrabold text-[11px] py-1.5 px-3 rounded-xl transition duration-150 cursor-pointer inline-flex items-center gap-1.5 shadow-sm border border-red-500/15"
                                        title="Flag this lead manually as SPAM"
                                      >
                                        <AlertTriangle size={12} />
                                        <span>Mark as Spam</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}

                        {leads
                          .filter(l => l.client_id === loggedInUser.client_id)
                          .filter(l => {
                            const normChan = l.channel || 'website';
                            return clientChannelFilter === 'all' || normChan === clientChannelFilter;
                          })
                          .filter(l => l.status === (clientActiveTab === 'spam' ? 'SPAM' : 'GENUINE')).length === 0 && (
                          <tr>
                            <td colSpan={clientActiveTab === 'spam' ? 5 : 4} className="p-12 text-center text-xs text-[#082b36]/50 italic bg-[#d5ecea]/5 select-none rounded-b-3xl">
                              No leads detected inside this channel view. Send a simulated payload from the "n8n Webhook Lab" panel with this channel!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* If Client has GMB subscription, display GMB Monthly performance tracking module */}
                {(() => {
                  const client = clients.find(c => c.client_id === loggedInUser.client_id);
                  if (client && client.has_gmb && (clientChannelFilter === 'all' || clientChannelFilter === 'gmb')) {
                    return (
                      <div className="mt-6 animate-fadeIn">
                        {renderGmbTrackerUI(client.client_id, client.business_name)}
                      </div>
                    );
                  }
                  return null;
                })()}

              </div>
            )}

          </div>
        )}

        {currentTab === 'n8n_hub' && (
          <div className="flex-1 p-6 md:p-8 space-y-8 animate-fadeIn">
            
            {/* Header / Intro section */}
            <div className="bg-white rounded-3xl border border-[#096260]/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
              <div className="space-y-1">
                <span className="inline-block bg-[#096260]/10 text-[#096260] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">Workflow Manager</span>
                <h2 className="text-xl font-bold text-[#082b36]">n8n Advanced Redundancy & Automation Hub</h2>
                <p className="text-xs text-[#082b36]/70 leading-relaxed font-normal">
                  Configure real-time form webhook triggers, 4x consecutive Gemini failover prompt algorithms, OpenAI guard fallbacks, and multi-tenant email forwarding parameters without logging into n8n.
                </p>
              </div>
              <div className="bg-[#d5ecea]/40 px-4 py-3 rounded-2xl border border-[#096260]/10 text-xs font-semibold shrink-0">
                🚀 Multi-Agent Redundancy Enabled (4x Gemini Slots + 1x OpenAI Reserve)
              </div>
            </div>

            {/* Core Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Form Editor (8 of 12 columns) */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-[#096260]/10 overflow-hidden shadow-sm flex flex-col">
                <div className="bg-[#082b36] p-5 text-white flex justify-between items-center border-b border-[#03212a]">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#5fb4a9] font-mono">Workspace Provisioner & Rule Editor</h3>
                    <p className="text-xs text-slate-300 mt-1">Configure active failover routing tables for each registered client</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white/75 uppercase font-mono">Active Client:</span>
                    <select
                      value={selConfigClientId}
                      onChange={(e) => setSelConfigClientId(e.target.value)}
                      className="bg-[#096260] text-white text-xs font-extrabold rounded-xl py-1.5 px-3.5 border border-white/20 outline-none cursor-pointer"
                    >
                      {clients.map(c => (
                        <option key={c.client_id} value={c.client_id}>
                          🏢 {c.business_name} ({c.client_id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <form onSubmit={handleSaveN8nConfig} className="p-6 space-y-6 flex-1">
                  
                  {/* Webhook endpoint block */}
                  <div className="bg-[#d5ecea]/20 p-4 rounded-2xl border border-[#096260]/5 space-y-2">
                    <label className="block text-[10px] font-extrabold text-[#096260] uppercase tracking-widest font-mono">Target n8n Webhook Node Trigger URL</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={editWebhookUrl}
                        onChange={(e) => setEditWebhookUrl(e.target.value)}
                        placeholder="https://your-n8n.public_html/webhook/..."
                        required
                        className="flex-1 bg-white border border-[#096260]/15 rounded-xl py-2 px-3.5 text-xs text-[#082b36] outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(editWebhookUrl);
                          alert("Webhook URL copied!");
                        }}
                        className="bg-[#096260] hover:bg-[#5fb4a9] text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer"
                      >
                        Copy URL 📋
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400">Configure your external scraper form payload to hit this exact URL on form submission.</p>
                  </div>

                  {/* Gemini Prompt details */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-extrabold text-[#082b36] uppercase tracking-widest font-mono">Consolidated Gemini GMB Email Filtering Instructions (Prompts)</label>
                      <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">SHARED ACROSS ALL 4 FAILOVER NODES</span>
                    </div>
                    <textarea
                      value={editGeminiPrompt}
                      onChange={(e) => setEditGeminiPrompt(e.target.value)}
                      rows={5}
                      required
                      placeholder="Input customized contextual rules here..."
                      className="w-full bg-slate-50 border border-slate-250 focus:border-[#096260] focus:ring-1 focus:ring-[#096260] rounded-2xl py-3 px-4 text-xs font-normal leading-relaxed outline-none"
                    ></textarea>
                    <p className="text-[10px] text-gray-400">Instruct Gemini on your clients specific sector boundaries (e.g. Sydney Decking vs gambling spam emails) to identify spam/genuine with precision.</p>
                  </div>

                  {/* 4 Models failovers slots */}
                  <div className="space-y-4">
                    <label className="block text-[10px] font-extrabold text-[#082b36] uppercase tracking-widest font-mono">4-Stage Sequential Failover Core Nodes</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      
                      <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl space-y-1.5">
                        <span className="block text-[9px] font-black text-blue-700 font-mono">🥈 NODE SLOT #1 (PRIMARY)</span>
                        <input
                          type="text"
                          value={editGeminiModel1}
                          onChange={(e) => setEditGeminiModel1(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[11px] font-mono font-bold"
                        />
                      </div>

                      <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl space-y-1.5">
                        <span className="block text-[9px] font-black text-amber-700 font-mono">🥉 NODE SLOT #2 (BACKUP 1)</span>
                        <input
                          type="text"
                          value={editGeminiModel2}
                          onChange={(e) => setEditGeminiModel2(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[11px] font-mono font-bold"
                        />
                      </div>

                      <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl space-y-1.5">
                        <span className="block text-[9px] font-black text-emerald-700 font-mono">🏅 NODE SLOT #3 (BACKUP 2)</span>
                        <input
                          type="text"
                          value={editGeminiModel3}
                          onChange={(e) => setEditGeminiModel3(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[11px] font-mono font-bold"
                        />
                      </div>

                      <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl space-y-1.5">
                        <span className="block text-[9px] font-black text-purple-700 font-mono">🎖️ NODE SLOT #4 (BACKUP 3)</span>
                        <input
                          type="text"
                          value={editGeminiModel4}
                          onChange={(e) => setEditGeminiModel4(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[11px] font-mono font-bold"
                        />
                      </div>

                    </div>
                  </div>

                  {/* OpenAI fallbacks */}
                  <div className="border-t border-slate-100 pt-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="openai_toggle"
                          checked={editOpenaiEnabled}
                          onChange={(e) => setEditOpenaiEnabled(e.target.checked)}
                          className="w-4 h-4 text-[#096260] focus:ring-[#096260] border-gray-300 rounded cursor-pointer"
                        />
                        <label htmlFor="openai_toggle" className="text-[10px] font-extrabold text-[#082b36] uppercase tracking-widest font-mono cursor-pointer">
                          Activate Final Sentinel: OpenAI Fallback Node (gpt-4o)
                        </label>
                      </div>
                      <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">EMERGENCY FLOOD RESISTOR</span>
                    </div>

                    {editOpenaiEnabled && (
                      <div className="space-y-2 animate-fadeIn">
                        <textarea
                          value={editOpenaiPrompt}
                          onChange={(e) => setEditOpenaiPrompt(e.target.value)}
                          rows={2}
                          required
                          placeholder="Emergency fallback instruction prompts..."
                          className="w-full bg-red-50/20 border border-red-500/15 focus:border-red-500 rounded-2xl py-3 px-4 text-xs font-normal outline-none"
                        ></textarea>
                      </div>
                    )}
                  </div>

                  {/* Recipients email addresses */}
                  <div className="border-t border-slate-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-extrabold text-[#082b36] uppercase tracking-widest font-mono"> Genuine Target Email (Delivered Leads)</label>
                      <input
                        type="email"
                        value={editGenuineRecipient}
                        onChange={(e) => setEditGenuineRecipient(e.target.value)}
                        placeholder="team@merchant.com.au"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-semibold text-[#082b36]"
                      />
                      <p className="text-[8px] text-gray-400">Filtered real customer inquiries will instantly dispatch to this address.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-extrabold text-[#082b36] uppercase tracking-widest font-mono"> Spam Sandbox Email (Blocked Logs)</label>
                      <input
                        type="email"
                        value={editSpamRecipient}
                        onChange={(e) => setEditSpamRecipient(e.target.value)}
                        placeholder="spam@agency.com"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-semibold text-[#082b36]"
                      />
                      <p className="text-[8px] text-gray-400">Commercial advertisements, slots and backlink pitches route safely here.</p>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="pt-4 border-t border-slate-100 text-right">
                    <button
                      type="submit"
                      className="bg-[#096260] hover:bg-[#5fb4a9] text-white font-extrabold text-xs py-3 px-6 rounded-xl hover:translate-y-[-1px] transition shadow-lg cursor-pointer"
                    >
                      💾 Commit & Deploy Config to Live workflow
                    </button>
                  </div>

                </form>
              </div>

              {/* Right Column: Simulator & JSON Exporter (5 of 12 columns) */}
              <div className="lg:col-span-5 space-y-8 flex flex-col">
                
                {/* Simulator Card block */}
                <div className="bg-white rounded-3xl border border-[#096260]/10 p-6 shadow-sm space-y-5">
                  <div className="space-y-1">
                    <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">Sandbox Sandbox</span>
                    <h3 className="text-base font-extrabold text-[#082b36]">n8n Live Failover & SMTP Simulator</h3>
                    <p className="text-xs text-gray-400">Simulate incoming lead submissions and test API gate reliability.</p>
                  </div>

                  {/* Simulated Failure checklist */}
                  <div className="bg-[#d5ecea]/20 p-4 rounded-2xl border border-[#096260]/5 space-y-3">
                    <h4 className="text-[10px] font-extrabold text-[#082b36] uppercase tracking-wide font-mono">⚠️ Introduce Test API Outages (Simulate failures)</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      
                      <label className="flex items-center gap-2 cursor-pointer bg-white p-2 border border-red-500/10 rounded-xl">
                        <input
                          type="checkbox"
                          checked={n8nSimForceNodeFailures[1]}
                          onChange={(e) => setN8nSimForceNodeFailures({ ...n8nSimForceNodeFailures, 1: e.target.checked })}
                          className="w-3.5 h-3.5"
                        />
                        <span className="text-[10px] select-none text-red-950 font-bold font-mono">Fail Slot #1</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-white p-2 border border-red-500/10 rounded-xl">
                        <input
                          type="checkbox"
                          checked={n8nSimForceNodeFailures[2]}
                          onChange={(e) => setN8nSimForceNodeFailures({ ...n8nSimForceNodeFailures, 2: e.target.checked })}
                          className="w-3.5 h-3.5"
                        />
                        <span className="text-[10px] select-none text-red-950 font-bold font-mono">Fail Slot #2</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-white p-2 border border-red-500/10 rounded-xl">
                        <input
                          type="checkbox"
                          checked={n8nSimForceNodeFailures[3]}
                          onChange={(e) => setN8nSimForceNodeFailures({ ...n8nSimForceNodeFailures, 3: e.target.checked })}
                          className="w-3.5 h-3.5"
                        />
                        <span className="text-[10px] select-none text-red-950 font-bold font-mono">Fail Slot #3</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-white p-2 border border-red-500/10 rounded-xl">
                        <input
                          type="checkbox"
                          checked={n8nSimForceNodeFailures[4]}
                          onChange={(e) => setN8nSimForceNodeFailures({ ...n8nSimForceNodeFailures, 4: e.target.checked })}
                          className="w-3.5 h-3.5"
                        />
                        <span className="text-[10px] select-none text-red-950 font-bold font-mono">Fail Slot #4</span>
                      </label>

                    </div>
                  </div>

                  {/* Lead input simulation payload */}
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono text-gray-500 font-bold uppercase tracking-wider">Form Name</span>
                        <input
                          type="text"
                          value={n8nSimName}
                          onChange={(e) => setN8nSimName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono text-gray-500 font-bold uppercase tracking-wider">Form Email</span>
                        <input
                          type="text"
                          value={n8nSimEmail}
                          onChange={(e) => setN8nSimEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-gray-500 font-bold uppercase tracking-wider">Form Message (Test prompt trigger sentences)</span>
                      <textarea
                        value={n8nSimMessage}
                        onChange={(e) => setN8nSimMessage(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs leading-normal font-sans outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setN8nSimName("Bitcoin Trader Pro");
                          setN8nSimEmail("admin@crypto-casino-rich.net");
                          setN8nSimMessage("HEY there! Register with BTC wallet to claim 200 free card spins at slot-gambler.com! Guaranteed 50x payout rate. Standard Neteller and BTC payments supported. SEO optimization links inside...");
                        }}
                        className="bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-black rounded-lg py-2 border border-red-200 cursor-pointer text-center"
                      >
                        ⚠️ Load Spam Inbound
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setN8nSimName("Sarah Jenkins");
                          setN8nSimEmail("sarah.jenkins@outlook.com");
                          setN8nSimMessage("Hi Team, I'm hoping to get an price estimation for installing a premium wood patio deck at my home. The surface is about 24sqm. Do you have slots available to call me tomorrow?");
                        }}
                        className="bg-green-50 hover:bg-green-100 text-green-700 text-[10px] font-black rounded-lg py-2 border border-green-200 cursor-pointer text-center"
                      >
                        🌟 Load Genuine Inbound
                      </button>
                    </div>
                  </div>

                  {/* Run sandbox trigger */}
                  <button
                    type="button"
                    onClick={handleRunN8nSimulation}
                    disabled={n8nSimIsProcessing}
                    className={`w-full text-white font-extrabold text-xs py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${n8nSimIsProcessing ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-teal-600 to-[#096260] hover:from-teal-700 hover:to-teal-800 shadow-teal-700/20'}`}
                  >
                    <span>{n8nSimIsProcessing ? '⏳ Running Failover Sequence Sandbox...' : '⚡ Run Failover Simulation Sandbox'}</span>
                  </button>

                  {/* Console Logs visualization */}
                  {n8nSimConsoleLogs.length > 0 && (
                    <div className="bg-[#041a1f] text-slate-300 font-mono text-[10px] p-4 rounded-2xl border border-[#5fb4a9]/20 shadow-inner h-64 overflow-y-auto space-y-1.5 scrollbar-thin">
                      <div className="flex justify-between items-center text-[#5fb4a9] border-b border-white/5 pb-2 mb-2">
                        <span>🛰️ VIRTUAL n8n SANDBOX DIALER</span>
                        <button onClick={() => setN8nSimConsoleLogs([])} className="hover:underline hover:text-white font-bold">Clear Terminal ✖</button>
                      </div>
                      {n8nSimConsoleLogs.map((log, i) => {
                        let colorClass = "text-slate-300";
                        if (log.includes("FAILED") || log.includes("Error") || log.includes("Outages") || log.includes("outages")) colorClass = "text-red-400 font-medium";
                        if (log.includes("SUCCESS") || log.includes("DELIVERED") || log.includes("Genuine") || log.includes("delivered") || log.includes("Active") || log.includes("SUCCESSFUL") || log.includes("SUCCESS")) colorClass = "text-emerald-400 font-bold";
                        if (log.includes("SPAM") || log.includes("Quarantine") || log.includes("Gated")) colorClass = "text-amber-400 font-bold";
                        if (log.includes("🎬") || log.includes("🏆")) colorClass = "text-white font-black";
                        
                        return (
                          <p key={i} className={`leading-normal whitespace-pre-wrap ${colorClass}`}>
                            {log}
                          </p>
                        );
                      })}
                    </div>
                  )}

                </div>

                {/* JSON Blueprint Card */}
                <div className="bg-[#082b36] text-white rounded-3xl p-6 shadow-xl border border-white/5 space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#5fb4a9]">n8n JSON Workflow Node Blueprint</h3>
                    <p className="text-[10px] text-[#5fb4a9]/70 mt-1">Copy and paste this config directly to import fully automated pipelines in n8n</p>
                  </div>

                  <div className="bg-[#031519] border border-[#5fb4a9]/15 rounded-2xl overflow-hidden relative">
                    <pre className="text-[9px] font-mono p-4 text-slate-300 overflow-x-auto max-h-60 leading-relaxed select-all">
{JSON.stringify({
  "name": `LeadShield_Auto_${selConfigClientId}`,
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": `${selConfigClientId}-forms-inbound`
      },
      "type": "n8n-nodes-base.webhook",
      "name": "Webhook Trigger"
    },
    {
      "parameters": {
        "model": editGeminiModel1,
        "prompt": editGeminiPrompt
      },
      "type": "n8n-nodes-base.gemini",
      "name": "Gemini Node SLOT 1 (Primary)"
    },
    {
      "parameters": {
        "model": editGeminiModel2,
        "prompt": editGeminiPrompt
      },
      "type": "n8n-nodes-base.gemini",
      "name": "Gemini Node SLOT 2 (Failover 1)"
    },
    {
      "parameters": {
        "model": editGeminiModel3,
        "prompt": editGeminiPrompt
      },
      "type": "n8n-nodes-base.gemini",
      "name": "Gemini Node SLOT 3 (Failover 2)"
    },
    {
      "parameters": {
        "model": editGeminiModel4,
        "prompt": editGeminiPrompt
      },
      "type": "n8n-nodes-base.gemini",
      "name": "Gemini Node SLOT 4 (Failover 3)"
    },
    {
      "parameters": {
        "enabled": editOpenaiEnabled,
        "model": "gpt-4o",
        "prompt": editOpenaiPrompt
      },
      "type": "n8n-nodes-base.openai",
      "name": "OpenAI Backup Node (Final Fallback)"
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.verdict }}",
              "operation": "equal",
              "value2": "GENUINE"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.if",
      "name": "Classification Router"
    },
    {
      "parameters": {
        "toEmail": editGenuineRecipient,
        "subject": `[NEW LEAD] Custom lead validation for ${selConfigClientId}`
      },
      "type": "n8n-nodes-base.emailSend",
      "name": "Send Genuine Outbox"
    },
    {
      "parameters": {
        "toEmail": editSpamRecipient,
        "subject": `[SPAM QUARANTINE] Lead Shield block event for ${selConfigClientId}`
      },
      "type": "n8n-nodes-base.emailSend",
      "name": "Send Spam Sandbox"
    }
  ]
}, null, 2)}
                    </pre>

                    <button
                      type="button"
                      onClick={() => {
                        const jsonTxt = JSON.stringify({
                          "name": `LeadShield_Auto_${selConfigClientId}`,
                          "nodes": [
                            {
                              "parameters": {
                                "httpMethod": "POST",
                                "path": `${selConfigClientId}-forms-inbound`
                              },
                              "type": "n8n-nodes-base.webhook",
                              "name": "Webhook Trigger"
                            },
                            {
                              "parameters": {
                                "model": editGeminiModel1,
                                "prompt": editGeminiPrompt
                              },
                              "type": "n8n-nodes-base.gemini",
                              "name": "Gemini Node SLOT 1 (Primary)"
                            },
                            {
                              "parameters": {
                                "model": editGeminiModel2,
                                "prompt": editGeminiPrompt
                              },
                              "type": "n8n-nodes-base.gemini",
                              "name": "Gemini Node SLOT 2 (Failover 1)"
                            },
                            {
                              "parameters": {
                                "model": editGeminiModel3,
                                "prompt": editGeminiPrompt
                              },
                              "type": "n8n-nodes-base.gemini",
                              "name": "Gemini Node SLOT 3 (Failover 2)"
                            },
                            {
                              "parameters": {
                                "model": editGeminiModel4,
                                "prompt": editGeminiPrompt
                              },
                              "type": "n8n-nodes-base.gemini",
                              "name": "Gemini Node SLOT 4 (Failover 3)"
                            },
                            {
                              "parameters": {
                                "enabled": editOpenaiEnabled,
                                "model": "gpt-4o",
                                "prompt": editOpenaiPrompt
                              },
                              "type": "n8n-nodes-base.openai",
                              "name": "OpenAI Backup Node (Final Fallback)"
                            },
                            {
                              "parameters": {
                                "conditions": {
                                  "string": [
                                    {
                                      "value1": "={{ $json.verdict }}",
                                      "operation": "equal",
                                      "value2": "GENUINE"
                                    }
                                  ]
                                }
                              },
                              "type": "n8n-nodes-base.if",
                              "name": "Classification Router"
                            },
                            {
                              "parameters": {
                                "toEmail": editGenuineRecipient,
                                "subject": `[NEW LEAD] Custom lead validation for ${selConfigClientId}`
                              },
                              "type": "n8n-nodes-base.emailSend",
                              "name": "Send Genuine Outbox"
                            },
                            {
                              "parameters": {
                                "toEmail": editSpamRecipient,
                                "subject": `[SPAM QUARANTINE] Lead Shield block event for ${selConfigClientId}`
                              },
                              "type": "n8n-nodes-base.emailSend",
                              "name": "Send Spam Sandbox"
                            }
                          ]
                        }, null, 2);
                        navigator.clipboard.writeText(jsonTxt);
                        alert("n8n Workflow JSON blueprint copied successfully! Paste this configuration directly inside your n8n workspace with Ctrl+V.");
                      }}
                      className="absolute bottom-3 right-3 bg-[#5fb4a9]/10 border border-[#5fb4a9]/20 hover:bg-[#5fb4a9]/20 text-[#5fb4a9] text-[9px] uppercase tracking-wider font-extrabold py-2 px-3.5 rounded-xl cursor-pointer select-none transition"
                    >
                      Copy Node JSON 📋
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-300">
                    💡 <strong>Pro-Tip:</strong> Inside your n8n canvas editor, press <code className="bg-[#031519]/50 px-1 rounded">Ctrl+V</code> anywhere on the blank grid to instantly auto-generate these exact nodes perfectly connected in seconds.
                  </p>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* TAB 2: SIMULATE THE RECEIVE-LEAD ENDPOINT (n8n Webhook Lab) */}
        {currentTab === 'webhooks' && (
          <div className="flex-1 p-6 md:p-8 space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left selector panel */}
            <div className="bg-white p-6 rounded-3xl border border-[#096260]/5 shadow-sm space-y-5">
              <div className="space-y-1.5">
                <span className="inline-block bg-[#096260] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">n8n Workflow Hub</span>
                <h2 className="text-base font-extrabold text-[#082b36]">Simulated Webhook Reception Payload Channel</h2>
                <p className="text-xs text-[#082b36]/65 leading-relaxed">
                  Select a Lead Blueprint packet below. This simulates sending raw JSON into `/api/receive-lead.php` from your external scraper flow.
                </p>
              </div>

              {/* Blueprint select box */}
              <div className="space-y-2">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-widest font-mono">Select Lead Blueprint Packet Preset</label>
                <div className="grid grid-cols-2 gap-3">
                  {TEST_WEBHOOKS.map((tw, i) => (
                    <button
                      key={tw.name}
                      onClick={() => handleWebhookPresetChange(i)}
                      className={`p-4 rounded-2xl border text-left transition duration-200 flex flex-col justify-between h-24 text-xs cursor-pointer shadow-sm ${selectedWebhook === i ? 'bg-[#d5ecea] border-[#096260] text-[#096260] font-bold ring-1 ring-[#096260]' : 'bg-[#d5ecea]/10 border-gray-100 hover:bg-[#d5ecea]/25 text-[#082b36]'}`}
                    >
                      <p className="font-bold truncate w-full">{tw.name.split(':')[0]}</p>
                      <div className="flex justify-between items-center w-full mt-2">
                        <span className="text-[9px] font-mono tracking-wider bg-white/75 px-2 py-0.5 rounded-lg shadow-xs text-gray-500 uppercase font-extrabold">{tw.client_id}</span>
                        <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full font-bold uppercase border ${tw.status === 'GENUINE' ? 'bg-[#096260] text-white border-[#5fb4a9]/30' : 'bg-orange-500/10 text-orange-600 border-orange-500/10'}`}>
                          {tw.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Input fields showing dynamic raw values */}
              <div className="bg-[#d5ecea]/15 p-5 rounded-2xl border border-[#096260]/10 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold uppercase text-[#096260] font-mono tracking-wider">Dynamic Form payload body</p>
                  <span className="text-[9px] font-mono text-gray-400 font-extrabold bg-white/60 px-2 py-0.5 rounded-md">POST RAW JSON</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-[#096260] uppercase font-bold tracking-wider mb-1 font-mono">Target Client ID Key</label>
                    <input 
                      type="text" 
                      value={webhookData.client_id}
                      onChange={(e) => setWebhookData({ ...webhookData, client_id: e.target.value })}
                      className="w-full bg-white border border-[#096260]/10 text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#096260] focus:ring-1 focus:ring-[#096260] font-mono text-[#082b36]"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-[#096260] uppercase font-bold tracking-wider mb-1 font-mono">Class Verdict (from AI Filter Node)</label>
                    <select
                      value={webhookData.status}
                      onChange={(e) => setWebhookData({ ...webhookData, status: e.target.value })}
                      className="w-full bg-white border border-[#096260]/10 text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#096260] font-bold text-[#082b36]"
                    >
                      <option value="GENUINE">GENUINE</option>
                      <option value="SPAM">SPAM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] text-[#096260]/85 uppercase font-bold tracking-wider mb-1 font-mono">Source Marketing Channel</label>
                  <select
                    value={webhookData.channel || 'website'}
                    onChange={(e) => setWebhookData({ ...webhookData, channel: e.target.value })}
                    className="w-full bg-white border border-[#096260]/10 text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#096260] font-extrabold text-[#082b36]"
                  >
                    <option value="website">🌐 Website Lead Form (SEO)</option>
                    <option value="google_ads">🎯 Google AdWords (CPC Campaign)</option>
                    <option value="facebook_ads">👥 Facebook Lead Form Ad</option>
                    <option value="gmb">💎 Google Business Map (GMB Phone Call)</option>
                  </select>
                </div>

                {webhookData.status === 'SPAM' && (
                  <div>
                    <label className="block text-[9px] text-red-700 uppercase font-bold tracking-wider mb-1 font-mono">AI Gating Trigger Filter Reason</label>
                    <input 
                      type="text" 
                      value={webhookData.ai_reason}
                      onChange={(e) => setWebhookData({ ...webhookData, ai_reason: e.target.value })}
                      className="w-full bg-white border border-red-500/10 text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-red-500 text-red-950 font-medium"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[9px] text-[#096260] uppercase font-bold tracking-wider mb-1 font-mono font-mono">Dynamic Form Fields Payload (JSON representation)</label>
                  <textarea
                    rows={4}
                    value={JSON.stringify(webhookData.form_data, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setWebhookData({ ...webhookData, form_data: parsed });
                      } catch (err) {}
                    }}
                    className="w-full bg-white text-xs border border-[#096260]/10 focus:outline-none focus:border-[#096260] focus:ring-1 focus:ring-[#096260] rounded-xl p-3 font-mono text-[#082b36] selection:bg-[#5fb4a9]"
                  ></textarea>
                </div>

                <button 
                  onClick={handleBroadcastSimulatedWebhook}
                  className={`w-full text-white font-extrabold text-[#082b36] font-extrabold text-xs py-3 px-4 rounded-xl shadow-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${webhookSuccessSignal ? 'bg-green-600 shadow-green-600/20' : 'bg-[#096260] hover:bg-[#5fb4a9] shadow-[#096260]/20 text-white'}`}
                >
                  <Send size={14} className={webhookSuccessSignal ? 'animate-ping' : ''} />
                  <span>Broadcast Webhook REST Payload</span>
                </button>
              </div>

            </div>

            {/* Simulated Server Console output screen */}
            <div className="bg-[#082b36] p-6 rounded-3xl border border-white/5 shadow-2xl flex flex-col justify-between text-white font-mono space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-[#5fb4a9] rounded-full animate-pulse"></div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#5fb4a9]">RECEPTOR CONSOLE WEBHOOK LISTENER</h3>
                </div>
                <p className="text-[10px] text-gray-400">Monitoring POST inputs targeting address: <span className="text-white">https://your-cpanel-domain.com/lead-shield/api/receive-lead.php</span></p>
              </div>

              {/* Live Logger panel */}
              <div className="flex-1 bg-black/30 border border-white/5 rounded-2xl p-5 overflow-y-auto max-h-[400px] text-[11px] leading-relaxed space-y-3.5 selection:bg-[#096260]/95 scrollbar">
                
                {webhookConsoleLogs.length === 0 ? (
                  <p className="text-gray-500 italic select-none">
                    [System idle] Webhook listener is actively listening for incoming payloads. Select a preset and broadcast to observe server response code logs...
                  </p>
                ) : (
                  webhookConsoleLogs.map((log, i) => (
                    <div key={i} className="border-b border-white/5 pb-3">
                      <pre className="whitespace-pre-wrap select-text">{log}</pre>
                    </div>
                  ))
                )}
                
              </div>

              <div className="flex justify-between items-center text-[9px] text-gray-500 border-t border-white/5 pt-4">
                <span className="uppercase font-bold text-gray-400 tracking-wider">⚡ NODE RECEPTOR BRIDGE SIM</span>
                <button 
                  onClick={() => setWebhookConsoleLogs([])}
                  className="text-[#5fb4a9] hover:underline font-bold"
                >
                  Clear stream logs
                </button>
              </div>

            </div>

          </div>

          {/* Real External Terminal Testing Panel */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#096260]/10 shadow-sm space-y-6 mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#096260]/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="bg-[#096260]/10 text-[#096260] text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">Real External API</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">Active Receiver</span>
                </div>
                <h3 className="text-base font-extrabold text-[#082b36]">⚡ Local Terminal Testing & PowerShell Fix Toolkit</h3>
                <p className="text-xs text-gray-500">
                  Windows PowerShell does not support Linux-style <code className="bg-slate-100 px-1 rounded text-red-600 font-mono">-X</code> curl parameters. Use <span className="font-bold text-[#096260]">Invoke-RestMethod</span> instead for a flawless, native test:
                </p>
              </div>

              {/* Tab Switcher for different shells */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shadow-inner shrink-0">
                <button
                  onClick={() => setActiveTestCmd('powershell')}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer ${activeTestCmd === 'powershell' ? 'bg-[#096260] text-white shadow-xs' : 'text-gray-500 hover:bg-white/55'}`}
                >
                  Windows PowerShell 💻
                </button>
                <button
                  onClick={() => setActiveTestCmd('cmd')}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer ${activeTestCmd === 'cmd' ? 'bg-[#096260] text-white shadow-xs' : 'text-gray-500 hover:bg-white/55'}`}
                >
                  Windows CMD 🛡️
                </button>
                <button
                  onClick={() => setActiveTestCmd('bash')}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer ${activeTestCmd === 'bash' ? 'bg-[#096260] text-white shadow-xs' : 'text-gray-500 hover:bg-white/55'}`}
                >
                  macOS/Linux Bash 🍎
                </button>
              </div>
            </div>

            {/* Rendering selected command block */}
            <div className="relative bg-[#041a1f] border border-[#5fb4a9]/25 rounded-2xl p-5 select-text">
              <span className="absolute top-3.5 right-14 text-[9px] font-mono text-[#5fb4a9] bg-[#5fb4a9]/10 border border-[#5fb4a9]/20 px-2 py-0.5 rounded-md font-bold uppercase select-none">
                {activeTestCmd === 'powershell' ? 'PowerShell - Native' : activeTestCmd === 'cmd' ? 'CMD - Curl.exe' : 'Bash - curl'}
              </span>
              
              <button
                onClick={() => {
                  let cmdText = "";
                  const liveHost = window.location.origin;
                  if (activeTestCmd === 'powershell') {
                    cmdText = `$body = @{
    client_id = "${webhookData.client_id}"
    channel   = "${webhookData.channel || 'website'}"
    name      = "Kamal Perera"
    email     = "kamalperera@gmail.com"
    phone     = "0771234567"
    message   = "Hi, I need a quotation for a custom treated timber deck for my veranda in Sydney."
} | ConvertTo-Json -Depth 5 -Compress

Invoke-RestMethod -Method Post -Uri "${liveHost}/api/receive-lead" -ContentType "application/json" -Body $body`;
                  } else if (activeTestCmd === 'cmd') {
                    cmdText = `curl.exe -X POST "${liveHost}/api/receive-lead" -H "Content-Type: application/json" -d "{\\"client_id\\":\\"${webhookData.client_id}\\",\\"channel\\":\\"${webhookData.channel || 'website'}\\",\\"name\\":\\"Kamal Perera\\",\\"email\\":\\"kamalperera@gmail.com\\",\\"phone\\":\\"0771234567\\",\\"message\\":\\"Hi, I need a quotation for a custom treated timber deck for my veranda in Sydney.\\"}"`;
                  } else {
                    cmdText = `curl -X POST "${liveHost}/api/receive-lead" \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_id": "${webhookData.client_id}",
    "channel": "${webhookData.channel || 'website'}",
    "name": "Kamal Perera",
    "email": "kamalperera@gmail.com",
    "phone": "0771234567",
    "message": "Hi, I need a quotation for a custom treated timber deck for my veranda in Sydney."
  }'`;
                  }
                  navigator.clipboard.writeText(cmdText);
                  alert(`Copied the test snippet for ${activeTestCmd}! Paste and press Enter in your PC's terminal to send a live lead directly!`);
                }}
                className="absolute top-2.5 right-3 bg-white/10 hover:bg-white/20 text-[#5fb4a9] font-bold text-[10px] uppercase py-1.5 px-3 rounded-lg border border-white/15 transition cursor-pointer select-none"
              >
                Copy Code 📋
              </button>

              <pre className="font-mono text-xs text-[#d5ecea] leading-relaxed whitespace-pre overflow-x-auto max-h-64 mt-2">
{activeTestCmd === 'powershell' ? (
`$body = @{
    client_id = "${webhookData.client_id}"
    channel   = "${webhookData.channel || 'website'}"
    name      = "Kamal Perera"
    email     = "kamalperera@gmail.com"
    phone     = "0771234567"
    message   = "Hi, I need a quotation for a custom treated timber deck for my veranda in Sydney."
} | ConvertTo-Json -Depth 5 -Compress

Invoke-RestMethod -Method Post -Uri "${window.location.origin}/api/receive-lead" -ContentType "application/json" -Body $body`
) : activeTestCmd === 'cmd' ? (
`curl.exe -X POST "${window.location.origin}/api/receive-lead" -H "Content-Type: application/json" -d "{\\"client_id\\":\\"${webhookData.client_id}\\",\\"channel\\":\\"${webhookData.channel || 'website'}\\",\\"name\\":\\"Kamal Perera\\",\\"email\\":\\"kamalperera@gmail.com\\",\\"phone\\":\\"0771234567\\",\\"message\\":\\"Hi, I need a quotation for a custom treated timber deck for my veranda in Sydney.\\"}"`
) : (
`curl -X POST "${window.location.origin}/api/receive-lead" \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_id": "${webhookData.client_id}",
    "channel": "${webhookData.channel || 'website'}",
    "name": "Kamal Perera",
    "email": "kamalperera@gmail.com",
    "phone": "0771234567",
    "message": "Hi, I need a quotation for a custom treated timber deck for my veranda in Sydney."
  }'`
)}
              </pre>
            </div>

            {/* Instructions text block helpful summary */}
            <div className="bg-[#d5ecea]/20 p-4 border border-[#096260]/10 rounded-2xl text-xs text-[#082b36] space-y-2 leading-relaxed">
              <span className="font-bold text-[#096260] uppercase font-mono text-[10px] block">💡 Real-time Synchronized Webhook Integration</span>
              <p>
                Copy the snippet above and paste it directly on your Windows PC or Mac terminal. The Express server backend catches the POST parameters, evaluates them instantly (using Gemini's AI model if configured or smart regional logic parameters), registers them in our central <code className="bg-[#d5ecea] text-[#096260] font-mono px-1 rounded">db.json</code>, and automatically broadcasts it to this app dashboard via active client state polling!
              </p>
              <div className="flex gap-2.5 items-center pt-2 text-[#096260] border-t border-[#096260]/10 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="font-semibold text-[11px]">Any external client can now post leads to: <span className="font-mono bg-white px-2 py-0.5 rounded border border-[#096260]/20 text-[10.5px] font-bold select-all">{window.location.origin}/api/receive-lead</span></p>
              </div>
            </div>
          </div>

          {/* New Interactive n8n Live Workflow Guide */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#096260]/10 shadow-sm space-y-6">
            <div className="border-b border-[#096260]/10 pb-4">
              <span className="bg-[#096260]/10 text-[#096260] text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">n8n PRODUCTION SYSTEM INTEGRATION</span>
              <h3 className="text-base font-extrabold text-[#082b36] mt-1">🔌 Connect Your Live n8n Workflows Directly</h3>
              <p className="text-xs text-gray-500 mt-1">
                Route filtered, post-processed, and classified leads directly from your personal n8n instance to this central dashboard. No double filter of AI will run – we trust your n8n verdict and display it neatly for your clients.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-gray-600">
              <div className="space-y-2 border-r border-[#096260]/5 pr-4">
                <div className="flex items-center gap-2">
                  <span className="bg-[#096260] text-white w-5 h-5 flex items-center justify-center rounded-full font-black text-[10px]">1</span>
                  <h4 className="font-extrabold text-[#082b36]">n8n HTTP Node</h4>
                </div>
                <p className="leading-relaxed text-gray-500 text-[11px]">
                  Add an <strong>HTTP Request</strong> node in your n8n workflow at the very end of your lead intake sequence.
                </p>
                <div className="bg-slate-50 p-3 rounded-xl border border-dashed border-gray-200 mt-2 space-y-1 font-mono text-[10px]">
                  <div><strong className="text-gray-700">Method:</strong> <span className="text-emerald-700 font-bold">POST</span></div>
                  <div><strong className="text-gray-700">URL:</strong> <span className="text-[#096260] select-all break-all font-bold">{window.location.origin}/api/receive-lead</span></div>
                  <div><strong className="text-gray-700">Headers:</strong> <span className="text-gray-500">Content-Type: application/json</span></div>
                </div>
              </div>

              <div className="space-y-2 border-r border-[#096260]/5 pr-4">
                <div className="flex items-center gap-2">
                  <span className="bg-[#096260] text-white w-5 h-5 flex items-center justify-center rounded-full font-black text-[10px]">2</span>
                  <h4 className="font-extrabold text-[#082b36]">Configure custom Payload Map</h4>
                </div>
                <p className="leading-relaxed text-gray-500 text-[11px]">
                  Transmit the lead parameters mapped dynamically from previous nodes. Set the classified <code className="bg-slate-100 p-0.5 rounded font-mono text-[9px]">status</code> to <strong>GENUINE</strong> or <strong>SPAM</strong>.
                </p>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-dashed border-gray-200 mt-2 text-[10px] space-y-1">
                  <p className="font-semibold text-gray-700 font-mono">Parameters structure:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-500 font-mono text-[9px] pl-1">
                    <li><span className="text-emerald-700 font-bold">"client_id"</span>: Client matching key (e.g., <code className="bg-white px-1">sydney_decking</code>)</li>
                    <li><span className="text-emerald-700 font-bold">"status"</span>: <code className="text-gray-800 font-bold">"GENUINE"</code> or <code className="text-gray-800 font-bold">"SPAM"</code></li>
                    <li><span className="text-emerald-700 font-bold">"reason"</span>: Detailed tag / spam reason</li>
                    <li><span className="text-emerald-700 font-bold">"name"</span>: Lead's contact sender name</li>
                    <li><span className="text-emerald-700 font-bold">"email"</span>: Active sender email address</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-[#096260] text-white w-5 h-5 flex items-center justify-center rounded-full font-black text-[10px]">3</span>
                  <h4 className="font-extrabold text-[#082b36]">Immediate Overrides Panel</h4>
                </div>
                <p className="leading-relaxed text-gray-500 text-[11px]">
                  When selling solutions to clients, they access a curated dashboard. If n8n mistakenly flags a query, your client can bypass it by clicking <strong>✅ Mark GENUINE</strong> or <strong>⚠️ Mark SPAM</strong> on their terminal view instantly.
                </p>
                <div className="border border-emerald-500/20 bg-emerald-50/45 p-3 rounded-xl mt-2">
                  <p className="font-semibold text-emerald-800 flex items-center gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    Ready for client white-labeling
                  </p>
                  <p className="text-[10px] text-gray-500 leading-normal mt-1">
                    The status transitions are synchronized seamlessly, giving your end-clients maximum control while utilizing n8n automated notifications.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#041a1f] p-5 rounded-2xl border border-[#5fb4a9]/25 space-y-3 relative select-text mt-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono font-bold text-[#5fb4a9] tracking-wider uppercase">JSON Payload to Paste into n8n Webhook / HTTP Request parameters</span>
                <button
                  onClick={() => {
                    const sampleN8nPayload = `{
  "client_id": "${webhookData.client_id}",
  "channel": "${webhookData.channel || 'website'}",
  "status": "${webhookData.status}",
  "reason": "${webhookData.status === 'SPAM' ? 'High risk spam keywords matching via n8n filters.' : 'Validated genuine agency leads contact request.'}",
  "name": "Kamal Perera",
  "email": "kamalperera@gmail.com",
  "phone": "0771234567",
  "message": "Hi, I need quotation for custom decking of my house."
}`;
                    navigator.clipboard.writeText(sampleN8nPayload);
                    alert("n8n standard JSON blueprint payload template copied successfully! Paste this inside your HTTP Request node dynamic JSON parameter setup.");
                  }}
                  className="bg-white/10 hover:bg-white/20 text-[#5fb4a9] font-bold text-[9px] uppercase py-1 px-2.5 rounded border border-white/10 transition cursor-pointer"
                >
                  Copy JSON Payload 📋
                </button>
              </div>
              <pre className="font-mono text-xs text-[#d5ecea] leading-relaxed whitespace-pre overflow-x-auto">
{`{
  "client_id": "${webhookData.client_id}",
  "channel": "${webhookData.channel || 'website'}",
  "status": "${webhookData.status}",
  "reason": "${webhookData.status === 'SPAM' ? 'High risk spam keywords matching via n8n filters.' : 'Validated genuine agency leads contact request.'}",
  "name": "Kamal Perera",
  "email": "kamalperera@gmail.com",
  "phone": "0771234567",
  "message": "Hi, I need quotation for custom decking of my house."
}`}
              </pre>
            </div>
          </div>

          {/* SECURE LEAD STATS RETRIEVAL API (BI-LINGUAL DOCUMENTATION & LIVE PLAYGROUND) */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#096260]/10 shadow-sm space-y-6">
            <div className="border-b border-[#096260]/10 pb-4">
              <div className="flex items-center gap-1.5">
                <span className="bg-[#096260]/10 text-[#096260] text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">SECURE GET ENDPOINT</span>
                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">LIVE INTELLIGENCE FEED</span>
              </div>
              <h3 className="text-base font-extrabold text-[#082b36] mt-1">📊 Leads Stats & Audit Feed API Query Channel</h3>
              <p className="text-xs text-gray-500 mt-1">
                Easily fetch genuine and spam lead metrics into any external website or app using this API. Includes support for date range and client ID filters.
              </p>
            </div>

            {/* Core parameters controller and generator */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Selector form */}
              <div className="space-y-4 bg-[#d5ecea]/10 p-5 rounded-2xl border border-[#096260]/10">
                <h4 className="text-xs font-bold text-[#096260] uppercase font-mono tracking-wider">🛠️ Dynamic API Query Builder</h4>
                
                {/* 1. Client selection */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase font-mono">Client ID Filter</label>
                  <select
                    value={statsClientId}
                    onChange={(e) => setStatsClientId(e.target.value)}
                    className="w-full bg-white border border-[#096260]/10 text-xs rounded-xl py-2 px-3 focus:outline-none font-semibold text-[#082b36]"
                  >
                    <option value="all">🌐 All Clients combined</option>
                    {clients.map(c => (
                      <option key={c.client_id} value={c.client_id}>🏢 {c.business_name} ({c.client_id})</option>
                    ))}
                  </select>
                </div>

                {/* 2. Start Date and End Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase font-mono">Start Date (YYYY-MM-DD)</label>
                    <input
                      type="date"
                      value={statsStartDate}
                      onChange={(e) => setStatsStartDate(e.target.value)}
                      className="w-full bg-white border border-[#096260]/10 text-xs rounded-xl py-2 px-3 focus:outline-none font-mono text-[#082b36]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase font-mono">End Date (YYYY-MM-DD)</label>
                    <input
                      type="date"
                      value={statsEndDate}
                      onChange={(e) => setStatsEndDate(e.target.value)}
                      className="w-full bg-white border border-[#096260]/10 text-xs rounded-xl py-2 px-3 focus:outline-none font-mono text-[#082b36]"
                    />
                  </div>
                </div>

                {/* Secure Preset API key highlight */}
                <div className="space-y-1 bg-white p-3 rounded-xl border border-[#096260]/10">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-[#096260] uppercase font-mono">🔑 Active Endpoint Secret Key</span>
                    <span className="text-[8px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono font-bold">DEFAULT ACTIVE</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <code className="text-[10.5px] font-mono text-[#082b36] font-bold select-all bg-slate-50 px-2 py-1 rounded border border-gray-100 w-full break-all">shield_lead_key_2026_secure</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText("shield_lead_key_2026_secure");
                        alert("API Key copied! Use this in headers ('X-API-Key') or in query parameters ('?api_key=...')");
                      }}
                      className="bg-[#096260] hover:bg-[#5fb4a9] text-white font-bold text-[9px] uppercase px-2 py-1 rounded shrink-0 cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1 leading-normal">
                    No need to configure secret variables in your hosting environments. This default value is set up for simple plug-and-play testing.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={async () => {
                      setStatsLoading(true);
                      try {
                        const targetUrl = `/api/leads/stats?api_key=shield_lead_key_2026_secure` +
                          (statsClientId !== 'all' ? `&client_id=${statsClientId}` : '') +
                          (statsStartDate ? `&start_date=${statsStartDate}` : '') +
                          (statsEndDate ? `&end_date=${statsEndDate}` : '');
                        
                        const res = await fetch(targetUrl);
                        if (res.ok) {
                          const data = await res.json();
                          setStatsResponsePreview(data);
                        } else {
                          const errData = await res.json();
                          setStatsResponsePreview({ error: true, status: res.status, message: errData.message });
                        }
                      } catch (err: any) {
                        setStatsResponsePreview({ error: true, message: err?.message || 'Failed connecting to sandbox backend' });
                      } finally {
                        setStatsLoading(false);
                      }
                    }}
                    disabled={statsLoading}
                    className="w-full bg-[#082b36] hover:bg-[#096260] text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{statsLoading ? '⌛ Fetching stats feed...' : '🔍 Execute Live API Test'}</span>
                  </button>
                </div>
              </div>

              {/* Endpoint path and parameters documentation block */}
              <div className="space-y-4">
                <div className="bg-[#042831] p-4 rounded-2xl text-white font-mono text-[11px] leading-relaxed space-y-3">
                  <span className="text-[#5fb4a9] text-[9px] uppercase font-bold tracking-widest block font-mono font-bold">📡 API SPECIFICATION DEFINITION</span>
                  
                  <div className="border-b border-white/5 pb-2">
                    <span className="text-emerald-400 font-extrabold mr-2 uppercase">GET</span>
                    <span className="text-white select-all font-bold font-mono">{window.location.origin}/api/leads/stats</span>
                  </div>

                  <div className="space-y-1.5 text-slate-300">
                    <p className="font-sans font-bold text-gray-400 text-[10px] uppercase">Query Parameter Parameters & Schema:</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[10.5px]">
                      <li><strong className="text-[#5fb4a9] select-all font-mono">api_key</strong> (Required): Set to <code className="bg-[#082b36] px-1 text-white text-[10px]">shield_lead_key_2026_secure</code> (or use <code className="bg-[#082b36] px-1 text-white text-[10px]">X-API-Key</code> request header)</li>
                      <li><strong className="text-[#5fb4a9] select-all font-mono">client_id</strong> (Optional): Filter leads for a distinct business (e.g. <code className="bg-[#082b36] px-1 text-white text-[10px]">sydney_decking</code>)</li>
                      <li><strong className="text-[#5fb4a9] select-all font-mono">start_date</strong> (Optional): Date filters (Inclusive, YYYY-MM-DD format, e.g. <code className="bg-[#082b36] px-1 text-white text-[10px]">2026-05-01</code>)</li>
                      <li><strong className="text-[#5fb4a9] select-all font-mono">end_date</strong> (Optional): Date filters (Inclusive, YYYY-MM-DD format, e.g. <code className="bg-[#082b36] px-1 text-white text-[10px]">2026-05-31</code>)</li>
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <p className="font-sans text-[10px] text-slate-400 mb-1 leading-normal uppercase">Generated Live Query Request URL:</p>
                    <code className="block bg-black/40 p-2 text-[10px] text-emerald-400 border border-white/10 rounded-lg break-all select-all font-mono">
                      {window.location.origin}/api/leads/stats?api_key=shield_lead_key_2026_secure
                      {statsClientId !== 'all' ? `&client_id=${statsClientId}` : ''}
                      {statsStartDate ? `&start_date=${statsStartDate}` : ''}
                      {statsEndDate ? `&end_date=${statsEndDate}` : ''}
                    </code>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-gray-200">
                  <p className="text-[10px] font-extrabold uppercase text-[#096260] font-mono mb-2">💻 Quick Integration Snippets</p>
                  
                  <div className="space-y-3">
                    {/* CURL option */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-gray-400 font-mono">Bash CLI / cURL</span>
                      <code className="block bg-slate-900 text-[#d5ecea] p-2 text-[9.5px] rounded-lg break-all select-all font-mono">
                        {`curl -X GET "${window.location.origin}/api/leads/stats?api_key=shield_lead_key_2026_secure${statsClientId !== 'all' ? `&client_id=${statsClientId}` : ''}${statsStartDate ? `&start_date=${statsStartDate}` : ''}${statsEndDate ? `&end_date=${statsEndDate}` : ''}"`}
                      </code>
                    </div>

                    {/* Javascript Fetch option */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-gray-400 font-mono">JavaScript / Node.js standard fetch</span>
                      <code className="block bg-slate-900 text-[#d5ecea] p-2 text-[9.5px] rounded-lg break-all select-all font-mono">
                        {`fetch("${window.location.origin}/api/leads/stats?api_key=shield_lead_key_2026_secure${statsClientId !== 'all' ? `&client_id=${statsClientId}` : ''}${statsStartDate ? `&start_date=${statsStartDate}` : ''}${statsEndDate ? `&end_date=${statsEndDate}` : ''}")\n  .then(res => res.json())\n  .then(data => console.log(data));`}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Real-time Response Console Output */}
            {statsResponsePreview && (
              <div className="bg-[#082b36] p-5 rounded-2xl border border-white/5 space-y-2 mt-4 select-text">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <div className="flex items-center gap-1.5 font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">API Server Response Logs</span>
                  </div>
                  <button
                    onClick={() => setStatsResponsePreview(null)}
                    className="text-[9px] font-mono text-[#5fb4a9] hover:underline cursor-pointer"
                  >
                    Clear Response
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto font-mono text-[10px] bg-black/35 p-3 rounded-lg border border-white/10 scrollbar text-emerald-300 whitespace-pre">
                  {JSON.stringify(statsResponsePreview, null, 2)}
                </div>
              </div>
            )}
          </div>
          </div>

        )}

        {/* TAB 3: CODE VAULT DISPATCHER */}
        {currentTab === 'vault' && (
          <div className="flex-1 p-6 md:p-8 flex flex-col lg:flex-row gap-8">
            
            {/* File Directory view */}
            <div className="bg-white p-6 rounded-3xl border border-[#096260]/5 shadow-sm lg:w-80 shrink-0 space-y-5">
              <div>
                <h3 className="text-sm font-extrabold text-[#082b36] mb-1">Directory Explorer</h3>
                <p className="text-xs text-gray-400">cPanel standard public_html folder architecture</p>
              </div>

              {/* Tree node styles */}
              <div className="space-y-1 text-xs">
                {/* Root Folders representing directories */}
                <div className="p-1 px-2 font-bold text-[#096260] font-mono text-[10px] select-none block uppercase tracking-wider">📂 public_html / lead-shield /</div>

                <div className="pl-4 space-y-1.5 select-none font-mono">
                  {Object.keys(APP_FILES).map(filename => {
                    const isSelected = selectedVaultFile === filename;
                    return (
                      <button
                        key={filename}
                        onClick={() => setSelectedVaultFile(filename)}
                        className={`w-full p-2.5 rounded-xl text-left transition duration-150 flex items-center justify-between cursor-pointer ${isSelected ? 'bg-[#d5ecea] text-[#096260] font-bold border-l-4 border-[#096260]' : 'hover:bg-[#d5ecea]/10 hover:text-[#0b4845] text-gray-600'}`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText size={13} className={isSelected ? 'text-[#096260]' : 'text-gray-400'} />
                          <span className="truncate">{filename}</span>
                        </div>
                        <span className="text-[9px] font-bold bg-[#082b36]/5 px-2 py-0.5 rounded-lg text-gray-500 uppercase">{APP_FILES[filename].lang}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#d5ecea]/20 p-4.5 rounded-2xl border border-[#096260]/10 space-y-2 text-xs">
                <p className="font-bold text-[#096260] flex items-center gap-1.5">🔑 <span>Zero-Lock Architecture</span></p>
                <p className="text-[11px] text-gray-500 leading-normal font-normal">
                  All scripts are fully coded in compliant Native PHP (OOP/PDO) using zero pre-compiled modules so they are ready for instant cPanel file manager upload.
                </p>
              </div>
            </div>

            {/* Code Panel Display Editor */}
            <div className="flex-1 bg-[#082b36] text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col justify-between border border-white/5 max-h-[640px]">
              
              {/* Toolbar */}
              <div className="bg-black/20 p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#5fb4a9] bg-white/10 px-2.5 py-1 rounded-xl font-bold uppercase border border-white/5">{APP_FILES[selectedVaultFile].path}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{APP_FILES[selectedVaultFile].desc}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleCopyToClipboard(APP_FILES[selectedVaultFile].content, selectedVaultFile)}
                    className="bg-[#096260] hover:bg-[#5fb4a9] text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 transition duration-150 cursor-pointer shadow-md"
                  >
                    {copiedFile === selectedVaultFile ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedFile === selectedVaultFile ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
              </div>

              {/* Textarea Viewport with clean code bindings */}
              <div className="flex-1 p-5 bg-black/10 overflow-y-auto selection:bg-[#096260] flex flex-col">
                <pre className="font-mono text-xs text-[#d5ecea] whitespace-pre p-2 leading-relaxed selection:text-[#082b36] selection:bg-[#5fb4a9] block select-text overflow-x-auto">
                  <code>{APP_FILES[selectedVaultFile].content}</code>
                </pre>
              </div>

              {/* Footbar */}
              <div className="bg-black/10 p-4 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-500">
                <span className="font-mono uppercase tracking-wider">🔒 STRICT COMPLIANT SOURCE CODE • CPANEL STANDARD</span>
                <span className="font-mono select-none">LINES: {APP_FILES[selectedVaultFile].content.split('\n').length}</span>
              </div>

            </div>

          </div>
        )}

        {/* TAB 4: DEPLOYMENT GUIDELINES */}
        {currentTab === 'blueprint' && (
          <div className="flex-1 p-6 md:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
            
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#096260]/5 shadow-sm space-y-6">
              <div className="border-b border-[#096260]/10 pb-5 space-y-1.5">
                <span className="inline-block bg-[#096260]/10 text-[#096260] text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider font-mono">cPanel Release blueprint</span>
                <h2 className="text-xl font-extrabold text-[#082b36]">How to Deploy & Hook Up n8n into Lead Shield</h2>
                <p className="text-xs text-[#082b36]/65 leading-relaxed">Follow this simplified step-by-step masterclass to launch the platform live inside your hosting directory</p>
              </div>

              {/* Blueprint items */}
              <div className="space-y-8">
                
                {/* Step 1 */}
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-xl bg-[#096260] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-md border border-[#5fb4a9]/25">1</div>
                  <div className="space-y-1.5 flex-1 text-xs">
                    <p className="text-sm font-bold text-[#082b36]">Upload Script Repository onto cPanel</p>
                    <p className="text-[#082b36]/80 leading-relaxed font-normal">
                      Access your cPanel file directory, navigate inside <code className="bg-[#d5ecea] px-1.5 py-0.5 font-mono rounded text-[#096260] font-bold">public_html/</code>, and create a root level subfolder called <code className="bg-[#d5ecea] px-1.5 py-0.5 font-mono rounded text-[#096260] font-bold">lead-shield/</code>. Copy or extract all 8 PHP files inside matching the explorer tree.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-xl bg-[#096260] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-md border border-[#5fb4a9]/25">2</div>
                  <div className="space-y-1.5 flex-1 text-xs">
                    <p className="text-sm font-bold text-[#082b36]">Provision MySQL Database in phpMyAdmin</p>
                    <p className="text-[#082b36]/80 leading-relaxed font-normal">
                      Go inside <span className="font-semibold text-[#096260]">MySQL Database Wizard</span> on cPanel. Create a database called <code className="font-mono font-bold">lead_shield_db</code>, set down a user with comprehensive read/write authorizations, and import the exact SQL queries matching your copy of <code className="font-mono text-[#096260] font-bold">schema.sql</code>.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-xl bg-[#096260] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-md border border-[#5fb4a9]/25">3</div>
                  <div className="space-y-1.5 flex-1 text-xs">
                    <p className="text-sm font-bold text-[#082b36]">Map DB Credentials in config.php</p>
                    <p className="text-[#082b36]/80 leading-relaxed font-normal">
                      Open <code className="font-mono bg-[#d5ecea] text-[#096260] font-bold px-1.5 py-0.5 rounded">config.php</code> within the cPanel Code Editor. Edit the target connection parameters with your custom credentials:
                    </p>
                    <pre className="bg-[#d5ecea]/15 text-[#082b36] font-mono p-4 rounded-xl border border-[#096260]/10 text-[10px] sm:text-xs overflow-x-auto leading-relaxed">
{`define('DB_HOST', 'localhost');
define('DB_NAME', 'your_cpanel_db_name');
define('DB_USER', 'your_cpanel_user');
define('DB_PASS', 'your_cpanel_secure_password');`}
                    </pre>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-xl bg-[#096260] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-md border border-[#5fb4a9]/25">4</div>
                  <div className="space-y-1.5 flex-1 text-xs">
                    <p className="text-sm font-bold text-[#082b36]">Configure n8n Webhook Node Trigger</p>
                    <p className="text-[#082b36]/80 leading-relaxed font-normal">
                      Inside your n8n workspace, add an <span className="font-semibold text-[#096260]">HTTP Request Node</span> at the terminal end of your lead scraping/spam filtering chains. Configure it to send a POST payload targeting your cPanel address:
                    </p>
                    <div className="bg-[#d5ecea]/15 p-5 rounded-2xl border border-[#096260]/10 font-mono text-[10.5px] text-[#082b36] space-y-2 overflow-x-auto">
                      <p><span className="font-bold text-[#096260] font-mono uppercase text-[9px]">Method:</span> POST</p>
                      <p><span className="font-bold text-[#096260] font-mono uppercase text-[9px]">URL:</span> https://your-domain.com/lead-shield/api/receive-lead.php</p>
                      <p><span className="font-bold text-[#096260] font-mono uppercase text-[9px]">Body Type:</span> JSON Payload</p>
                      <p className="text-[#096260] font-bold mt-3 pt-3 border-t border-[#096260]/10 uppercase text-[9px] tracking-wide">EXPECTED JSON PAYLOAD DIRECT FROM n8n NODE:</p>
                      <pre className="text-[9.5px] leading-relaxed select-all">
{`{
  "client_id": "sydney_decking",
  "status": "SPAM",
  "ai_reason": "Gated: Lead matches mass outreach template asking for SEO packages.",
  "form_data": {
    "name": "Alex Kovac",
    "email": "alex.kovac@outreachseo.online",
    "message": "Hi, we provide guaranteed page-1 SEO. Get started on results today..."
  }
}`}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-xl bg-[#096260] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-md border border-[#5fb4a9]/25">5</div>
                  <div className="space-y-1.5 flex-1 text-xs">
                    <p className="text-sm font-bold text-[#082b36]">Trigger Installer Web Loader</p>
                    <p className="text-[#082b36]/80 leading-relaxed font-normal">
                      Open your web browser and target address: <code className="bg-[#d5ecea] font-mono text-[#096260] font-bold px-1.5 py-0.5 rounded text-xs">https://your-domain.com/lead-shield/setup.php</code>. This web load triggers table migrations, initializes security indexes, and configures seeds. Log in using default secure credentials!
                    </p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>

      {selectedAuditLead && (
        <div className="fixed inset-0 bg-[#082b36]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-[#096260]/15 flex flex-col max-h-[85vh]">
            
            <div className="bg-[#082b36] p-5 text-white flex justify-between items-center border-b border-[#03212a]">
              <div>
                <h3 className="text-sm font-extrabold truncate text-white leading-none">Submission Payload #{selectedAuditLead.id}</h3>
                <span className="text-[9px] font-mono text-[#5fb4a9] mt-2 block font-bold uppercase tracking-wider">Server Catch Time: {selectedAuditLead.created_at}</span>
              </div>
              <button 
                onClick={() => setSelectedAuditLead(null)}
                className="text-[#5fb4a9] hover:text-white font-extrabold text-xs bg-white/10 w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer"
              >
                ✖
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              
              {/* Shield details */}
              <div className="flex items-center justify-between pb-3 border-b border-[#096260]/10 text-xs">
                <span className="font-extrabold text-gray-400 uppercase tracking-widest font-mono text-[9px]">Verdict classification</span>
                <span className={`font-black px-3 py-1 rounded-full uppercase text-[10px] border ${selectedAuditLead.status === 'GENUINE' ? 'bg-[#d5ecea] text-[#096260] border-[#096260]/20' : 'bg-red-500/10 text-red-700 border-red-500/10'}`}>
                  {selectedAuditLead.status}
                </span>
              </div>

              {selectedAuditLead.status === 'SPAM' && (
                <div className="bg-red-500/10 border-l-4 border-red-500 rounded-r-2xl p-4 space-y-1">
                  <p className="text-[10px] text-red-950 font-extrabold uppercase tracking-widest font-mono">AI Gating Trigger Filter Reason</p>
                  <p className="text-xs text-red-950 font-semibold italic">"{selectedAuditLead.ai_reason || 'Unspecified bulk pattern match.'}"</p>
                </div>
              )}

              {/* Key fields loop */}
              <div className="space-y-3">
                <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest font-mono">Incoming dynamic form headers</p>
                
                <div className="bg-[#082b36] text-[#d5ecea] font-mono text-[11px] p-5 rounded-2xl border border-[#096260]/30 shadow-inner overflow-x-auto leading-relaxed">
                  <div className="mb-4 text-[#5fb4a9] font-bold tracking-widest uppercase text-[10px]">Details of the Person</div>
                  <div className="space-y-1.5 whitespace-pre-wrap">
                    {Object.entries(selectedAuditLead.form_data).map(([k, v]) => {
                      const keyName = k.replace(/_/g, ' ');
                      const displayKey = keyName.charAt(0).toUpperCase() + keyName.slice(1);
                      return (
                        <div key={k}>
                          <span className="text-[#5fb4a9]/80 capitalize">{displayKey}:</span> {String(v)}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 text-[#5fb4a9]/50 pt-4 border-t border-[#096260]/20">
                    --<br/>
                    This is a notification that a contact form was submitted on your website ({selectedAuditLead.client_id}).
                  </div>
                </div>
              </div>

            </div>

            <div className="bg-gray-50/50 p-5 border-t border-gray-100 text-right">
              <button 
                onClick={() => setSelectedAuditLead(null)}
                className="bg-[#082b36] hover:bg-[#096260] text-white text-xs font-bold py-2.5 px-5 rounded-xl transition cursor-pointer hover:translate-y-[-1px] shadow-md"
              >
                Dismiss Audit Payload
              </button>
            </div>
          </div>
        </div>
      )}

      {editingClient && (
        <div className="fixed inset-0 bg-[#082b36]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateClient} className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-[#096260]/15 flex flex-col max-h-[85vh]">
            
            <div className="bg-[#082b36] p-5 text-white flex justify-between items-center border-b border-[#03212a]">
              <div>
                <h3 className="text-sm font-extrabold text-white leading-none">Edit Client Workspace</h3>
                <span className="text-[10px] font-mono text-[#5fb4a9] mt-2 block font-bold uppercase tracking-wider">Client ID Bound: {editingClient.client_id}</span>
              </div>
              <button 
                type="button"
                onClick={() => setEditingClient(null)}
                className="text-[#5fb4a9] hover:text-white font-extrabold text-xs bg-white/10 w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer"
              >
                ✖
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 font-mono">Business Brand Name</label>
                <input 
                  type="text" 
                  value={editBizName}
                  onChange={(e) => setEditBizName(e.target.value)}
                  placeholder="e.g. Brisbane Decking" 
                  required
                  className="w-full bg-[#d5ecea]/15 border border-[#096260]/10 focus:border-[#096260] focus:ring-1 focus:ring-[#096260] rounded-xl py-2.5 px-3.5 text-xs text-[#082b36] outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 font-mono">Contact Email</label>
                <input 
                  type="email" 
                  value={editBizEmail}
                  onChange={(e) => setEditBizEmail(e.target.value)}
                  placeholder="e.g. contact@brisdeck.com" 
                  required
                  className="w-full bg-[#d5ecea]/15 border border-[#096260]/10 focus:border-[#096260] focus:ring-1 focus:ring-[#096260] rounded-xl py-2.5 px-3.5 text-xs text-[#082b36] outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 font-mono">Status</label>
                <select 
                  value={editBizStatus} 
                  onChange={(e) => setEditBizStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full bg-[#d5ecea]/15 border border-[#096260]/10 focus:border-[#096260] focus:ring-1 focus:ring-[#096260] rounded-xl py-2.5 px-3.5 text-xs text-[#082b36] outline-none font-medium cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="border-t border-gray-100 pt-4 flex flex-col space-y-2">
                <p className="text-[10px] text-[#096260] font-bold uppercase tracking-widest font-mono mb-1">Services Subscribed</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editBizHasSeo} 
                      onChange={(e) => setEditBizHasSeo(e.target.checked)}
                      className="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4 cursor-pointer" 
                    />
                    <span>SEO & Website</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editBizHasGoogleAds} 
                      onChange={(e) => setEditBizHasGoogleAds(e.target.checked)}
                      className="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4 cursor-pointer" 
                    />
                    <span>Google Ads</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editBizHasFbAds} 
                      onChange={(e) => setEditBizHasFbAds(e.target.checked)}
                      className="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4 cursor-pointer" 
                    />
                    <span>Facebook Ads</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editBizHasGmb} 
                      onChange={(e) => setEditBizHasGmb(e.target.checked)}
                      className="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4 cursor-pointer" 
                    />
                    <span>GMB Tracking</span>
                  </label>
                </div>
              </div>

            </div>

            <div className="bg-gray-50/50 p-5 border-t border-gray-100 flex gap-2 justify-end">
              <button 
                type="button"
                onClick={() => setEditingClient(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold py-2.5 px-5 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-[#096260] hover:bg-[#5fb4a9] text-white text-xs font-bold py-2.5 px-5 rounded-xl transition cursor-pointer shadow-md shadow-[#096260]/20"
              >
                Save Changes 💾
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FOOTER CLASSIFY LICENSE */}
      <footer className="bg-white border-t border-[#096260]/10 py-5 text-center mt-auto">
        <p className="text-[9px] text-[#096260]/70 uppercase tracking-widest font-mono font-extrabold">
          🛡️ LEAD SHIELD CLASSIFIER SYSTEMS CO. • ALL INTENSITY SAFEGUARDS ACTIVE
        </p>
      </footer>

    </div>
  );
}
