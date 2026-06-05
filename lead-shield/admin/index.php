<?php
/**
 * Lead Shield - Super Admin Dashboard Control Center
 * Path: /admin/index.php
 * Handles master statistics, multi-tenant Client CRUD, and lead audit grids.
 */

require_once '../config.php';

// Protect directory with strict session role gating
requireRole('admin');

$db = getDBConnection();
$statusMessage = '';
$errorMessage = '';

// =====================================================================
// ACTION CONTROLLER: CLIENT CRUD
// =====================================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    
    // ACTION: ADD NEW CLIENT & USER PORTAL CREDENTIALS
    if ($_POST['action'] === 'add_client') {
        $business_name = trim($_POST['business_name'] ?? '');
        $contact_email = trim($_POST['contact_email'] ?? '');
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        
        $has_seo = isset($_POST['has_seo']) ? 1 : 0;
        $has_google_ads = isset($_POST['has_google_ads']) ? 1 : 0;
        $has_fb_ads = isset($_POST['has_fb_ads']) ? 1 : 0;
        $has_gmb = isset($_POST['has_gmb']) ? 1 : 0;
        
        // Auto-generate client_id from business name (lowercase, replace alphanumeric with underscore)
        $client_id = preg_replace('/[^a-z0-9_]/', '', str_replace(' ', '_', strtolower($business_name)));
        
        // Guard against duplicate IDs or empty inputs
        if (empty($business_name) || empty($contact_email) || empty($username) || empty($password)) {
            $errorMessage = 'All Fields are strictly required to onboard a new tenant client.';
        } else {
            try {
                $db->beginTransaction();
                
                // 1. Verify Client ID / Username unique guard
                $checkClient = $db->prepare("SELECT client_id FROM clients WHERE client_id = ?");
                $checkClient->execute([$client_id]);
                if ($checkClient->fetch()) {
                    // Append random bytes to make client_id unique
                    $client_id .= '_' . rand(10, 99);
                }
                
                $checkUser = $db->prepare("SELECT id FROM users WHERE username = ?");
                $checkUser->execute([$username]);
                if ($checkUser->fetch()) {
                    throw new Exception("Username '{$username}' already exists. Select another user handle.");
                }

                // 2. Insert into clients (including the 4 subscription services)
                $insertClient = $db->prepare("INSERT INTO clients (client_id, business_name, contact_email, status, has_seo, has_google_ads, has_fb_ads, has_gmb) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)");
                $insertClient->execute([$client_id, $business_name, $contact_email, $has_seo, $has_google_ads, $has_fb_ads, $has_gmb]);
                
                // 3. Create respective client login credentials (Role: client)
                $hashedPass = password_hash($password, PASSWORD_BCRYPT);
                $insertUser = $db->prepare("INSERT INTO users (username, email, password, role, client_id) VALUES (?, ?, ?, 'client', ?)");
                $insertUser->execute([$username, $contact_email, $hashedPass, $client_id]);
                
                $db->commit();
                $statusMessage = "Tenant client '{$business_name}' successfully onboarded with ID '{$client_id}'. Portal login is live!";
                
            } catch (Exception $e) {
                $db->rollBack();
                $errorMessage = "Failed to board Client Workspace: " . $e->getMessage();
            }
        }
    }

    // ACTION: EDIT CLIENT CONTACT & METRICS & SERVICES
    if ($_POST['action'] === 'edit_client') {
        $client_id = $_POST['client_id'] ?? '';
        $business_name = trim($_POST['business_name'] ?? '');
        $contact_email = trim($_POST['contact_email'] ?? '');
        $status = $_POST['status'] ?? 'active';

        if (empty($client_id) || empty($business_name) || empty($contact_email)) {
            $errorMessage = 'Invalid Parameters: Client details cannot be empty.';
        } else {
            try {
                // Determine if this is a full-form edit containing services checkboxes, or a quick status toggle
                if (isset($_POST['is_full_edit']) && $_POST['is_full_edit'] === '1') {
                    $has_seo = isset($_POST['has_seo']) ? 1 : 0;
                    $has_google_ads = isset($_POST['has_google_ads']) ? 1 : 0;
                    $has_fb_ads = isset($_POST['has_fb_ads']) ? 1 : 0;
                    $has_gmb = isset($_POST['has_gmb']) ? 1 : 0;
                    
                    $update = $db->prepare("UPDATE clients SET business_name = ?, contact_email = ?, status = ?, has_seo = ?, has_google_ads = ?, has_fb_ads = ?, has_gmb = ? WHERE client_id = ?");
                    $update->execute([$business_name, $contact_email, $status, $has_seo, $has_google_ads, $has_fb_ads, $has_gmb, $client_id]);
                } else {
                    $update = $db->prepare("UPDATE clients SET business_name = ?, contact_email = ?, status = ? WHERE client_id = ?");
                    $update->execute([$business_name, $contact_email, $status, $client_id]);
                }
                $statusMessage = "Client workspace ID '{$client_id}' updated successfully.";
            } catch (PDOException $e) {
                $errorMessage = "Update database failure: " . $e->getMessage();
            }
        }
    }

    // ACTION: DELETE CLIENT & TEARDOWN WORKSPACE
    if ($_POST['action'] === 'delete_client') {
        $client_id = $_POST['client_id'] ?? '';
        
        if (!empty($client_id)) {
            try {
                // InnoDB Foreign Keys with ON DELETE CASCADE handles users + leads records auto cleanup safely
                $delete = $db->prepare("DELETE FROM clients WHERE client_id = ?");
                $delete->execute([$client_id]);
                $statusMessage = "Client workspace '{$client_id}' and all related users & leads shredded successfully.";
            } catch (PDOException $e) {
                $errorMessage = "Delete transactional error: " . $e->getMessage();
            }
        }
    }
}

