<?php

declare(strict_types=1);

/**
 * Security headers helper.
 */

function apply_security_headers(bool $isHtml = false): void
{
    if (headers_sent()) {
        return;
    }

    // Common security headers
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('X-Permitted-Cross-Domain-Policies: none');
    header('Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=(), usb=()');
    header('Cross-Origin-Resource-Policy: same-origin');

    // HSTS (HTTP Strict Transport Security)
    $isHttps = false;
    if (isset($_SERVER['HTTPS']) && (strtolower($_SERVER['HTTPS']) === 'on' || $_SERVER['HTTPS'] === '1')) {
        $isHttps = true;
    } elseif (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443') {
        $isHttps = true;
    } elseif (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') {
        $isHttps = true;
    }

    if ($isHttps) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }

    if ($isHtml) {
        // CSP for HTML pages (e.g., index.php)
        // Replicating index.php's logic but centralized to ensure consistency
        $csp = "default-src 'self'; ";
        $csp .= "base-uri 'self'; ";
        $csp .= "object-src 'none'; ";
        $csp .= "frame-ancestors 'self'; ";
        $csp .= "script-src 'self' 'unsafe-inline' https://js.stripe.com https://cdnjs.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://browser.sentry-cdn.com https://static.cloudflareinsights.com; ";
        $csp .= "style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com 'unsafe-inline'; ";
        $csp .= "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; ";
        $csp .= "img-src 'self' https://images.unsplash.com https://www.google-analytics.com https://*.stripe.com https://www.googletagmanager.com data:; ";
        $csp .= "frame-src https://js.stripe.com https://hooks.stripe.com https://www.google.com; ";
        $csp .= "connect-src 'self' https://api.stripe.com https://m.stripe.network https://r.stripe.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://cloudflareinsights.com https://browser.sentry-cdn.com https://*.ingest.sentry.io https://sentry.io; ";
        $csp .= "worker-src 'self' blob:; ";
        $csp .= "form-action 'self'";

        header("Content-Security-Policy: $csp");
    } else {
        // CSP for API endpoints (JSON) - strict lockdown
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox");
        // APIs should not be cached by browsers/proxies by default.
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
    }
}
