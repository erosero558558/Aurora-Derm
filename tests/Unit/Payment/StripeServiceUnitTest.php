<?php

declare(strict_types=1);

namespace Tests\Unit\Payment;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../tests/helpers/StripeMock.php';
require_once __DIR__ . '/../../../lib/business.php';
require_once __DIR__ . '/../../../payment-lib.php';

/**
 * @runInSeparateProcess
 */
class StripeServiceUnitTest extends TestCase
{
    protected function tearDown(): void
    {
        putenv('PIELARMONIA_PAYMENT_CURRENCY');
        putenv('PIELARMONIA_STRIPE_SECRET_KEY');
        putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY');
        putenv('PIELARMONIA_VAT_RATE');
    }

    public function testPaymentCurrencyDefault(): void
    {
        putenv('PIELARMONIA_PAYMENT_CURRENCY');
        $this->assertEquals('USD', \payment_currency());
    }

    public function testPaymentCurrencyCustom(): void
    {
        putenv('PIELARMONIA_PAYMENT_CURRENCY=EUR');
        $this->assertEquals('EUR', \payment_currency());
    }

    public function testPaymentExpectedAmountCents(): void
    {
        putenv('PIELARMONIA_VAT_RATE=15');
        $this->assertEquals(4000, \payment_expected_amount_cents('consulta'));
    }

    public function testPaymentGatewayEnabled(): void
    {
        putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_test_123');
        putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY=pk_test_123');

        $this->assertTrue(class_exists('\Stripe\StripeClient'));

        $this->assertTrue(\payment_gateway_enabled());

        putenv('PIELARMONIA_STRIPE_SECRET_KEY');
        $this->assertFalse(\payment_gateway_enabled());
    }

    public function testStripeCreatePaymentIntent(): void
    {
        putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_test_123');
        putenv('PIELARMONIA_VAT_RATE=15');

        $appointment = [
            'service' => 'consulta',
            'email' => 'test@example.com',
            'doctor' => 'rosero',
            'date' => '2024-01-01',
            'time' => '10:00',
            'name' => 'Test User',
            'phone' => '1234567890'
        ];

        try {
            $intent = \stripe_create_payment_intent($appointment);

            $this->assertIsArray($intent);
            $this->assertStringStartsWith('pi_mock_', $intent['id']);
            $this->assertEquals(4000, $intent['amount']);
            $this->assertEquals('usd', $intent['currency']);
            $this->assertEquals('Test User', $intent['metadata']['name'] ?? '');

        } catch (\Exception $e) {
            $this->fail('Should not throw exception: ' . $e->getMessage());
        }
    }
}
