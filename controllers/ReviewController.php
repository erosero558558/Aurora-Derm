<?php

declare(strict_types=1);

class ReviewController
{
    public static function index(array $context): void
    {
        // GET /reviews
        $store = $context['store'];
        $reviews = isset($store['reviews']) && is_array($store['reviews']) ? $store['reviews'] : [];
        if (count($reviews) === 0 && function_exists('default_public_reviews_enabled') && default_public_reviews_enabled()) {
            $reviews = get_default_public_reviews();
            if (count($reviews) > 0) {
                $store['reviews'] = $reviews;
                write_store($store, false);
            }
        }

        usort($reviews, static function (array $a, array $b): int {
            return strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? ''));
        });
        json_response([
            'ok' => true,
            'data' => $reviews
        ]);
    }

    public static function store(array $context): void
    {
        // POST /reviews
        $store = $context['store'];
        require_rate_limit('reviews', 3, 60);
        $payload = require_json_body();
        // Security: ensure we generate a new ID for new reviews
        unset($payload['id']);
        $review = normalize_review($payload);
        if ($review['name'] === '' || $review['text'] === '') {
            json_response([
                'ok' => false,
                'error' => 'Nombre y reseña son obligatorios'
            ], 400);
        }
        $store['reviews'][] = $review;
        write_store($store);
        json_response([
            'ok' => true,
            'data' => $review
        ], 201);
    }
}
