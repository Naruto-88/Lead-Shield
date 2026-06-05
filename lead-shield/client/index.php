<?php
/**
 * Lead Shield - Multi-Tenant Tenant Client Dashboard
 * Path: /client/index.php
 * Strictly isolated: can only view and manage leads owned by the logged-in client_id
 */

require_once '../config.php';

// Strict Role-Based Session Check Gating
requireRole('client');

$db = getDBConnection();
$client_id = $_SESSION['client_id'];
$statusMessage = '';
$errorMessage = '';

// Retrieve client details
try {
    $clientStmt = $db->prepare("SELECT * FROM clients WHERE client_id = ?");
    $clientStmt->execute([$client_id]);
    $clientInfo = $clientStmt->fetch();
    
    if (!$clientInfo || $clientInfo['status'] !== 'active') {
        // Safe lock, destroy session
        session_unset();
        session_destroy();
        header("Location: ../index.php");
        exit;
    }
} catch (PDOException $e) {
    die("Tenant Verification Failure: " . $e->getMessage());
}

// =====================================================================
// EXPORT FEATURE: INSTANT CSV DOWNLOADS
// =====================================================================
if (isset($_GET['export']) && $_GET['export'] === 'csv') {
    $exportStatus = strtoupper(trim($_GET['status'] ?? 'GENUINE'));
    if (!in_array($exportStatus, ['GENUINE', 'SPAM'])) {
        $exportStatus = 'GENUINE';
    }

    try {
        // Fetch specific leads for export safely limited to this client_id
        $exportStmt = $db->prepare("SELECT id, form_data, status, ai_reason, created_at FROM leads WHERE client_id = ? AND status = ? ORDER BY created_at DESC");
        $exportStmt->execute([$client_id, $exportStatus]);
        $exportLeads = $exportStmt->fetchAll();

        // Configure CSV Download Headers
        $filename = "LeadShield_" . $client_id . "_" . strtolower($exportStatus) . "_" . date("Ymd_His") . ".csv";
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        // Open stdout stream buffer
        $output = fopen('php://output', 'w');

        // Standard headings (First name, Email, Phone, Message, Created, etc. flattened from JSON payload)
        // First scan keys dynamically to form CSV columns
        $columns = ['ID', 'Classification', 'Created Timestamp (UTC)', 'AI Flag Reason'];
        $formDataKeys = [];
        
        foreach ($exportLeads as $lead) {
            $formData = json_decode($lead['form_data'], true) ?? [];
            foreach (array_keys($formData) as $key) {
                if (!in_array($key, $formDataKeys)) {
                    $formDataKeys[] = $key;
                }
            }
        }
        
        // Merge base columns with dynamic JSON fields
        foreach ($formDataKeys as $key) {
            $columns[] = 'Form: ' . ucwords(str_replace('_', ' ', $key));
        }
        
        // Write the header CSV row
        fputcsv($output, $columns);

        // Write row payloads
        foreach ($exportLeads as $lead) {
            $formData = json_decode($lead['form_data'], true) ?? [];
            $row = [
                $lead['id'],
                $lead['status'],
                $lead['created_at'],
                $lead['ai_reason'] ?? 'N/A'
            ];
            // Match keys dynamically to avoid column mismatches in CSV
            foreach ($formDataKeys as $key) {
                $row[] = isset($formData[$key]) ? (is_array($formData[$key]) ? json_encode($formData[$key]) : $formData[$key]) : '';
            }
            fputcsv($output, $row);
        }

        fclose($output);
        exit;

    } catch (PDOException $e) {
        $errorMessage = "Export Transaction Failed: " . $e->getMessage();
    }
}

