<?php
/**
 * Lead Shield - Auto Setup / Database Installer
 * Creates the required schema, inserts the Super Admin account, and verifies configuration.
 */

require_once 'config.php';

$success = false;
$message = '';

try {
    $db = getDBConnection();
    
    // 1. Create client table
    $db->exec("CREATE TABLE IF NOT EXISTS `clients` (
        `id` INT AUTO_INCREMENT UNIQUE,
        `client_id` VARCHAR(50) NOT NULL,
        `business_name` VARCHAR(100) NOT NULL,
        `contact_email` VARCHAR(100) NOT NULL,
        `status` ENUM('active', 'inactive') DEFAULT 'active',
        `has_seo` TINYINT(1) DEFAULT 1,
        `has_google_ads` TINYINT(1) DEFAULT 0,
        `has_fb_ads` TINYINT(1) DEFAULT 0,
        `has_gmb` TINYINT(1) DEFAULT 0,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`client_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    // 2. Create users table
    $db->exec("CREATE TABLE IF NOT EXISTS `users` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `username` VARCHAR(50) NOT NULL UNIQUE,
        `email` VARCHAR(100) DEFAULT NULL,
        `password` VARCHAR(255) NOT NULL,
        `role` ENUM('admin', 'client') NOT NULL,
        `client_id` VARCHAR(50) DEFAULT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT `fk_users_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    // 3. Create leads table
    $db->exec("CREATE TABLE IF NOT EXISTS `leads` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `client_id` VARCHAR(50) NOT NULL,
        `form_data` JSON NOT NULL,
        `status` ENUM('GENUINE', 'SPAM') NOT NULL,
        `ai_reason` TEXT DEFAULT NULL,
        `channel` VARCHAR(50) DEFAULT 'website',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT `fk_leads_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Add channel column if not already present in existing table
    try {
        $db->exec("ALTER TABLE `leads` ADD COLUMN `channel` VARCHAR(50) DEFAULT 'website';");
    } catch (PDOException $alterEx) {
        // Suppress if column already exists
    }

    // 4. Create optimal indexes
    $db->exec("ALTER TABLE `leads` ADD INDEX IF NOT EXISTS `idx_leads_client_status` (`client_id`, `status`);");
    $db->exec("ALTER TABLE `leads` ADD INDEX IF NOT EXISTS `idx_leads_created_at` (`created_at`);");
    $db->exec("ALTER TABLE `users` ADD INDEX IF NOT EXISTS `idx_users_role` (`role`);");
    $db->exec("ALTER TABLE `users` ADD INDEX IF NOT EXISTS `idx_users_client_id` (`client_id`);");

    // 5. Seed Super Admin Account as required by specification
    // Username: nstech
    // Password: Mweerasinghe@123#
    $adminUsername = 'nstech';
    $adminPasswordRaw = 'Mweerasinghe@123#';
    
    $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$adminUsername]);
    $adminExists = $stmt->fetch();
    
    if (!$adminExists) {
        $hashedPassword = password_hash($adminPasswordRaw, PASSWORD_BCRYPT);
        $insertAdmin = $db->prepare("INSERT INTO users (username, email, password, role, client_id) VALUES (?, ?, ?, ?, ?)");
        $insertAdmin->execute([
            $adminUsername,
            'admin@leadshield.com',
            $hashedPassword,
            'admin',
            null
        ]);
        $message = "Database tables initialized and Super Admin user injected successfully!";
    } else {
        $message = "Database tables initialized successfully. Super Admin user already existed.";
    }
    
    $success = true;

} catch (PDOException $e) {
    $success = false;
    $message = "Setup Error: " . $e->getMessage();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lead Shield - System Installer</title>
    <!-- Tailwind CSS via CDN as specified -->
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#d5ecea] min-h-screen text-[#082b36] flex items-center justify-center p-6 font-sans">

    <div class="bg-white p-8 rounded-xl shadow-lg border border-[#5fb4a9]/30 max-w-lg w-full text-center">
        <div class="w-16 h-16 bg-[#096260] text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl">
            LS
        </div>
        
        <h1 class="text-2xl font-bold text-[#082b36] tracking-tight mb-2">Lead Shield Setup</h1>
        <p class="text-sm text-[#096260] uppercase tracking-wider font-semibold mb-6">Database Schema & Seeding Engine</p>

        <?php if ($success): ?>
            <div class="bg-[#d5ecea]/60 border border-[#096260]/40 text-[#082b36] rounded-lg p-5 mb-6 text-left">
                <p class="font-bold text-[#096260] flex items-center gap-2 mb-2">
                    <span class="inline-block w-2h-2 rounded-full bg-[#096260]"></span>
                    Success
                </p>
                <p class="text-sm leading-relaxed"><?php echo h($message); ?></p>
            </div>
            
            <div class="bg-[#082b36] text-[#d5ecea] rounded-lg p-4 text-left font-mono text-xs mb-6 space-y-1">
                <p class="text-[#5fb4a9] border-b border-[#5fb4a9]/20 pb-1 mb-2 font-bold">DEFAULT SUPER ADMIN CREDENTIALS</p>
                <p><span class="text-gray-400">Username:</span> <span class="font-bold">nstech</span></p>
                <p><span class="text-gray-400">Password:</span> <span class="font-bold">Mweerasinghe@123#</span></p>
                <p><span class="text-gray-400">Role:</span> <span class="text-yellow-400 uppercase font-bold">admin</span></p>
            </div>

            <a href="index.php" class="inline-block bg-[#096260] text-white hover:bg-[#5fb4a9] text-center w-full py-3 rounded-lg font-semibold transition-colors duration-150">
                Go to Secure Login Page
            </a>
        <?php else: ?>
            <div class="bg-red-50 border border-red-200 text-red-800 rounded-lg p-5 mb-6 text-left">
                <p class="font-bold text-red-700 flex items-center gap-2 mb-2">
                    Configuration Error
                </p>
                <p class="text-sm leading-relaxed"><?php echo h($message); ?></p>
                <p class="text-xs text-gray-500 mt-3 pt-3 border-t border-red-200">
                    Please open <code class="bg-red-100 p-1 rounded font-mono">config.php</code> and confirm your database credentials match your cPanel MySQL settings.
                </p>
            </div>
            
            <button onclick="window.location.reload();" class="bg-red-700 hover:bg-red-800 text-white text-center w-full py-3 rounded-lg font-semibold transition-colors">
                Retry Connection
            </button>
        <?php endif; ?>
    </div>

</body>
</html>
