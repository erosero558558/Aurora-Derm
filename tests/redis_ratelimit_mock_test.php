<?php

namespace Predis {
    if (!class_exists('Predis\Client')) {
        class Client {
            public function __call($method, $args) {
                return null;
            }
        }
    }
}

namespace {
    // Global namespace

    class PredisClientMock {
        public $data = []; // key => [timestamp1, timestamp2, ...]

        public function zremrangebyscore($key, $min, $max) {
            if (!isset($this->data[$key])) return 0;
            $count = 0;
            $new = [];
            foreach ($this->data[$key] as $ts) {
                if (!($ts >= $min && $ts <= $max)) {
                    $new[] = $ts;
                } else {
                    $count++;
                }
            }
            $this->data[$key] = $new;
            return $count;
        }

        public function zcard($key) {
            return isset($this->data[$key]) ? count($this->data[$key]) : 0;
        }

        public function zadd($key, $arg1, $arg2 = null) {
            if (!isset($this->data[$key])) {
                $this->data[$key] = [];
            }

            // Predis\Client::zadd($key, array $dictionary)
            // Predis\Client::zadd($key, $score, $member)

            if (is_array($arg1)) {
                // zadd(key, [member => score])
                foreach ($arg1 as $m => $s) {
                    $this->data[$key][] = $s;
                }
            } else {
                // zadd(key, score, member)
                $this->data[$key][] = $arg1;
            }
            return 1;
        }

        public function expire($key, $seconds) {
            return 1;
        }

        public function del($keys) {
            if (is_array($keys)) {
                foreach ($keys as $k) {
                    if (isset($this->data[$k])) unset($this->data[$k]);
                }
            } else {
                if (isset($this->data[$keys])) unset($this->data[$keys]);
            }
            return 1;
        }

        public function pipeline() {
            return $this;
        }

        public function execute() {
            return [];
        }
    }

    require_once __DIR__ . '/../lib/ratelimit.php';

    // Mock data_dir_path if needed
    if (!function_exists('data_dir_path')) {
        function data_dir_path() { return __DIR__ . '/../data'; }
    }
    if (!function_exists('json_response')) {
        function json_response($data, $code) {
            echo "JSON Response $code: " . json_encode($data) . "\n";
            // exit; // Don't exit in test
        }
    }

    echo "Setting up mock Redis client...\n";
    $mock = new PredisClientMock();

    if (function_exists('_set_rate_limit_redis')) {
        _set_rate_limit_redis($mock);
        echo "Mock Redis client set.\n";

        // Test 1: Check rate limit
        $action = 'test_redis';

        // Reset initially
        reset_rate_limit($action);

        // We need to clear mock data too because reset_rate_limit calls del() on mock
        // but let's be sure.
        $mock->del(['ratelimit:' . md5('unknown:' . $action)]);

        $res1 = check_rate_limit($action, 2, 60);
        echo "1. Check (should pass): " . ($res1 ? 'PASS' : 'FAIL') . "\n";

        $res2 = check_rate_limit($action, 2, 60);
        echo "2. Check (should pass): " . ($res2 ? 'PASS' : 'FAIL') . "\n";

        $res3 = check_rate_limit($action, 2, 60);
        echo "3. Check (should fail): " . (!$res3 ? 'PASS (Rate Limited)' : 'FAIL') . "\n";

        // Verify Redis state
        // rate_limit_client_ip returns 'unknown' in CLI usually
        $ipKey = md5('unknown:' . $action);
        $redisKey = 'ratelimit:' . $ipKey;
        $count = $mock->zcard($redisKey);
        echo "Redis count for key $redisKey: $count (Expected: 2)\n";

        // Test 2: Reset
        reset_rate_limit($action);
        $countAfterReset = $mock->zcard($redisKey);
        echo "Redis count after reset: $countAfterReset (Expected: 0)\n";

        $res4 = check_rate_limit($action, 2, 60);
        echo "4. After reset (should pass): " . ($res4 ? 'PASS' : 'FAIL') . "\n";

    } else {
        echo "Function _set_rate_limit_redis not found. Skipping Redis tests.\n";
    }
}