// =====================================================================
// DATA RETRIEVAL LOGIC
// =====================================================================

// 1. Fetch Global Statistics Counts
try {
    $stat_total_leads = $db->query("SELECT COUNT(*) FROM leads")->fetchColumn();
    $stat_genuine_leads = $db->query("SELECT COUNT(*) FROM leads WHERE status = 'GENUINE'")->fetchColumn();
    $stat_spam_blocked = $db->query("SELECT COUNT(*) FROM leads WHERE status = 'SPAM'")->fetchColumn();
    $stat_active_clients = $db->query("SELECT COUNT(*) FROM clients WHERE status = 'active'")->fetchColumn();
} catch (PDOException $e) {
    $errorMessage = "Failure calculating portal stats: " . $e->getMessage();
}

// 2. Fetch all registered Clients for grids/dropdown lists
$clientsList = [];
try {
    $clientsList = $db->query("SELECT * FROM clients ORDER BY created_at DESC")->fetchAll();
} catch (PDOException $e) {
    $errorMessage = "Clients list loading failure: " . $e->getMessage();
}

// 3. Fetch Lead Feed with Filters (Tenant Filtering & Classification Gating)
$filterClient = $_GET['client_id'] ?? '';
$filterStatus = $_GET['status'] ?? '';

$leadsQueryStr = "SELECT l.*, c.business_name FROM leads l JOIN clients c ON l.client_id = c.client_id";
$whereClauses = [];
$params = [];

if (!empty($filterClient)) {
    $whereClauses[] = "l.client_id = ?";
    $params[] = $filterClient;
}
if (!empty($filterStatus)) {
    $whereClauses[] = "l.status = ?";
    $params[] = $filterStatus;
}

if (!empty($whereClauses)) {
    $leadsQueryStr .= " WHERE " . implode(" AND ", $whereClauses);
}
$leadsQueryStr .= " ORDER BY l.created_at DESC LIMIT 100";

