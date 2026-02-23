<?php

declare(strict_types=1);

namespace Tests\Unit\Booking;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/business.php';

class BookingPricingRulesTest extends TestCase
{
    protected function tearDown(): void
    {
        // Reset environment variable after each test
        putenv('PIELARMONIA_VAT_RATE');
    }

    public function testGetVatRateDefault(): void
    {
        // Ensure env var is not set
        putenv('PIELARMONIA_VAT_RATE');
        $this->assertEquals(0.15, get_vat_rate());
    }

    public function testGetVatRateFromEnv(): void
    {
        putenv('PIELARMONIA_VAT_RATE=12');
        $this->assertEquals(0.12, get_vat_rate());

        putenv('PIELARMONIA_VAT_RATE=0.10');
        $this->assertEquals(0.10, get_vat_rate());
    }

    public function testGetServicePriceAmount(): void
    {
        $this->assertEquals(40.00, get_service_price_amount('consulta'));
        $this->assertEquals(150.00, get_service_price_amount('laser'));
        $this->assertEquals(0.00, get_service_price_amount('non_existent'));
    }

    public function testGetServiceTotalPrice(): void
    {
        // Reset to default 15%
        putenv('PIELARMONIA_VAT_RATE');

        // Consulta: 40 + 0% tax
        $this->assertEquals('$40.00', get_service_total_price('consulta'));

        // Laser: 150 + 15% tax = 150 + 22.5 = 172.5
        $this->assertEquals('$172.50', get_service_total_price('laser'));
    }

    public function testGetServicePriceBreakdown(): void
    {
        putenv('PIELARMONIA_VAT_RATE=15');

        $breakdown = get_service_price_breakdown('laser');

        $this->assertIsArray($breakdown);
        $this->assertEquals('laser', $breakdown['service_id']);
        $this->assertEquals(150.00, $breakdown['pricing']['base_amount']);
        $this->assertEquals(0.15, $breakdown['pricing']['tax_rate']);
        $this->assertEquals(22.50, $breakdown['pricing']['tax_amount']);
        $this->assertEquals(172.50, $breakdown['pricing']['total_amount']);
        $this->assertEquals('IVA 15% incluido', $breakdown['tax_label']);
    }

    public function testGetServicePriceBreakdownNonExistent(): void
    {
        $breakdown = get_service_price_breakdown('invalid');
        $this->assertArrayHasKey('error', $breakdown);
    }

    public function testValidatePaymentAmount(): void
    {
        putenv('PIELARMONIA_VAT_RATE=15');

        // Expected: 172.50
        $result = validate_payment_amount('laser', 172.50);
        $this->assertTrue($result['valid']);

        // Tolerance check (default 0.01)
        $result = validate_payment_amount('laser', 172.509);
        $this->assertTrue($result['valid']);

        // Invalid amount
        $result = validate_payment_amount('laser', 100.00);
        $this->assertFalse($result['valid']);
        $this->assertArrayHasKey('error', $result);
    }
}
