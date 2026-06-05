<?php
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
 * Uses Singleton pattern to prevent multiple database connections
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
            // In a real environment, you might log this instead of outputting direct text
            die("Database Connection Failed: " . $e->getMessage());
        }
    }
    return $db;
}

/**
 * Authentication Gate: Hard Security Wall
 * Ensures that if a user is not authenticated, they are immediately
 * redirected back to the login page (index.php).
 */
function requireLogin() {
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['username']) || !isset($_SESSION['role'])) {
        // Destroy potential partial session
        session_unset();
        session_destroy();
        
        // Find path back to root index.php from any folder level
        $pathPrefix = '';
        if (strpos($_SERVER['REQUEST_URI'], '/admin/') !== false || strpos($_SERVER['REQUEST_URI'], '/client/') !== false) {
            $pathPrefix = '../';
        }
        header("Location: " . $pathPrefix . "index.php");
        exit;
    }
}

/**
 * Role-Based Access Control Gate
 * Ensures user has the appropriate authorized role
 */
function requireRole($role) {
    requireLogin();
    if ($_SESSION['role'] !== $role) {
        // Forbidden access, redirect to secure panel matching their actual role
        if ($_SESSION['role'] === 'admin') {
            header("Location: ../admin/index.php");
        } else {
            header("Location: ../client/index.php");
        }
        exit;
    }
}

/**
 * Clean UI Output Helper to prevent XSS (Cross Site Scripting)
 */
function h($string) {
    return htmlspecialchars($string ?? '', ENT_QUOTES, 'UTF-8');
}
?>