$leadFeed = [];
try {
    $stmt = $db->prepare($leadsQueryStr);
    $stmt->execute($params);
    $leadFeed = $stmt->fetchAll();
} catch (PDOException $e) {
    $errorMessage = "Lead feed query error: " . $e->getMessage();
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lead Shield - Super Admin Dashboard</title>
    <!-- Tailwind CSS via CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        primaryGreen: '#096260',
                        secondaryTeal: '#5fb4a9',
                        darkGreen: '#082b36',
                        lightMint: '#d5ecea'
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-[#d5ecea]/40 min-h-screen font-sans text-gray-800 flex flex-col">

    <!-- TOP TELEMETRY NAVIGATION HEADER -->
    <nav class="bg-[#082b36] text-white py-4 px-6 shadow-md flex justify-between items-center border-b-2 border-[#096260]">
        <div class="flex items-center gap-3">
            <span class="text-2xl">🛡️</span>
            <div>
                <h1 class="text-lg font-bold tracking-tight">LEAD SHIELD</h1>
                <p class="text-[10px] text-[#5fb4a9] tracking-wider font-semibold uppercase">Super Admin Control Hub</p>
            </div>
        </div>
        
        <div class="flex items-center gap-4">
            <div class="text-right hidden md:block">
                <p class="text-xs text-gray-300 font-medium select-none">Logged in: <span class="text-white font-bold"><?php echo h($_SESSION['username']); ?></span></p>
                <p class="text-[9px] text-[#5fb4a9] tracking-widest font-mono">ROLE: PLATFORM ADMINISTRATOR</p>
            </div>
            <a href="../logout.php" class="bg-[#096260] hover:bg-[#5fb4a9] text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-colors duration-150 flex items-center gap-1">
                <span>Sign Out</span> 🚪
            </a>
        </div>
    </nav>

    <!-- MAIN GRID CONTAINER -->
    <main class="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">

        <!-- STATUS FEEDBACK ALERTS -->
        <?php if (!empty($statusMessage)): ?>
            <div class="bg-[#096260]/10 border-l-4 border-[#096260] text-[#082b36] p-4 rounded-xl text-sm flex items-center justify-between shadow-sm">
                <p class="font-medium">✅ <?php echo h($statusMessage); ?></p>
                <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-600 text-xs">Close</button>
            </div>
        <?php endif; ?>
        <?php if (!empty($errorMessage)): ?>
            <div class="bg-red-50 border-l-4 border-red-500 text-red-900 p-4 rounded-xl text-sm flex items-center justify-between shadow-sm">
                <p class="font-medium">⚠️ Error: <?php echo h($errorMessage); ?></p>
                <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-600 text-xs">Close</button>
            </div>
        <?php endif; ?>

        <!-- 1. STATS METRICS GRID -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Metric 1: Total Leads -->
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div class="w-12 h-12 bg-gray-100 text-[#082b36] rounded-xl flex items-center justify-center text-xl font-bold select-none">
                    📊
                </div>
                <div>
                    <h3 class="text-gray-400 text-xs font-semibold uppercase tracking-wider">Leads Analyzed</h3>
                    <p class="text-xl md:text-2xl font-bold text-[#082b36]"><?php echo h($stat_total_leads ?? 0); ?></p>
                </div>
            </div>

            <!-- Metric 2: Genuine Leads -->
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div class="w-12 h-12 bg-[#d5ecea] text-[#096260] rounded-xl flex items-center justify-center text-xl font-bold select-none">
                    📥
                </div>
                <div>
                    <h3 class="text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Genuine</h3>
                    <p class="text-xl md:text-2xl font-bold text-[#096260]"><?php echo h($stat_genuine_leads ?? 0); ?></p>
                </div>
            </div>

            <!-- Metric 3: Spam blocked -->
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div class="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center text-xl font-bold select-none">
                    🛡️
                </div>
                <div>
                    <h3 class="text-gray-400 text-xs font-semibold uppercase tracking-wider">Spam Blocked</h3>
                    <p class="text-xl md:text-2xl font-bold text-red-600"><?php echo h($stat_spam_blocked ?? 0); ?></p>
                </div>
            </div>

            <!-- Metric 4: Onboarded Clients -->
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div class="w-12 h-12 bg-[#082b36]/10 text-[#082b36] rounded-xl flex items-center justify-center text-xl font-bold select-none">
                    🏢
                </div>
                <div>
                    <h3 class="text-gray-400 text-xs font-semibold uppercase tracking-wider">Active Clients</h3>
                    <p class="text-xl md:text-2xl font-bold text-[#082b36]"><?php echo h($stat_active_clients ?? 0); ?></p>
                </div>
               <!-- 2. CLIENT MANAGEMENT CRUD & ONBOARDING SECTION -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- Onboarding Form Form -->
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-1">
                <h2 class="text-lg font-bold text-[#082b36] mb-1">Onboard New Tenant</h2>
                <p class="text-xs text-gray-400 mb-5">Generates Client login portal automatically</p>
                
                <form action="index.php" method="POST" class="space-y-4">
                    <input type="hidden" name="action" value="add_client">
                    
                    <div>
                        <label class="block text-xs font-semibold text-[#082b36] uppercase tracking-wider mb-1.5">Business Name</label>
                        <input type="text" name="business_name" placeholder="e.g. Sydney Decking" required class="w-full bg-[#d5ecea]/20 border border-gray-200 focus:border-[#096260] rounded-xl py-2 px-3 text-sm outline-none">
                    </div>
                    
                    <div>
                        <label class="block text-xs font-semibold text-[#082b36] uppercase tracking-wider mb-1.5">Primary Contact Email</label>
                        <input type="email" name="contact_email" placeholder="e.g. contact@decking.com" required class="w-full bg-[#d5ecea]/20 border border-gray-200 focus:border-[#096260] rounded-xl py-2 px-3 text-sm outline-none">
                    </div>
                    
                    <div class="border-t border-gray-100 pt-4 mt-2">
                        <p class="text-[11px] text-gray-500 uppercase tracking-widest font-mono mb-3 text-[#096260] font-bold">Portal User Credentials</p>
                        
                        <div class="space-y-3 mb-4">
                            <div>
                                <label class="block text-xs font-semibold text-[#082b36] uppercase mb-1">Username / Login ID</label>
                                <input type="text" name="username" placeholder="e.g. sydney_admin" required class="w-full bg-[#d5ecea]/20 border border-gray-200 focus:border-[#096260] rounded-xl py-1.5 px-3 text-sm outline-none font-mono text-xs">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-[#082b36] uppercase mb-1">Secure Password</label>
                                <input type="password" name="password" placeholder="••••••••" required class="w-full bg-[#d5ecea]/20 border border-gray-200 focus:border-[#096260] rounded-xl py-1.5 px-3 text-sm outline-none">
                            </div>
                        </div>
                    </div>

                    <div class="border-t border-gray-100 pt-4 mt-2">
                        <p class="text-[11px] text-[#096260] font-bold uppercase tracking-widest font-mono mb-3">Services Subscribed</p>
                        <div class="space-y-2">
                            <label class="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                                <input type="checkbox" name="has_seo" value="1" checked class="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4">
                                <span>SEO & Website Forms</span>
                            </label>
                            <label class="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                                <input type="checkbox" name="has_google_ads" value="1" class="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4">
                                <span>Google Ads</span>
                            </label>
                            <label class="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                                <input type="checkbox" name="has_fb_ads" value="1" class="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4">
                                <span>Facebook Ads</span>
                            </label>
                            <label class="flex items-center gap-2 text-xs font-semibold text-[#082b36] cursor-pointer">
                                <input type="checkbox" name="has_gmb" value="1" class="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4">
                                <span>GMB Tracking</span>
                            </label>
                        </div>
                    </div>
                    
                    <button type="submit" class="w-full bg-[#096260] hover:bg-[#5fb4a9] text-white py-2.5 rounded-xl text-xs font-semibold transition-colors duration-150 shadow-sm mt-4">
                        Provision Workspace Portals
                    </button>
                </form>
            </div>

            <!-- Onboarded Contacts Table -->
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 flex flex-col">
                <h2 class="text-lg font-bold text-[#082b36] mb-1">Provisioned Client Portals</h2>
                <p class="text-xs text-gray-400 mb-5">Active client spaces with dynamic routing tokens</p>
                
                <div class="overflow-x-auto flex-1">
                    <table class="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr class="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase">
                                <th class="pb-3">Client ID</th>
                                <th class="pb-3">Business name / contact</th>
                                <th class="pb-3">Status</th>
                                <th class="pb-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <?php if (empty($clientsList)): ?>
                                <tr>
                                    <td colspan="4" class="py-5 text-center text-gray-400 text-xs">No active agency client workspaces provisioned.</td>
                                </tr>
                            <?php else: ?>
                                <?php foreach ($clientsList as $client): ?>
                                    <tr>
                                        <td class="py-3.5">
                                            <span class="font-mono text-xs bg-gray-100 py-1 px-2.5 rounded text-[#082b36] font-semibold"><?php echo h($client['client_id']); ?></span>
                                        </td>
                                        <td class="py-3.5">
                                            <p class="font-semibold text-[#082b36]"><?php echo h($client['business_name']); ?></p>
                                            <p class="text-xs text-gray-400"><?php echo h($client['contact_email']); ?></p>
                                            <div class="flex flex-wrap gap-1 mt-1.5">
                                                <?php if (isset($client['has_seo']) && $client['has_seo']): ?>
                                                    <span class="text-[9px] font-bold font-mono bg-[#d5ecea] text-[#096260] px-1.5 py-0.5 rounded border border-[#5fb4a9]/10">SEO</span>
                                                <?php endif; ?>
                                                <?php if (isset($client['has_google_ads']) && $client['has_google_ads']): ?>
                                                    <span class="text-[9px] font-bold font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200/20">G-ADS</span>
                                                <?php endif; ?>
                                                <?php if (isset($client['has_fb_ads']) && $client['has_fb_ads']): ?>
                                                    <span class="text-[9px] font-bold font-mono bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-200/20">FB-ADS</span>
                                                <?php endif; ?>
                                                <?php if (isset($client['has_gmb']) && $client['has_gmb']): ?>
                                                    <span class="text-[9px] font-bold font-mono bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded border border-teal-200/20">GMB</span>
                                                <?php endif; ?>
                                            </div>
                                        </td>
                                        <td class="py-3.5">
                                            <span class="inline-block relative text-[10px] font-bold px-2 py-1 rounded-full uppercase <?php echo $client['status'] === 'active' ? 'bg-[#d5ecea] text-[#096260]' : 'bg-red-50 text-red-600'; ?>">
                                                <?php echo h($client['status']); ?>
                                            </span>
                                        </td>
                                        <td class="py-3.5 text-right">
                                            <div class="inline-flex gap-1.5 justify-end items-center flex-wrap">
                                                <!-- Action Buttons: Toggle, Edit, and Delete -->
                                                <form action="index.php" method="POST" class="inline">
                                                    <input type="hidden" name="action" value="edit_client">
                                                    <input type="hidden" name="client_id" value="<?php echo h($client['client_id']); ?>">
                                                    <input type="hidden" name="business_name" value="<?php echo h($client['business_name']); ?>">
                                                    <input type="hidden" name="contact_email" value="<?php echo h($client['contact_email']); ?>">
                                                    <input type="hidden" name="status" value="<?php echo $client['status'] === 'active' ? 'inactive' : 'active'; ?>">
                                                    <button type="submit" title="Toggle active status" class="text-xs bg-[#d5ecea] text-[#082b36] hover:bg-[#5fb4a9]/30 py-1 px-2 rounded font-semibold transition cursor-pointer">
                                                        Status 🔄
                                                    </button>
                                                </form>

                                                <button type="button" 
                                                    onclick='openEditClientModal(<?php echo json_encode($client, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>)' 
                                                    class="text-xs bg-[#082b36]/10 text-[#082b36] hover:bg-[#096260]/10 py-1 px-2 rounded font-bold transition cursor-pointer"
                                                >
                                                    Edit ✏️
                                                </button>
 
                                                <form action="index.php" method="POST" class="inline" onsubmit="return confirm('CRITICAL RED WARNING: Deleting this client tenant will permanently shred all user log accounts and leads history across the entire platform. This is irreversible. Confirm delete?');">
                                                    <input type="hidden" name="action" value="delete_client">
                                                    <input type="hidden" name="client_id" value="<?php echo h($client['client_id']); ?>">
                                                    <button type="submit" class="text-xs bg-red-50 hover:bg-red-100 text-red-700 py-1 px-2 rounded font-semibold transition cursor-pointer">
                                                        Shred 🗑️
                                                    </button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            
        </div>

        <!-- 3. MASTER LEAD CENTRALIZED AUDIT GRID -->
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 class="text-lg font-bold text-[#082b36] mb-1">Global Live Lead Audit Feed</h2>
                    <p class="text-xs text-gray-400">Incoming real-time lead analytics parsed through the webhook engine</p>
                </div>
                
                <!-- Filter form using GET parameters -->
                <form action="index.php" method="GET" class="flex flex-wrap gap-2 items-center">
                    <!-- Client Selector -->
                    <select name="client_id" class="bg-gray-50 text-xs border border-gray-200 rounded-lg py-2 px-3 outline-none text-[#082b36] font-medium">
                        <option value="">All Agency Clients</option>
                        <?php foreach ($clientsList as $tenant): ?>
                            <option value="<?php echo h($tenant['client_id']); ?>" <?php echo $filterClient === $tenant['client_id'] ? 'selected' : ''; ?>>
                                <?php echo h($tenant['business_name']); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>

                    <!-- Status Selector -->
                    <select name="status" class="bg-gray-50 text-xs border border-gray-200 rounded-lg py-2 px-3 outline-none text-[#082b36] font-medium">
                        <option value="">All Statuses</option>
                        <option value="GENUINE" <?php echo $filterStatus === 'GENUINE' ? 'selected' : ''; ?>>Genuine Inquiries</option>
                        <option value="SPAM" <?php echo $filterStatus === 'SPAM' ? 'selected' : ''; ?>>AI Flagged SPAM</option>
                    </select>
                    
                    <button type="submit" class="bg-[#082b36] text-white hover:bg-[#096260] text-xs font-semibold py-2 px-4 rounded-lg transition">
                        Apply Filters
                    </button>
                    <?php if (!empty($filterClient) || !empty($filterStatus)): ?>
                        <a href="index.php" class="bg-gray-100 hover:bg-gray-200 text-gray-500 font-medium text-xs py-2 px-3 rounded-lg transition">Clear</a>
                    <?php endif; ?>
                </form>
            </div>

            <!-- Table Feed Grid -->
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr class="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase">
                            <th class="pb-3 text-left">Timestamp (UTC)</th>
                            <th class="pb-3">Client Space</th>
                            <th class="pb-3">Inquiry Summary</th>
                            <th class="pb-3">Verdict</th>
                            <th class="pb-3 text-right">View Lead Payload</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <?php if (empty($leadFeed)): ?>
                            <tr>
                                <td colspan="5" class="py-6 text-center text-gray-400 text-xs">No historical lead payloads caught matching selection query guidelines.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($leadFeed as $lead): ?>
                                <?php 
                                    // Parse form_data JSON securely
                                    $formData = json_decode($lead['form_data'], true) ?? [];
                                    // Find a representation for primary display (name or message or phone or email)
                                    $summaryParts = [];
                                    $count = 0;
                                    foreach ($formData as $key => $val) {
                                        if (is_array($val)) {
                                            $val = json_encode($val);
                                        }
                                        $summaryParts[] = "<span class='font-mono text-[10px] text-gray-400'>".h($key).":</span> <strong>".h($val)."</strong>";
                                        $count++;
                                        if ($count >= 2) break; // Limit size of cell preview
                                    }
                                    $previewHtml = implode(' | ', $summaryParts);
                                ?>
                                <tr class="hover:bg-gray-50/50 transition">
                                    <td class="py-3.5 text-xs text-gray-500 font-mono">
                                        <?php echo h($lead['created_at']); ?>
                                    </td>
                                    <td class="py-3.5">
                                        <p class="font-semibold text-[#082b36]"><?php echo h($lead['business_name']); ?></p>
                                        <span class="text-[9px] font-mono text-gray-400 uppercase"><?php echo h($lead['client_id']); ?></span>
                                    </td>
                                    <td class="py-3.5 text-xs max-w-sm truncate">
                                        <div class="truncate"><?php echo $previewHtml; ?></div>
                                    </td>
                                    <td class="py-3.5">
                                        <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase <?php echo $lead['status'] === 'GENUINE' ? 'bg-[#d5ecea] text-[#096260]' : 'bg-red-50 text-red-600'; ?>">
                                            <?php echo h($lead['status']); ?>
                                        </span>
                                    </td>
                                    <td class="py-3.5 text-right">
                                        <button 
                                            onclick='openLeadModal(<?php echo json_encode([
                                                "id" => $lead["id"],
                                                "client_name" => $lead["business_name"],
                                                "status" => $lead["status"],
                                                "ai_reason" => $lead["ai_reason"],
                                                "created_at" => $lead["created_at"],
                                                "form_data" => $formData
                                            ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>)' 
                                            class="text-xs bg-[#096260] hover:bg-[#5fb4a9] text-white py-1.5 px-3 rounded-lg transition"
                                        >
                                            View Form Payload 👁️
                                        </button>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>

    </main>

    <!-- FLOATING POPUP DYNAMIC FORM VIEWER MODAL -->
    <div id="formPayloadModal" class="fixed inset-0 bg-[#082b36]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-[#5fb4a9]/30 flex flex-col max-h-[90vh]">
            <!-- Header bar -->
            <div class="bg-[#082b36] p-5 text-white flex justify-between items-center border-b-2 border-[#096260]">
                <div>
                    <h3 id="modalClientTitle" class="text-base font-bold">Client Form Structure</h3>
                    <p id="modalTimestamp" class="text-[10px] font-mono text-[#5fb4a9] mt-0.5">Caught: LOADING</p>
                </div>
                <button onclick="closeLeadModal()" class="text-[#5fb4a9] hover:text-white text-lg font-bold">✖</button>
            </div>

            <!-- Content Area (Scrollable) -->
            <div class="p-6 overflow-y-auto space-y-4">
                
                <!-- Classification Verdict Badge -->
                <div class="flex items-center justify-between pb-3 border-b border-gray-100">
                    <span class="text-xs font-semibold uppercase text-gray-400">Shield Classification Verdict</span>
                    <span id="modalVerdictBadge" class="text-xs font-bold px-3 py-1 rounded-full uppercase">GENUINE</span>
                </div>

                <!-- Spam Block Reason Section (Only shows if Spam) -->
                <div id="modalSpamCard" class="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 hidden">
                    <p class="text-xs text-red-800 font-bold uppercase tracking-wider mb-1">AI Classification Spam Shield Gating Reason</p>
                    <p id="modalSpamReason" class="text-xs text-red-700 leading-relaxed italic"></p>
                </div>

                <!-- Live Dynamic Client Form Key-Value Loop -->
                <div>
                    <h4 class="text-xs font-semibold uppercase text-gray-400 tracking-wider mb-2.5">Incoming Dynamic Form JSON Fields</h4>
                    <div id="modalFormFields" class="space-y-2 max-h-60 overflow-y-auto font-sans pr-2">
                        <!-- Filled in with JavaScript dynamically loops keys -->
                    </div>
                </div>

            </div>

            <!-- Footer Action Bar -->
            <div class="bg-gray-50 border-t border-gray-100 p-4 flex gap-2 justify-end">
                <button onclick="closeLeadModal()" class="bg-[#082b36] text-white hover:bg-[#096260] text-xs font-semibold py-2 px-4 rounded-xl transition">
                    Dismiss Lead Modal
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL JAVASCRIPT LOGIC CONTROLLER -->
    <script>
        function openLeadModal(lead) {
            // Set basic details
            document.getElementById('modalClientTitle').textContent = lead.client_name + " Form Submission";
            document.getElementById('modalTimestamp').textContent = "Server Catch Time: " + lead.created_at;
            
            // Set status badges
            const badge = document.getElementById('modalVerdictBadge');
            badge.textContent = lead.status;
            if (lead.status === 'GENUINE') {
                badge.className = "text-xs font-bold px-3 py-1 rounded-full uppercase bg-[#d5ecea] text-[#096260]";
                document.getElementById('modalSpamCard').classList.add('hidden');
            } else {
                badge.className = "text-xs font-bold px-3 py-1 rounded-full uppercase bg-red-100 text-red-700";
                document.getElementById('modalSpamCard').classList.remove('hidden');
                document.getElementById('modalSpamReason').textContent = lead.ai_reason ? lead.ai_reason : "Unspecified bulk pattern match.";
            }

            // Loop and render form payload
            const fieldBox = document.getElementById('modalFormFields');
            fieldBox.innerHTML = ''; // Clear previous fields
            
            for (const [key, value] of Object.entries(lead.form_data)) {
                // Outer field container
                const row = document.createElement('div');
                row.className = "bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex flex-col md:flex-row md:items-start justify-between gap-1.5";
                
                // key heading
                const keyLabel = document.createElement('span');
                keyLabel.className = "text-xs font-semibold text-gray-500 font-mono py-0.5 capitalize";
                keyLabel.textContent = key.replace(/_/g, ' ');
                
                // value field
                const valLabel = document.createElement('span');
                valLabel.className = "text-xs text-[#082b36] font-medium break-all text-left bg-white px-2 py-1 rounded border border-gray-100 shadow-sm flex-1 md:max-w-[70%]";
                if (typeof value === 'object' && value !== null) {
                    valLabel.textContent = JSON.stringify(value);
                } else {
                    valLabel.textContent = value;
                }
                
                row.appendChild(keyLabel);
                row.appendChild(valLabel);
                fieldBox.appendChild(row);
            }

            // Reveal modal
            document.getElementById('formPayloadModal').classList.remove('hidden');
        }

        function closeLeadModal() {
            document.getElementById('formPayloadModal').classList.add('hidden');
        }

        function openEditClientModal(client) {
            document.getElementById('edit_client_id').value = client.client_id;
            document.getElementById('edit_business_name').value = client.business_name;
            document.getElementById('edit_contact_email').value = client.contact_email;
            document.getElementById('edit_status').value = client.status;
            document.getElementById('edit_has_seo').checked = (client.has_seo == 1 || client.has_seo === true);
            document.getElementById('edit_has_google_ads').checked = (client.has_google_ads == 1 || client.has_google_ads === true);
            document.getElementById('edit_has_fb_ads').checked = (client.has_fb_ads == 1 || client.has_fb_ads === true);
            document.getElementById('edit_has_gmb').checked = (client.has_gmb == 1 || client.has_gmb === true);
            document.getElementById('editClientModal').classList.remove('hidden');
        }

        function closeEditClientModal() {
            document.getElementById('editClientModal').classList.add('hidden');
        }
    </script>

    <!-- EDIT CLIENT PORTAL WORKSPACE & SERVICES SUBSCRIPTIONS MODAL -->
    <div id="editClientModal" class="fixed inset-0 bg-[#082b36]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
        <div class="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-[#5fb4a9]/30 flex flex-col max-h-[90vh]">
            <!-- Header bar -->
            <div class="bg-[#082b36] p-5 text-white flex justify-between items-center border-b-2 border-[#096260]">
                <div>
                    <h3 class="text-base font-bold">Edit Client Workspace Subscriptions</h3>
                    <p class="text-[10px] font-mono text-[#5fb4a9] mt-0.5 uppercase">Configuration Gating</p>
                </div>
                <button onclick="closeEditClientModal()" class="text-[#5fb4a9] hover:text-white text-lg font-bold">✖</button>
            </div>

            <!-- Form Area (Scrollable) -->
            <form action="index.php" method="POST" class="p-6 overflow-y-auto space-y-4">
                <input type="hidden" name="action" value="edit_client">
                <input type="hidden" name="is_full_edit" value="1">
                <input type="hidden" id="edit_client_id" name="client_id">

                <div>
                    <label class="block text-xs font-semibold text-[#082b36] uppercase tracking-wider mb-1.5">Business Name</label>
                    <input type="text" id="edit_business_name" name="business_name" required class="w-full bg-[#d5ecea]/20 border border-gray-200 focus:border-[#096260] rounded-xl py-2 px-3 text-sm outline-none font-semibold">
                </div>
                
                <div>
                    <label class="block text-xs font-semibold text-[#082b36] uppercase tracking-wider mb-1.5">Primary Contact Email</label>
                    <input type="email" id="edit_contact_email" name="contact_email" required class="w-full bg-[#d5ecea]/20 border border-gray-200 focus:border-[#096260] rounded-xl py-2 px-3 text-sm outline-none font-semibold">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-[#082b36] uppercase tracking-wider mb-1.5">Workspace Portals Status</label>
                    <select id="edit_status" name="status" class="w-full bg-[#d5ecea]/20 border border-gray-200 focus:border-[#096260] rounded-xl py-2 px-3 text-sm outline-none font-semibold">
                        <option value="active">Active Space</option>
                        <option value="inactive">Inactive Suspended</option>
                    </select>
                </div>

                <div class="border-t border-gray-100 pt-3">
                    <p class="text-[11px] text-[#096260] font-bold uppercase tracking-widest font-mono mb-3">Subscribed Service Modules</p>
                    <div class="space-y-2.5">
                        <label class="flex items-center gap-2.5 text-xs font-semibold text-[#082b36] cursor-pointer">
                            <input type="checkbox" id="edit_has_seo" name="has_seo" value="1" class="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4">
                            <span>SEO & Website Forms</span>
                        </label>
                        <label class="flex items-center gap-2.5 text-xs font-semibold text-[#082b36] cursor-pointer">
                            <input type="checkbox" id="edit_has_google_ads" name="has_google_ads" value="1" class="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4">
                            <span>Google Ads (CPC)</span>
                        </label>
                        <label class="flex items-center gap-2.5 text-xs font-semibold text-[#082b36] cursor-pointer">
                            <input type="checkbox" id="edit_has_fb_ads" name="has_fb_ads" value="1" class="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4">
                            <span>Facebook Ads</span>
                        </label>
                        <label class="flex items-center gap-2.5 text-xs font-semibold text-[#082b36] cursor-pointer">
                            <input type="checkbox" id="edit_has_gmb" name="has_gmb" value="1" class="rounded border-gray-300 text-[#096260] focus:ring-[#096260] w-4 h-4">
                            <span>GMB Tracking Analytics</span>
                        </label>
                    </div>
                </div>

                <!-- Footer button group -->
                <div class="border-t border-gray-100 pt-4 flex gap-2.5 justify-end">
                    <button type="button" onclick="closeEditClientModal()" class="bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-bold py-2.5 px-4 rounded-xl transition">
                        Cancel Change
                    </button>
                    <button type="submit" class="bg-[#096260] hover:bg-[#5fb4a9] text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-md transition">
                        Save Tenant Config
                    </button>
                </div>
            </form>
        </div>
    </div>

</body>
</html>
