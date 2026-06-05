<?php
/**
 * Lead Shield - Outbound Secure Pull API
 * Allows external systems (CRMs, Google Sheets, Zapier, custom portals) to retrieve genuine lead counts and lists.
 * Path: /lead-shield/api/get-leads.php
 */

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-[#096260], Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once '../config.php';

// Accept credentials via GET/POST query parameters or HTTP Basic Auth
$client_id = trim($_REQUEST['client_id'] ?? '');
$username = trim($_REQUEST['username'] ?? '');
$password = trim($_REQUEST['password'] ?? '');
$action = strtolower(trim($_REQUEST['action'] ?? 'leads')); // 'leads' or 'stats'
$status_filter = strtoupper(trim($_REQUEST['status'] ?? 'GENUINE')); // 'GENUINE' or 'SPAM' or 'ALL'

// Support HTTP Basic Auth as a premium developer alternative
if (isset($_SERVER['PHP_AUTH_USER']) && isset($_SERVER['PHP_AUTH_PW'])) {
    $username = trim($_SERVER['PHP_AUTH_USER']);
    $password = trim($_SERVER['PHP_AUTH_PW']);
}

// 1. Parameter Validation Guards
if (empty($client_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error", 
        "message" => "Bad Request: Missing client_id parameter."
    ]);
    exit;
}

if (empty($username) || empty($password)) {
    http_response_code(401);
    echo json_encode([
        "status" => "error", 
        "message" => "Unauthorized: Authentication required. Provide 'username' & 'password' query params or use Basic Authentication headers."
    ]);
    exit;
}

try {
    $db = getDBConnection();

    // 2. Authenticate the user credentials
    $userQuery = $db->prepare("SELECT * FROM users WHERE username = ? AND client_id = ?");
    $userQuery->execute([$username, $client_id]);
    $user = $userQuery->fetch();

    if (!$user) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Authentication Failed: Incorrect workspace credential combination."
        ]);
        exit;
    }

    // Verify Password Hash
    // Note: For compatibility we support both pre-hashed blowfish/argon2 verification and fallback raw equality for sample seeds.
    $passwordValid = false;
    if (password_verify($password, $user['password'])) {
        $passwordValid = true;
    } else if ($password === $user['password']) {
        // Fallback for simple database seeds
        $passwordValid = true;
    }

    if (!$passwordValid) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Authentication Failed: Incorrect credential passwords for the workspace."
        ]);
        exit;
    }

    // 3. Verify if Client Workspace exists and is active
    $clientQuery = $db->prepare("SELECT * FROM clients WHERE client_id = ?");
    $clientQuery->execute([$client_id]);
    $client = $clientQuery->fetch();

    if (!$client) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Tenant Denied: Client details not found."
        ]);
        exit;
    }

    if ($client['status'] !== 'active') {
        http_response_code(403);
        echo json_encode([
            "status" => "error", 
            "message" => "Workspace locked: This tenant account is temporarily suspended/inactive."
        ]);
        exit;
    }

    // 4. Calculate stats summary regardless of state to enrich the payload
    $countQuery = $db->prepare("SELECT status, COUNT(*) as count FROM leads WHERE client_id = ? GROUP BY status");
    $countQuery->execute([$client_id]);
    $counts = $countQuery->fetchAll();

    $genuineCount = 0;
    $spamCount = 0;

    foreach ($counts as $row) {
        if ($row['status'] === 'GENUINE') {
            $genuineCount = intval($row['count']);
        } elseif ($row['status'] === 'SPAM') {
            $spamCount = intval($row['count']);
        }
    }

    $summary = [
        "client_id" => $client_id,
        "business_name" => $client['business_name'],
        "contact_email" => $client['contact_email'],
        "status" => $client['status'],
        "stats" => [
            "genuine_leads_count" => $genuineCount,
            "spam_blocked_count" => $spamCount,
            "total_leads_received" => ($genuineCount + $spamCount)
        ]
    ];

    // If only requesting stats, return now
    if ($action === 'stats') {
        http_response_code(200);
        echo json_encode([
            "status" => "success",
            "timestamp" => date('Y-m-d H:i:s'),
            "summary" => $summary
        ]);
        exit;
    }

    // 5. Query actual leads
    $sql = "SELECT id, form_data, status, ai_reason, channel, created_at FROM leads WHERE client_id = ?";
    $params = [$client_id];

    if ($status_filter !== 'ALL') {
        $sql .= " AND status = ?";
        $params[] = $status_filter;
    }

    $sql .= " ORDER BY created_at DESC LIMIT 200"; // Safeguard to prevent database memory exhaustion

    $leadQuery = $db->prepare($sql);
    $leadQuery->execute($params);
    $leadsRaw = $leadQuery->fetchAll();

    $leadsProcessed = [];
    foreach ($leadsRaw as $lead) {
        // Decode raw form data safely
        $formData = json_decode($lead['form_data'], true);
        $leadsProcessed[] = [
            "id" => intval($lead['id']),
            "captured_at" => $lead['created_at'],
            "status" => $lead['status'],
            "ai_reason" => $lead['ai_reason'],
            "channel" => $lead['channel'] ?? 'website',
            "payload" => $formData ?: $lead['form_data']
        ];
    }

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "timestamp" => date('Y-m-d H:i:s'),
        "summary" => $summary,
        "leads" => $leadsProcessed
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error", 
        "message" => "Database Transaction Failure inside Lead Shield system error: " . $e->getMessage()
    ]);
}
?>
