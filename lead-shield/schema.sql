-- =====================================================================
-- Lead Shield - Database Schema (MySQL)
-- Hosting: Standard cPanel Environment
-- Optimized with Indexes for Multi-Tenant Lead Management
-- =====================================================================

-- Create Database (Uncomment if needed)
-- CREATE DATABASE IF NOT EXISTS lead_shield_db;
-- USE lead_shield_db;

-- 1. CLIENTS TABLE
-- String primary key client_id (e.g., 'sydney_decking') as per specification
CREATE TABLE IF NOT EXISTS `clients` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. USERS TABLE
-- Stores security logins for Admin and Clients
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `email` VARCHAR(100) DEFAULT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'client') NOT NULL,
    `client_id` VARCHAR(50) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_users_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. LEADS TABLE
-- Stores lead form data as a JSON object, status, and AI classification reasons
CREATE TABLE IF NOT EXISTS `leads` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `client_id` VARCHAR(50) NOT NULL,
    `form_data` JSON NOT NULL,
    `status` ENUM('GENUINE', 'SPAM') NOT NULL,
    `ai_reason` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_leads_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- INDEXES FOR QUERIES OVER LEAD VOLUMES
CREATE INDEX `idx_leads_client_status` ON `leads` (`client_id`, `status`);
CREATE INDEX `idx_leads_created_at` ON `leads` (`created_at`);
CREATE INDEX `idx_users_role` ON `users` (`role`);
CREATE INDEX `idx_users_client_id` ON `users` (`client_id`);