// =====================================================================
// ACTION CONTROLLER: INSTANT RECLASSIFICATION (SPAM OVERRIDE)
// =====================================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    
    if ($_POST['action'] === 'mark_genuine') {
        $lead_id = intval($_POST['lead_id'] ?? 0);
        
        if ($lead_id > 0) {
            try {
                // IMPORTANT SECURITY GUARD: Binds both lead_id AND logged-in client_id to prevent hijacking client bounds!
                $overrideStmt = $db->prepare("UPDATE leads SET status = 'GENUINE', ai_reason = NULL WHERE id = ? AND client_id = ?");
                $overrideStmt->execute([$lead_id, $client_id]);
                
                if ($overrideStmt->rowCount() > 0) {
                    $statusMessage = "Lead #{$lead_id} marked as GENUINE and instantly delivered to main inbox.";
                } else {
                    $errorMessage = "Leads record not found or unauthorized access.";
                }
            } catch (PDOException $e) {
                $errorMessage = "Database update exception: " . $e->getMessage();
            }
        }
    } elseif ($_POST['action'] === 'mark_spam') {
        $lead_id = intval($_POST['lead_id'] ?? 0);
        
        if ($lead_id > 0) {
            try {
                // IMPORTANT SECURITY GUARD: Binds both lead_id AND logged-in client_id to prevent hijacking client bounds!
                $overrideStmt = $db->prepare("UPDATE leads SET status = 'SPAM', ai_reason = 'Manually reclassified as SPAM by client.' WHERE id = ? AND client_id = ?");
                $overrideStmt->execute([$lead_id, $client_id]);
                
                if ($overrideStmt->rowCount() > 0) {
                    $statusMessage = "Lead #{$lead_id} has been manually flagged as SPAM and moved to the shield gate.";
                } else {
                    $errorMessage = "Leads record not found or unauthorized access.";
                }
            } catch (PDOException $e) {
                $errorMessage = "Database update exception: " . $e->getMessage();
            }
        }
    }
}

// =====================================================================
// RECOVERY AND COUNT RETRIEVAL
// =====================================================================
$countGenuine = 0;
$countSpam = 0;

try {
    $countGenuineStmt = $db->prepare("SELECT COUNT(*) FROM leads WHERE client_id = ? AND status = 'GENUINE'");
    $countGenuineStmt->execute([$client_id]);
    $countGenuine = $countGenuineStmt->fetchColumn();

    $countSpamStmt = $db->prepare("SELECT COUNT(*) FROM leads WHERE client_id = ? AND status = 'SPAM'");
    $countSpamStmt->execute([$client_id]);
    $countSpam = $countSpamStmt->fetchColumn();
} catch (PDOException $e) {
    $errorMessage = "Failure pulling statistics counts: " . $e->getMessage();
}

// Subscription service columns from MySQL
$has_seo = isset($clientInfo['has_seo']) ? (int)$clientInfo['has_seo'] : 1;
$has_google_ads = isset($clientInfo['has_google_ads']) ? (int)$clientInfo['has_google_ads'] : 0;
$has_fb_ads = isset($clientInfo['has_fb_ads']) ? (int)$clientInfo['has_fb_ads'] : 0;
$has_gmb = isset($clientInfo['has_gmb']) ? (int)$clientInfo['has_gmb'] : 0;

$enabledTabs = [];
if ($has_seo) $enabledTabs['seo'] = 'SEO & Website Forms';
if ($has_google_ads) $enabledTabs['google_ads'] = 'Google Ads';
if ($has_fb_ads) $enabledTabs['fb_ads'] = 'Facebook Ads';
if ($has_gmb) $enabledTabs['gmb_analytics'] = 'GMB Analytics';

$activeServiceTab = $_GET['service_tab'] ?? '';
if (empty($activeServiceTab) || !array_key_exists($activeServiceTab, $enabledTabs)) {
    $activeServiceTab = !empty($enabledTabs) ? array_key_first($enabledTabs) : 'seo';
}

// Fetch leads based on active tabs
$activeTab = $_GET['tab'] ?? 'genuine'; // Options: genuine, spam
$statusFilter = ($activeTab === 'spam') ? 'SPAM' : 'GENUINE';

