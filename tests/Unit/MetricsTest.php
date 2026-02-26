<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use ReflectionClass;
use Metrics;

// Ensure the class is loaded if not autoloaded yet (though composer autoload should handle it)
// require_once __DIR__ . '/../../lib/metrics.php';

class MetricsTest extends TestCase
{
    private $tempFile;

    protected function setUp(): void
    {
        // Create a temporary file for testing
        $this->tempFile = tempnam(sys_get_temp_dir(), 'metrics_test_');
        // Ensure it's empty
        file_put_contents($this->tempFile, json_encode(['counters' => [], 'histograms' => []]));

        $this->resetMetrics();
    }

    protected function tearDown(): void
    {
        if (file_exists($this->tempFile)) {
            unlink($this->tempFile);
        }
        $this->resetMetrics();
    }

    private function resetMetrics(): void
    {
        $ref = new ReflectionClass(Metrics::class);

        $clientProp = $ref->getProperty('client');
        $clientProp->setAccessible(true);
        $clientProp->setValue(null, null);

        $useRedisProp = $ref->getProperty('useRedis');
        $useRedisProp->setAccessible(true);
        $useRedisProp->setValue(null, null);

        $filePathProp = $ref->getProperty('filePath');
        $filePathProp->setAccessible(true);
        $filePathProp->setValue(null, null);
    }

    private function setMetricsFile(string $path): void
    {
        $ref = new ReflectionClass(Metrics::class);

        $filePathProp = $ref->getProperty('filePath');
        $filePathProp->setAccessible(true);
        $filePathProp->setValue(null, $path);

        $useRedisProp = $ref->getProperty('useRedis');
        $useRedisProp->setAccessible(true);
        $useRedisProp->setValue(null, false);
    }

    private function setMetricsRedis($client): void
    {
        $ref = new ReflectionClass(Metrics::class);

        $clientProp = $ref->getProperty('client');
        $clientProp->setAccessible(true);
        $clientProp->setValue(null, $client);

        $useRedisProp = $ref->getProperty('useRedis');
        $useRedisProp->setAccessible(true);
        $useRedisProp->setValue(null, true);
    }

    public function testIncrementFile(): void
    {
        $this->setMetricsFile($this->tempFile);

        Metrics::increment('test_counter');
        Metrics::increment('test_counter', ['label' => 'val'], 2);

        $content = json_decode(file_get_contents($this->tempFile), true);

        $this->assertArrayHasKey('test_counter', $content['counters']);
        $this->assertEquals(1, $content['counters']['test_counter']);

        $keyWithLabel = 'test_counter{label="val"}';
        $this->assertArrayHasKey($keyWithLabel, $content['counters']);
        $this->assertEquals(2, $content['counters'][$keyWithLabel]);
    }

    public function testObserveFile(): void
    {
        $this->setMetricsFile($this->tempFile);

        Metrics::observe('test_hist', 0.5);
        Metrics::observe('test_hist', 1.5, ['foo' => 'bar']);

        $content = json_decode(file_get_contents($this->tempFile), true);

        $this->assertArrayHasKey('test_hist', $content['histograms']);
        $this->assertEquals(1, $content['histograms']['test_hist']['count']);
        $this->assertEquals(0.5, $content['histograms']['test_hist']['sum']);

        $keyWithLabel = 'test_hist{foo="bar"}';
        $this->assertArrayHasKey($keyWithLabel, $content['histograms']);
        $this->assertEquals(1, $content['histograms'][$keyWithLabel]['count']);
        $this->assertEquals(1.5, $content['histograms'][$keyWithLabel]['sum']);

        // Check buckets logic
        $buckets = $content['histograms'][$keyWithLabel]['buckets'];
        // buckets are stored as string keys
        $this->assertEquals(0, $buckets['1'] ?? 0);
        $this->assertEquals(1, $buckets['2.5']);
        $this->assertEquals(1, $buckets['5']);
    }

    public function testIncrementRedis(): void
    {
        // Create a mock object that simulates Predis\Client
        $mockClient = $this->getMockBuilder(\stdClass::class)
            ->addMethods(['incrby', 'sadd'])
            ->getMock();

        $matcher = $this->exactly(2);
        $mockClient->expects($matcher)
            ->method('incrby')
            ->willReturnCallback(function ($key, $val) use ($matcher) {
                if ($key === 'metrics:counter:test_counter') {
                     $this->assertEquals(1, $val);
                } elseif ($key === 'metrics:counter:test_counter{label="val"}') {
                     $this->assertEquals(2, $val);
                } else {
                    $this->fail("Unexpected key: $key");
                }
            });

        $mockClient->expects($this->exactly(2))
            ->method('sadd');

        $this->setMetricsRedis($mockClient);

        Metrics::increment('test_counter');
        Metrics::increment('test_counter', ['label' => 'val'], 2);
    }

