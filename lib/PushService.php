<?php

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

class PushService
{
    private const STORAGE_FILENAME = 'push-subscriptions.json';

    public function getPublicKey(): string
    {
        return (string) ($this->getVapidConfig()['publicKey'] ?? '');
    }

    public function isConfigured(): bool
    {
        $config = $this->getVapidConfig();
        return $config['publicKey'] !== '' && $config['privateKey'] !== '';
    }

    public function subscribe(array $subscription, string $userAgent = ''): bool
    {
        $normalized = $this->normalizeSubscription($subscription, $userAgent);
        if ($normalized === null) {
            return false;
        }

        $store = $this->readSubscriptions();
        $items = is_array($store['items'] ?? null) ? $store['items'] : [];
        $endpoint = $normalized['endpoint'];
        /** @psalm-suppress RedundantFunctionCall */
        $items = array_values(array_filter($items, static function ($item) use ($endpoint): bool {
            return (string) ($item['endpoint'] ?? '') !== $endpoint;
        }));
        $items[] = $normalized;

        $store['items'] = $items;
        $store['updatedAt'] = local_date('c');
        return $this->writeSubscriptions($store);
    }

    public function unsubscribe(string $endpoint): bool
    {
        $endpoint = trim($endpoint);
        if ($endpoint === '') {
            return false;
        }

        $store = $this->readSubscriptions();
        $items = is_array($store['items'] ?? null) ? $store['items'] : [];
        /** @psalm-suppress RedundantFunctionCall */
        $filtered = array_values(array_filter($items, static function ($item) use ($endpoint): bool {
            return (string) ($item['endpoint'] ?? '') !== $endpoint;
        }));

        if (count($filtered) === count($items)) {
            return true;
        }

        $store['items'] = $filtered;
        $store['updatedAt'] = local_date('c');
        return $this->writeSubscriptions($store);
    }

    public function subscriptionsCount(): int
    {
        $store = $this->readSubscriptions();
        return count(is_array($store['items'] ?? null) ? $store['items'] : []);
    }

    public function sendNotification(array $payload): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => 0,
                'failed' => 0,
                'errors' => ['Push VAPID no configurado']
            ];
        }

        if (!class_exists('\Minishlink\WebPush\WebPush') || !class_exists('\Minishlink\WebPush\Subscription')) {
            return [
                'success' => 0,
                'failed' => 0,
                'errors' => ['Dependencia minishlink/web-push no instalada']
            ];
        }

        $store = $this->readSubscriptions();
        $items = is_array($store['items'] ?? null) ? $store['items'] : [];
        if (count($items) === 0) {
            return [
                'success' => 0,
                'failed' => 0,
                'errors' => ['No hay suscripciones activas']
            ];
        }

        $auth = $this->getVapidConfig();
        $success = 0;
        $failed = 0;
        $errors = [];

        try {
            $webPush = new \Minishlink\WebPush\WebPush(['VAPID' => $auth]);

            $encodedPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (!is_string($encodedPayload) || $encodedPayload === '') {
                $encodedPayload = '{"title":"Piel en Armonia","body":"Nueva notificacion"}';
            }

            foreach ($items as $item) {
                $endpoint = (string) ($item['endpoint'] ?? '');
                $p256dh = (string) ($item['p256dh'] ?? '');
                $authKey = (string) ($item['auth'] ?? '');
                if ($endpoint === '' || $p256dh === '' || $authKey === '') {
                    continue;
                }

                $subscription = \Minishlink\WebPush\Subscription::create([
                    'endpoint' => $endpoint,
                    'keys' => [
                        'p256dh' => $p256dh,
                        'auth' => $authKey
                    ]
                ]);
                $webPush->queueNotification($subscription, $encodedPayload);
            }

            foreach ($webPush->flush() as $report) {
                $endpoint = (string) $report->getRequest()->getUri();
                if ($report->isSuccess()) {
                    $success++;
                    continue;
                }

                $failed++;
                $reason = trim((string) $report->getReason());
                $errors[] = ($reason !== '' ? $reason : 'Error enviando push') . ' [' . $endpoint . ']';

                if ($report->isSubscriptionExpired()) {
                    $this->unsubscribe($endpoint);
                }
            }
        } catch (Throwable $e) {
            $failed = count($items);
            $errors[] = $e->getMessage();
        }

        return [
            'success' => $success,
            'failed' => $failed,
            'errors' => $errors
        ];
    }

    private function getVapidConfig(): array
    {
        $publicKey = trim((string) (getenv('PIELARMONIA_VAPID_PUBLIC_KEY') ?: getenv('VAPID_PUBLIC_KEY') ?: ''));
        $privateKey = trim((string) (getenv('PIELARMONIA_VAPID_PRIVATE_KEY') ?: getenv('VAPID_PRIVATE_KEY') ?: ''));
        $subject = trim((string) (getenv('PIELARMONIA_VAPID_SUBJECT') ?: getenv('VAPID_SUBJECT') ?: 'mailto:admin@pielarmonia.com'));

        return [
            'publicKey' => $publicKey,
            'privateKey' => $privateKey,
            'subject' => $subject !== '' ? $subject : 'mailto:admin@pielarmonia.com'
        ];
    }

    private function normalizeSubscription(array $subscription, string $userAgent): ?array
    {
        $endpoint = trim((string) ($subscription['endpoint'] ?? ''));
        $keys = is_array($subscription['keys'] ?? null) ? $subscription['keys'] : [];
        $p256dh = trim((string) ($keys['p256dh'] ?? ''));
        $auth = trim((string) ($keys['auth'] ?? ''));

        if ($endpoint === '' || $p256dh === '' || $auth === '') {
            return null;
        }

        if (!preg_match('/^https?:\/\//i', $endpoint)) {
            return null;
        }

        return [
            'endpoint' => $endpoint,
            'p256dh' => $p256dh,
            'auth' => $auth,
            'userAgent' => substr(trim($userAgent), 0, 300),
            'updatedAt' => local_date('c')
        ];
    }

    private function storagePath(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . self::STORAGE_FILENAME;
    }

    private function readSubscriptions(): array
    {
        $path = $this->storagePath();
        if (!is_file($path)) {
            return [
                'items' => [],
                'updatedAt' => local_date('c')
            ];
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return [
                'items' => [],
                'updatedAt' => local_date('c')
            ];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [
                'items' => [],
                'updatedAt' => local_date('c')
            ];
        }

        return [
            'items' => is_array($decoded['items'] ?? null) ? $decoded['items'] : [],
            'updatedAt' => (string) ($decoded['updatedAt'] ?? local_date('c'))
        ];
    }

    private function writeSubscriptions(array $payload): bool
    {
        $path = $this->storagePath();
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return false;
        }

        $encoded = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || trim($encoded) === '') {
            return false;
        }

        return @file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) !== false;
    }
}
