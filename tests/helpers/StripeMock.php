<?php

declare(strict_types=1);

namespace Stripe {
    if (!class_exists('Stripe\StripeClient')) {
        class StripeClient
        {
            public $paymentIntents;
            public $checkout;
            public function __construct($secret)
            {
                $this->paymentIntents = new PaymentIntents();
                $this->checkout = new Checkout();
            }
        }
    }
    if (!class_exists('Stripe\PaymentIntents')) {
        class PaymentIntents
        {
            public function create($params, $options = [])
            {
                $metadata = isset($params['metadata']) ? $params['metadata'] : [];
                $data = [
                    'id' => 'pi_mock_' . bin2hex(random_bytes(8)),
                    'client_secret' => 'seti_mock_secret',
                    'amount' => $params['amount'],
                    'currency' => $params['currency'],
                    'status' => 'requires_payment_method',
                    'metadata' => $metadata
                ];
                return new StripeObject($data);
            }
            public function retrieve($id)
            {
                $overrides = isset($GLOBALS['__STRIPE_MOCK_PAYMENT_INTENTS'][$id]) && is_array($GLOBALS['__STRIPE_MOCK_PAYMENT_INTENTS'][$id])
                    ? $GLOBALS['__STRIPE_MOCK_PAYMENT_INTENTS'][$id]
                    : [];
                $data = array_merge([
                    'id' => $id,
                    'status' => 'succeeded',
                    'amount' => 4600,
                    'amount_received' => 4600,
                    'currency' => 'usd',
                    'metadata' => [],
                ], $overrides);
                return new StripeObject($data);
            }
        }
    }
    if (!class_exists('Stripe\Checkout')) {
        class Checkout
        {
            public $sessions;
            public function __construct()
            {
                $this->sessions = new CheckoutSessions();
            }
        }
    }
    if (!class_exists('Stripe\CheckoutSessions')) {
        class CheckoutSessions
        {
            public function create($params, $options = [])
            {
                $sessionId = 'cs_mock_' . bin2hex(random_bytes(8));
                $metadata = isset($params['metadata']) && is_array($params['metadata']) ? $params['metadata'] : [];
                $data = [
                    'id' => $sessionId,
                    'url' => 'https://checkout.stripe.test/session/' . $sessionId,
                    'status' => 'open',
                    'payment_status' => 'unpaid',
                    'metadata' => $metadata,
                    'client_reference_id' => isset($params['client_reference_id']) ? $params['client_reference_id'] : '',
                    'success_url' => isset($params['success_url']) ? $params['success_url'] : '',
                    'cancel_url' => isset($params['cancel_url']) ? $params['cancel_url'] : '',
                    'payment_intent' => null,
                ];
                return new StripeObject($data);
            }
        }
    }
    if (!class_exists('Stripe\StripeObject')) {
        #[\AllowDynamicProperties]
        class StripeObject
        {
            private $data;
            public function __construct($data)
            {
                $this->data = $data;
                foreach ($data as $k => $v) {
                    $this->$k = $v;
                }
            }
            public function toArray()
            {
                return $this->data;
            }
        }
    }
    if (!class_exists('Stripe\Webhook')) {
        class Webhook
        {
            public static function constructEvent($payload, $sigHeader, $secret)
            {
                if ($sigHeader !== 'valid_signature') {
                    throw new Exception\SignatureVerificationException("Invalid signature");
                }
                $decoded = json_decode((string) $payload, true);
                if (is_array($decoded)) {
                    return new Event($decoded);
                }
                return new Event();
            }
        }
    }
    if (!class_exists('Stripe\Event')) {
        class Event
        {
            public $type;
            public $data;
            private $payload;
            public function __construct($payload = null)
            {
                $this->payload = is_array($payload) ? $payload : [
                    'type' => 'payment_intent.succeeded',
                    'data' => ['object' => ['id' => 'pi_mock_webhook']],
                ];
                $this->type = isset($this->payload['type']) ? $this->payload['type'] : 'payment_intent.succeeded';
                $this->data = isset($this->payload['data']) ? $this->payload['data'] : ['object' => ['id' => 'pi_mock_webhook']];
            }
            public function toArray()
            {
                return [
                    'id' => isset($this->payload['id']) ? $this->payload['id'] : 'evt_mock',
                    'type' => $this->type,
                    'data' => $this->data,
                ];
            }
        }
    }
}

namespace Stripe\Exception {
    if (!class_exists('Stripe\Exception\ApiErrorException')) {
        class ApiErrorException extends \Exception
        {
        }
    }
    if (!class_exists('Stripe\Exception\SignatureVerificationException')) {
        class SignatureVerificationException extends \Exception
        {
        }
    }
}