    public function testObserveRedis(): void
    {
        $mockPipeline = $this->getMockBuilder(\stdClass::class)
            ->addMethods(['incrby', 'incrbyfloat', 'sadd', 'incr', 'execute'])
            ->getMock();

        $mockPipeline->method('incrby')->willReturn($mockPipeline);
        $mockPipeline->method('incrbyfloat')->willReturn($mockPipeline);
        $mockPipeline->method('sadd')->willReturn($mockPipeline);
        $mockPipeline->method('incr')->willReturn($mockPipeline);
        $mockPipeline->expects($this->once())->method('execute');

        $mockClient = $this->getMockBuilder(\stdClass::class)
            ->addMethods(['pipeline', 'sadd'])
            ->getMock();

        $mockClient->expects($this->once())
            ->method('pipeline')
            ->willReturn($mockPipeline);

        // Client also does sadd('metrics:keys', ...)
        $mockClient->expects($this->once())
            ->method('sadd')
            ->with('metrics:keys', 'metrics:histogram:test_hist');

        $this->setMetricsRedis($mockClient);

        Metrics::observe('test_hist', 0.5);
    }

    public function testExportFile(): void
    {
        $data = [
            'counters' => [
                'my_counter' => 10,
                'my_counter{tag="a"}' => 5
            ],
            'histograms' => [
                'my_hist' => [
                    'count' => 2,
                    'sum' => 3.0,
                    'buckets' => [
                        '1' => 1,
                        '5' => 2,
                        '10' => 2
                    ]
                ]
            ]
        ];
        file_put_contents($this->tempFile, json_encode($data));

        $this->setMetricsFile($this->tempFile);

        $output = Metrics::export();

        $this->assertStringContainsString('# TYPE my_counter counter', $output);
        $this->assertStringContainsString('my_counter 10', $output);
        $this->assertStringContainsString('my_counter{tag="a"} 5', $output);

        $this->assertStringContainsString('# TYPE my_hist histogram', $output);
        $this->assertStringContainsString('my_hist_count 2', $output);
        $this->assertStringContainsString('my_hist_sum 3', $output);
        $this->assertStringContainsString('my_hist_bucket{le="1"} 1', $output);
        $this->assertStringContainsString('my_hist_bucket{le="5"} 2', $output);
        $this->assertStringContainsString('my_hist_bucket{le="+Inf"} 2', $output);
    }

    public function testInitFallback(): void
    {
        // Save original value to restore later
        $originalRedisHost = getenv('PIELARMONIA_REDIS_HOST');

        // Unset REDIS env var
        putenv('PIELARMONIA_REDIS_HOST');

        try {
            $ref = new ReflectionClass(Metrics::class);
            $initMethod = $ref->getMethod('init');
            $initMethod->setAccessible(true);
            $initMethod->invoke(null);

            $useRedis = $ref->getProperty('useRedis');
            $useRedis->setAccessible(true);
            $this->assertFalse($useRedis->getValue());

            $filePath = $ref->getProperty('filePath');
            $filePath->setAccessible(true);

            $this->assertStringEndsWith('data/metrics.json', $filePath->getValue());
        } finally {
            // Restore original value
            if ($originalRedisHost !== false) {
                putenv("PIELARMONIA_REDIS_HOST=$originalRedisHost");
            } else {
                putenv('PIELARMONIA_REDIS_HOST'); // unset if it was unset
            }
        }
    }

    public function testExportRedis(): void
    {
        $mockClient = $this->getMockBuilder(\stdClass::class)
            ->addMethods(['smembers', 'get'])
            ->getMock();

        $mockClient->method('smembers')
            ->willReturnMap([
                ['metrics:keys', [
                    'metrics:counter:my_counter',
                    'metrics:counter:my_counter{tag="a"}',
                    'metrics:histogram:my_hist'
                ]],
                ['metrics:histogram:my_hist:buckets', ['1', '5', '10']]
            ]);

        $mockClient->method('get')
            ->willReturnMap([
                ['metrics:counter:my_counter', '10'],
                ['metrics:counter:my_counter{tag="a"}', '5'],
                ['metrics:histogram:my_hist:count', '2'],
                ['metrics:histogram:my_hist:sum', '3.0'],
                ['metrics:histogram:my_hist:bucket:1', '1'],
                ['metrics:histogram:my_hist:bucket:5', '2'],
                ['metrics:histogram:my_hist:bucket:10', '2']
            ]);

        $this->setMetricsRedis($mockClient);

        $output = Metrics::export();

        $this->assertStringContainsString('# TYPE my_counter counter', $output);
        $this->assertStringContainsString('my_counter 10', $output);
        $this->assertStringContainsString('my_counter{tag="a"} 5', $output);

        $this->assertStringContainsString('# TYPE my_hist histogram', $output);
        $this->assertStringContainsString('my_hist_count 2', $output);
        $this->assertStringContainsString('my_hist_sum 3.0', $output);
        $this->assertStringContainsString('my_hist_bucket{le="1"} 1', $output);
        $this->assertStringContainsString('my_hist_bucket{le="5"} 2', $output);
        $this->assertStringContainsString('my_hist_bucket{le="+Inf"} 2', $output);
    }
}
