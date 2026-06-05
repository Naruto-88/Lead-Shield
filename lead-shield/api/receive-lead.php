<?php
/**
 * Lead Shield - Central Reception API Webhook
 * Endpoint for incoming leads via n8n, Make, or custom web forms.
 * Path: /api/receive-lead.php
 */

// Allow JSON payloads from external client systems
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once '../config.php';

// Only process POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method Not Allowed. Only POST is allowed."]);
    exit;
}

// Extract raw POST payload data
$jsonPayload = file_get_contents("php://input");
$data = json_decode($jsonPayload, true);

if ($data === null) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Bad Request: Invalid or corrupt JSON payload."]);
    exit;
}

// Extract parameters
$client_id = trim($data['client_id'] ?? '');
$status = strtoupper(trim($data['status'] ?? 'GENUINE'));
$ai_reason = trim($data['ai_reason'] ?? '');
$channel = strtolower(trim($data['channel'] ?? 'website'));
$form_data = $data['form_data'] ?? null;

// Validation Integrity Guards
if (empty($client_id)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Validation Failure: Missing 'client_id'."]);
    exit;
}

if (!in_array($status, ['GENUINE', 'SPAM'])) {
    $status = 'GENUINE'; // Fallback to safe default
}

if (!in_array($channel, ['website', 'google_ads', 'facebook_ads', 'gmb'])) {
    $channel = 'website'; // Fallback to safe default
}

if ($form_data === null || (!is_array($form_data) && !is_object($form_data))) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Validation Failure: 'form_data' must be a non-empty object/array."]);
    exit;
}

try {
    $db = getDBConnection();

    // 1. Verify if Client ID exists AND is ACTIVE
    $clientQuery = $db->prepare("SELECT status FROM clients WHERE client_id = ?");
    $clientQuery->execute([$client_id]);
    $client = $clientQuery->fetch();

    if (!$client) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Tenant Denied: Client ID '{$client_id}' does not exist."]);
        exit;
    }

    if ($client['status'] !== 'active') {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "Tenant Locked: Client workspace is currently inactive."]);
        exit;
    }

    // Convert form_data to JSON string for DB safety (MySQL JSON compliance check)
    $formDataJson = json_encode($form_data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    // 2. Insert Lead Records
    $insertQuery = $db->prepare("INSERT INTO leads (client_id, form_data, status, ai_reason, channel) VALUES (?, ?, ?, ?, ?)");
    $insertQuery->execute([
        $client_id,
        $formDataJson,
        $status,
        !empty($ai_reason) ? $ai_reason : null,
        $channel
    ]);

    // Send HTTP Response confirmation code 201 Created
    http_response_code(201);
    echo json_encode([
        "status" => "success",
        "message" => "Lead captured and processed securely via Lead Shield central recipient.",
        "lead_id" => $db->lastInsertId(),
        "tenant_id" => $client_id,
        "classification" => $status
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database Transaction Failure: " . $e->getMessage()]);
}
?>
