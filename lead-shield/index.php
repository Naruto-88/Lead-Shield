<?php
/**
 * Lead Shield - Security Login Wall
 * Uses strict PHP Session authentication. Protects against SQL Injection.
 */

require_once 'config.php';

// If already logged in, route immediately to avoid redundant login screens
if (isset($_SESSION['user_id']) && isset($_SESSION['role'])) {
    if ($_SESSION['role'] === 'admin') {
        header("Location: admin/index.php");
        exit;
    } else if ($_SESSION['role'] === 'client') {
        header("Location: client/index.php");
        exit;
    }
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if (!empty($username) && !empty($password)) {
        try {
            $db = getDBConnection();
            
            // Prepare statement to avoid SQL injection
            $stmt = $db->prepare("SELECT id, username, password, role, client_id FROM users WHERE username = ?");
            $stmt->execute([$username]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password'])) {
                // If it's a client user, verify if their tenant client account is actually ACTIVE
                if ($user['role'] === 'client') {
                    $clientStmt = $db->prepare("SELECT status FROM clients WHERE client_id = ?");
                    $clientStmt->execute([$user['client_id']]);
                    $clientData = $clientStmt->fetch();
                    
                    if (!$clientData || $clientData['status'] !== 'active') {
                        $error = 'Access Denied: This client workspace has been deactivated.';
                    }
                }

                if (empty($error)) {
                    // Inject Session Variables
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    $_SESSION['role'] = $user['role'];
                    $_SESSION['client_id'] = $user['client_id'];
                    
                    // Role-Based Router redirects
                    if ($user['role'] === 'admin') {
                        header("Location: admin/index.php");
                        exit;
                    } else {
                        header("Location: client/index.php");
                        exit;
                    }
                }
            } else {
                $error = 'Invalid username or password.';
            }
        } catch (PDOException $e) {
            $error = 'Authentication service failure: ' . $e->getMessage();
        }
    } else {
        $error = 'Please fill out all required fields.';
    }
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lead Shield - Secure Authentication Wall</title>
    <!-- Tailwind CSS with custom branding config injection -->
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
<body class="bg-[#d5ecea] min-h-screen font-sans flex items-center justify-center p-4">

    <div class="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#5fb4a9]/20 overflow-hidden">
        
        <!-- Header Branding Header Bar -->
        <div class="bg-[#082b36] p-8 text-center relative border-b-4 border-[#096260]">
            <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-[#096260] text-white rounded-xl shadow-lg flex items-center justify-center font-bold text-lg border-2 border-white">
                🛡️
            </div>
            <h1 class="text-white text-2xl font-bold tracking-tight">LEAD SHIELD</h1>
            <p class="text-[#5fb4a9] text-xs uppercase tracking-widest font-semibold mt-1">Multi-Tenant AI Shield & Inbox</p>
        </div>

        <!-- Form Panel -->
        <div class="p-8 pt-10">
            
            <?php if (!empty($error)): ?>
                <div class="bg-red-50 border-l-4 border-red-500 text-red-900 p-4 rounded-lg mb-6 text-sm flex gap-2 items-start">
                    <span class="text-red-500 font-bold">⚠️</span>
                    <div>
                        <p class="font-bold">Access Denied</p>
                        <p class="text-xs text-red-700/95 mt-0.5"><?php echo h($error); ?></p>
                    </div>
                </div>
            <?php endif; ?>

            <form action="index.php" method="POST" class="space-y-5">
                <!-- Username -->
                <div>
                    <label for="username" class="block text-xs font-semibold text-[#082b36] uppercase tracking-wider mb-2">Username / Email</label>
                    <div class="relative">
                        <span class="absolute left-3 top-3.5 text-gray-400 text-sm">👤</span>
                        <input 
                            type="text" 
                            name="username" 
                            id="username" 
                            placeholder="nEnter your username" 
                            required 
                            class="w-full bg-[#d5ecea]/30 text-[#082b36] placeholder-gray-400 text-sm border border-gray-200 focus:border-[#096260] focus:ring-1 focus:ring-[#096260] rounded-xl py-3 pl-10 pr-4 outline-none transition duration-150"
                        >
                    </div>
                </div>

                <!-- Password -->
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label for="password" class="block text-xs font-semibold text-[#082b36] uppercase tracking-wider">Password</label>
                    </div>
                    <div class="relative">
                        <span class="absolute left-3 top-3.5 text-gray-400 text-sm">🔐</span>
                        <input 
                            type="password" 
                            name="password" 
                            id="password" 
                            placeholder="••••••••••••" 
                            required 
                            class="w-full bg-[#d5ecea]/30 text-[#082b36] placeholder-gray-400 text-sm border border-gray-200 focus:border-[#096260] focus:ring-1 focus:ring-[#096260] rounded-xl py-3 pl-10 pr-4 outline-none transition duration-150"
                        >
                    </div>
                </div>

                <!-- Remember / Consent Check -> Just layout aesthetics -->
                <div class="flex items-center justify-between text-xs text-gray-500 pt-1">
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" name="remember" class="accent-[#096260] rounded">
                        <span>Remember session on this device</span>
                    </label>
                </div>

                <!-- Login Trigger -->
                <button 
                    type="submit" 
                    class="w-full bg-[#096260] hover:bg-[#5fb4a9] text-white py-3 px-4 rounded-xl font-semibold text-sm shadow-md transition-colors duration-150 focus:outline-none mt-2"
                >
                    Secure System Verification
                </button>
            </form>
        </div>

        <!-- Footer Security Seal -->
        <div class="bg-gray-50 border-t border-gray-100 p-4 text-center">
            <p class="text-[10px] text-gray-400 uppercase tracking-widest font-mono flex items-center justify-center gap-1">
                <span>🔒 SECURE PHP COMPLIANT LAYER</span>
                <span>•</span>
                <span>cPANEL BUILD v1.0</span>
            </p>
        </div>
    </div>

</body>
</html>