$leads = [];
try {
    $leadsStmt = $db->prepare("SELECT * FROM leads WHERE client_id = ? AND status = ? ORDER BY created_at DESC LIMIT 150");
    $leadsStmt->execute([$client_id, $statusFilter]);
    $leads = $leadsStmt->fetchAll();
} catch (PDOException $e) {
    $errorMessage = "Error querying client leads grid: " . $e->getMessage();
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lead Shield - Client Portal Workspace</title>
    <!-- Tailwind CSS -->
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
<body class="bg-[#d5ecea]/40 min-h-screen text-gray-800 flex flex-col font-sans">

    <!-- PRIMARY HEADER BRANDING LINE -->
    <header class="bg-[#082b36] text-white py-4 px-6 shadow-md flex justify-between items-center border-b-2 border-[#096260]">
        <div class="flex items-center gap-3">
            <span class="text-2xl">🛡️</span>
            <div>
                <h1 class="text-base md:text-lg font-bold tracking-tight"><?php echo h($clientInfo['business_name']); ?></h1>
                <p class="text-[9px] text-[#5fb4a9] tracking-wider uppercase font-mono">CLIENT INSTANCE ACCESS • ID: <?php echo h($client_id); ?></p>
            </div>
        </div>
        
        <div class="flex items-center gap-4">
            <div class="text-right hidden md:block">
                <p class="text-xs text-gray-300 font-medium select-none">Logged inside: <span class="text-white font-bold"><?php echo h($_SESSION['username']); ?></span></p>
                <p class="text-[9px] text-[#5fb4a9] tracking-widest font-mono">STATUS: ACTIVE TENANT</p>
            </div>
            <a href="../logout.php" class="bg-[#096260] hover:bg-[#5fb4a9] text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-colors duration-150 flex items-center gap-1">
                <span>Portal Exit</span> 🚪
            </a>
        </div>
    </header>

    <!-- CONTENT ELEMENT CONTAINER -->
    <main class="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">

        <!-- STATUS ALERTS -->
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

        <!-- PRIMARY SERVICE NAVIGATION MENU -->
        <div class="border-b border-gray-200 mb-6">
            <nav class="flex -mb-px space-x-6 overflow-x-auto pb-1">
                <?php foreach ($enabledTabs as $key => $title): ?>
                    <?php 
                        $isActive = ($activeServiceTab === $key);
                        $href = "?service_tab=" . urlencode($key);
                        if ($key === 'seo' && isset($_GET['tab'])) {
                            $href .= "&tab=" . urlencode($_GET['tab']);
                        }
                    ?>
                    <a href="<?php echo $href; ?>" class="whitespace-nowrap pb-4 px-1 border-b-2 font-bold text-sm transition-all flex items-center gap-2 <?php echo $isActive ? 'border-[#096260] text-[#096260] scale-105' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'; ?>">
                        <?php if ($key === 'seo'): ?>
                            🌐 <?php echo h($title); ?>
                        <?php elseif ($key === 'google_ads'): ?>
                            📈 <?php echo h($title); ?>
                        <?php elseif ($key === 'fb_ads'): ?>
                            📱 <?php echo h($title); ?>
                        <?php elseif ($key === 'gmb_analytics'): ?>
                            📍 <?php echo h($title); ?>
                        <?php endif; ?>
                    </a>
                <?php endforeach; ?>
            </nav>
        </div>

        <?php if ($activeServiceTab === 'seo'): ?>
            <!-- METRICS TILES (SEO) -->
            <div class="grid grid-cols-2 gap-4 mb-6">
                <!-- Genuine Leads Metric -->
                <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div class="w-12 h-12 bg-[#d5ecea] text-[#096260] rounded-xl flex items-center justify-center text-xl font-bold">
                        📥
                    </div>
                    <div>
                        <h3 class="text-gray-400 text-xs font-semibold uppercase tracking-wider">Genuine Inquiries</h3>
                        <p class="text-2xl md:text-3xl font-bold text-[#082b36]"><?php echo h($countGenuine); ?></p>
                    </div>
                </div>

                <!-- Spam Blocked Metric -->
                <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div class="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center text-xl font-bold">
                        🛡️
                    </div>
                    <div>
                        <h3 class="text-gray-400 text-xs font-semibold uppercase tracking-wider">Spam Gated Shield</h3>
                        <p class="text-2xl md:text-3xl font-bold text-red-600"><?php echo h($countSpam); ?></p>
                    </div>
                </div>
            </div>

            <!-- CORE CONTENT CARD LIST (SEO & FORMS) -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                
                <!-- Tab & Exporter Controls Header Panel -->
                <div class="border-b border-gray-100 p-4 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    <!-- Tab Controls -->
                    <div class="flex gap-1.5 p-1 bg-gray-100 rounded-xl self-start">
                        <a 
                            href="?service_tab=seo&tab=genuine" 
                            class="px-4 py-2 rounded-lg text-xs font-semibold transition-all <?php echo $activeTab === 'genuine' ? 'bg-white text-[#096260] shadow-sm' : 'text-gray-500 hover:text-[#082b36]'; ?>"
                        >
                            📬 Genuine Leads (<?php echo h($countGenuine); ?>)
                        </a>
                        <a 
                            href="?service_tab=seo&tab=spam" 
                            class="px-4 py-2 rounded-lg text-xs font-semibold transition-all <?php echo $activeTab === 'spam' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-red-600'; ?>"
                        >
                            🛡️ Spam Logs (<?php echo h($countSpam); ?>)
                        </a>
                    </div>

                    <!-- Export Button -->
                    <a 
                        href="?export=csv&status=<?php echo urlencode($statusFilter); ?>" 
                        class="bg-[#096260] hover:bg-[#5fb4a9] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition flex items-center gap-1.5 self-start sm:self-center"
                    >
                        📥 Export Filtered Current Grid (CSV)
                    </a>
                </div>

                <!-- Leads Output Area Grid -->
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr class="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase bg-gray-50/20">
                                <th class="p-4 w-32">Timestamp (UTC)</th>
                                <th class="p-4">Submission details</th>
                                <?php if ($activeTab === 'spam'): ?>
                                    <th class="p-4">AI Spam Classification Reason</th>
                                <?php endif; ?>
                                <th class="p-4 text-right">Interactive Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <?php if (empty($leads)): ?>
                                <tr>
                                    <td colspan="<?php echo $activeTab === 'spam' ? 4 : 3; ?>" class="py-12 text-center text-gray-400 text-xs">
                                        No records present in the <?php echo h(strtoupper($activeTab)); ?> folder workspace.
                                    </td>
                                </tr>
                            <?php else: ?>
                                <?php foreach ($leads as $lead): ?>
                                    <?php 
                                        $formData = json_decode($lead['form_data'], true) ?? [];
                                    ?>
                                    <tr class="hover:bg-gray-50/30 transition">
                                        <td class="p-4 text-xs font-mono text-gray-400">
                                            <?php echo h($lead['created_at']); ?>
                                        </td>
                                        <td class="p-4 text-xs">
                                            <div class="space-y-1">
                                                <?php foreach ($formData as $k => $v): ?>
                                                    <?php if (is_array($v)) $v = json_encode($v); ?>
                                                    <p>
                                                        <span class="text-gray-400 font-mono text-[10px] uppercase"><?php echo h($k); ?>:</span> 
                                                        <strong class="text-[#082b36]"><?php echo h($v); ?></strong>
                                                    </p>
                                                <?php endforeach; ?>
                                            </div>
                                        </td>
                                        <?php if ($activeTab === 'spam'): ?>
                                            <td class="p-4 text-xs max-w-sm">
                                                <div class="bg-red-50 text-red-700/90 py-2 px-3 rounded-xl border border-red-100">
                                                    <p class="font-bold text-[10px] uppercase text-red-800 tracking-wide mb-0.5">Spam Flag Trigger</p>
                                                    <p class="italic text-xs"><?php echo h($lead['ai_reason'] ?? 'Bulk signature match.'); ?></p>
                                                </div>
                                            </td>
                                        <?php endif; ?>
                                        <td class="p-4 text-right">
                                            <div class="inline-flex gap-2">
                                                <?php if ($activeTab === 'spam'): ?>
                                                    <!-- Spam Action Override Override Button -->
                                                    <form action="index.php?service_tab=seo&tab=spam" method="POST" onsubmit="return confirm('Do you want to manually mark this inquiry as GENUINE and restore it inside your active inbox workspace?');">
                                                        <input type="hidden" name="action" value="mark_genuine">
                                                        <input type="hidden" name="lead_id" value="<?php echo h($lead['id']); ?>">
                                                        <button type="submit" class="bg-[#d5ecea] hover:bg-[#5fb4a9] text-[#096260] hover:text-[#082b36] font-bold text-xs py-2 px-3.5 rounded-lg transition-colors cursor-pointer animate-pulse">
                                                            Mark as Genuine Check ✅
                                                        </button>
                                                    </form>
                                                <?php else: ?>
                                                    <span class="text-xs bg-[#d5ecea] text-[#096260] font-bold px-2.5 py-1.5 rounded-full uppercase select-none mr-2">Inbox Live</span>
                                                    <form action="index.php?service_tab=seo&tab=genuine" method="POST" onsubmit="return confirm('Are you sure you want to flag this genuine inquiry as SPAM? It will be moved to the Spam Gating Shield list.');">
                                                        <input type="hidden" name="action" value="mark_spam">
                                                        <input type="hidden" name="lead_id" value="<?php echo h($lead['id']); ?>">
                                                        <button type="submit" class="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white font-extrabold text-[11px] py-1.5 px-3 rounded-lg border border-red-500/15 transition duration-150 cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                                                            ⚠️ Mark as Spam
                                                        </button>
                                                    </form>
                                                <?php endif; ?>
                                            </div>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>

            </div>
        <?php elseif ($activeServiceTab === 'google_ads'): ?>
            <!-- GOOGLE ADS OUTLET MODULE -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden min-h-[400px]">
                <!-- Coming soon elegant blur overlay -->
                <div class="absolute inset-0 bg-white/75 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
                    <div class="bg-[#082b36] text-white py-2 px-5 rounded-full font-bold text-xs shadow-md tracking-wider mb-3">
                        🚀 ADVANCED API INTEGRATION COMING SOON
                    </div>
                    <h3 class="text-lg font-bold text-[#082b36] mb-1">Direct Google Ads Data Syncing</h3>
                    <p class="text-xs text-gray-500 max-w-md">Our developer squad is wrapping up the secure token integration with the Google AdWords API so you can track precise customer acquisition directly here.</p>
                </div>

                <!-- Blur background visuals -->
                <div class="space-y-6">
                    <div class="flex items-center justify-between border-b pb-4">
                        <div>
                            <h3 class="text-base font-bold text-[#082b36]">Google Ads Campaign Metrics</h3>
                            <p class="text-xs text-gray-400">Mock Data Loop from Sandbox Connection</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Monthly Spend</p>
                            <p class="text-lg font-extrabold text-[#082b36]">$1,240.50</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Conversion Leads</p>
                            <p class="text-lg font-extrabold text-[#082b36]">42 Leads</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cost Per Lead (CPL)</p>
                            <p class="text-lg font-extrabold text-[#082b36]">$29.53</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Click-Through Rate</p>
                            <p class="text-lg font-extrabold text-[#082b36]">3.82%</p>
                        </div>
                    </div>

                    <!-- Fake Chart mockup visuals -->
                    <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 h-48 flex items-end gap-3 justify-between">
                        <div class="bg-[#096260]/10 w-full h-[30%] rounded-md"></div>
                        <div class="bg-[#096260]/20 w-full h-[50%] rounded-md"></div>
                        <div class="bg-[#096260]/40 w-full h-[70%] rounded-md"></div>
                        <div class="bg-[#096260]/30 w-full h-[60%] rounded-md"></div>
                        <div class="bg-[#096260]/50 w-full h-[85%] rounded-md"></div>
                        <div class="bg-[#096260] w-full h-[95%] rounded-md"></div>
                    </div>
                </div>
            </div>
        <?php elseif ($activeServiceTab === 'fb_ads'): ?>
            <!-- FACEBOOK ADS OUTLET MODULE -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden min-h-[400px]">
                <!-- Coming soon elegant blur overlay -->
                <div class="absolute inset-0 bg-white/75 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
                    <div class="bg-[#082b36] text-white py-2 px-5 rounded-full font-bold text-xs shadow-md tracking-wider mb-3">
                        🚀 METASHIELD SDK COMING SOON
                    </div>
                    <h3 class="text-lg font-bold text-[#082b36] mb-1">Pre-Certified Meta Platform Connect</h3>
                    <p class="text-xs text-gray-500 max-w-md">Instantly pull direct campaign lead ads from your Facebook Pages and Instagram accounts through Lead Shield webhook streams.</p>
                </div>

                <!-- Blur background visuals -->
                <div class="space-y-6">
                    <div class="flex items-center justify-between border-b pb-4">
                        <div>
                            <h3 class="text-base font-bold text-[#082b36]">Meta Business Account Metrics</h3>
                            <p class="text-xs text-gray-400">Aggregated Campaigns Sandbox Feed</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Page Impressions</p>
                            <p class="text-lg font-extrabold text-[#082b36]">248,500</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Ad Link Clicks</p>
                            <p class="text-lg font-extrabold text-[#082b36]">6,120</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Ad Spend</p>
                            <p class="text-lg font-extrabold text-[#082b36]">$850.00</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Instant Leads Captured</p>
                            <p class="text-lg font-extrabold text-[#082b36]">31 Submissions</p>
                        </div>
                    </div>

                    <!-- Fake Chart mockup visuals -->
                    <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 h-48 flex items-end gap-3 justify-between">
                        <div class="bg-blue-600/10 w-full h-[40%] rounded-md"></div>
                        <div class="bg-blue-600/25 w-full h-[30%] rounded-md"></div>
                        <div class="bg-blue-600/40 w-full h-[65%] rounded-md"></div>
                        <div class="bg-blue-600/35 w-full h-[55%] rounded-md"></div>
                        <div class="bg-blue-600/60 w-full h-[80%] rounded-md"></div>
                        <div class="bg-blue-600 w-full h-[95%] rounded-md"></div>
                    </div>
                </div>
            </div>
        <?php elseif ($activeServiceTab === 'gmb_analytics'): ?>
            <!-- GMB OUTLET MODULE -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden min-h-[400px]">
                <!-- Coming soon elegant blur overlay -->
                <div class="absolute inset-0 bg-white/75 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
                    <div class="bg-[#082b36] text-white py-2 px-5 rounded-full font-bold text-xs shadow-md tracking-wider mb-3">
                        🚀 GMB CALL ROUTING ENGINE COMING SOON
                    </div>
                    <h3 class="text-lg font-bold text-[#082b36] mb-1">Google My Business Map Call Analytics Log</h3>
                    <p class="text-xs text-gray-500 max-w-md">Our cloud tracking number mapping detects calls, directions requests, and message actions starting from Google Maps business profiles.</p>
                </div>

                <!-- Blur background visuals -->
                <div class="space-y-6">
                    <div class="flex items-center justify-between border-b pb-4">
                        <div>
                            <h3 class="text-base font-bold text-[#082b36]">Google My Business & Call Tracking</h3>
                            <p class="text-xs text-gray-400">Sandbox Analytics Profile</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Map Listing Views</p>
                            <p class="text-lg font-extrabold text-[#082b36]">4,890 Views</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Call Logs Tracked</p>
                            <p class="text-lg font-extrabold text-[#082b36]">18 Calls</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Direction Requests</p>
                            <p class="text-lg font-extrabold text-[#082b36]">120 Click Requests</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">GMB Website Visits</p>
                            <p class="text-lg font-extrabold text-[#082b36]">340 Visits</p>
                        </div>
                    </div>

                    <!-- Call list mockup style details -->
                    <div class="space-y-2.5">
                        <p class="text-xs font-semibold text-gray-400 uppercase font-mono tracking-wider">Recent Map Call Records</p>
                        <div class="bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex items-center justify-between text-xs font-semibold">
                            <span class="font-mono text-gray-400">Today, 10:42 AM</span>
                            <strong class="text-[#082b36] font-mono">+61 412 888 999</strong>
                            <span class="bg-teal-50 text-teal-700 font-bold font-mono px-2 py-0.5 rounded border border-teal-200/20">MAP CALL</span>
                        </div>
                        <div class="bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex items-center justify-between text-xs font-semibold">
                            <span class="font-mono text-gray-400">Yesterday, 4:15 PM</span>
                            <strong class="text-[#082b36] font-mono">+61 411 222 333</strong>
                            <span class="bg-teal-50 text-teal-700 font-bold font-mono px-2 py-0.5 rounded border border-teal-200/20">MAP CALL</span>
                        </div>
                    </div>
                </div>
            </div>
        <?php endif; ?>

    </main>

    <!-- FOOTER LICENSE TAG -->
    <footer class="bg-gray-100 border-t border-gray-200 py-4 text-center mt-8">
        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-mono">
            🛡️ SHIELD CLASSIFIER SECURE TUNNEL • cPANEL ENGINE
        </p>
    </footer>

</body>
</html>
