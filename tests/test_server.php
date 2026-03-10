<?php

declare(strict_types=1);

function test_server_env(): array
{
    $env = getenv();
    if (!is_array($env)) {
        $env = [];
    }

    foreach ($_ENV as $key => $value) {
        if (!array_key_exists($key, $env) && is_string($value)) {
            $env[$key] = $value;
        }
    }

    return $env;
}

function test_server_host(): string
{
    $host = getenv('PIELARMONIA_TEST_SERVER_HOST');
    if (!is_string($host) || trim($host) === '') {
        return '127.0.0.1';
    }

    return trim($host);
}

function test_server_port_available(string $host, int $port): bool
{
    $socket = @stream_socket_server("tcp://{$host}:{$port}", $errno, $errstr);
    if (!is_resource($socket)) {
        return false;
    }

    fclose($socket);
    return true;
}

function reserve_test_server_port(?int $preferredPort = null, ?string $host = null): int
{
    $host = $host ?: test_server_host();
    if (is_int($preferredPort) && $preferredPort > 0 && test_server_port_available($host, $preferredPort)) {
        return $preferredPort;
    }

    $socket = @stream_socket_server("tcp://{$host}:0", $errno, $errstr);
    if (!is_resource($socket)) {
        throw new RuntimeException("Failed to reserve a local test port: {$errstr} ({$errno})");
    }

    $address = stream_socket_get_name($socket, false);
    fclose($socket);

    if (!is_string($address) || strrpos($address, ':') === false) {
        throw new RuntimeException('Failed to resolve the reserved local test port.');
    }

    return (int) substr($address, (int) strrpos($address, ':') + 1);
}

function wait_for_test_server(string $host, int $port, int $timeoutMs = 8000): bool
{
    $deadline = microtime(true) + ($timeoutMs / 1000);
    while (microtime(true) < $deadline) {
        $connection = @fsockopen($host, $port, $errno, $errstr, 0.2);
        if (is_resource($connection)) {
            fclose($connection);
            return true;
        }

        usleep(100000);
    }

    return false;
}

function read_test_server_logs(array $server): string
{
    $stdout = '';
    $stderr = '';

    if (isset($server['stdout_file']) && is_string($server['stdout_file']) && is_file($server['stdout_file'])) {
        $stdout = (string) file_get_contents($server['stdout_file']);
    }
    if (isset($server['stderr_file']) && is_string($server['stderr_file']) && is_file($server['stderr_file'])) {
        $stderr = (string) file_get_contents($server['stderr_file']);
    }

    $parts = [];
    if (trim($stdout) !== '') {
        $parts[] = "stdout:\n" . trim($stdout);
    }
    if (trim($stderr) !== '') {
        $parts[] = "stderr:\n" . trim($stderr);
    }

    return implode("\n\n", $parts);
}

function start_test_php_server(array $options = []): array
{
    $docroot = isset($options['docroot']) ? realpath((string) $options['docroot']) : realpath(__DIR__ . '/..');
    if ($docroot === false) {
        throw new RuntimeException('Failed to resolve the PHP test server document root.');
    }

    $host = isset($options['host']) ? (string) $options['host'] : test_server_host();
    $preferredPort = isset($options['port']) ? (int) $options['port'] : null;
    $port = reserve_test_server_port($preferredPort, $host);
    $router = isset($options['router']) ? realpath((string) $options['router']) : false;
    $timeoutMs = isset($options['startup_timeout_ms']) ? (int) $options['startup_timeout_ms'] : 8000;

    $stdoutFile = tempnam(sys_get_temp_dir(), 'pielarmonia-test-server-out-');
    $stderrFile = tempnam(sys_get_temp_dir(), 'pielarmonia-test-server-err-');
    if ($stdoutFile === false || $stderrFile === false) {
        throw new RuntimeException('Failed to allocate temp files for the PHP test server.');
    }

    $command = [
        PHP_BINARY,
        '-S',
        "{$host}:{$port}",
        '-t',
        $docroot,
    ];
    if (is_string($router) && $router !== '' && is_file($router)) {
        $command[] = $router;
    }

    $env = array_merge(
        test_server_env(),
        isset($options['env']) && is_array($options['env']) ? $options['env'] : []
    );

    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['file', $stdoutFile, 'a'],
        2 => ['file', $stderrFile, 'a'],
    ];

    $process = proc_open($command, $descriptors, $pipes, $docroot, $env);
    if (!is_resource($process)) {
        @unlink($stdoutFile);
        @unlink($stderrFile);
        throw new RuntimeException('Failed to start the PHP test server process.');
    }

    if (isset($pipes[0]) && is_resource($pipes[0])) {
        fclose($pipes[0]);
    }

    $server = [
        'process' => $process,
        'host' => $host,
        'port' => $port,
        'base_url' => "http://{$host}:{$port}",
        'stdout_file' => $stdoutFile,
        'stderr_file' => $stderrFile,
    ];

    if (!wait_for_test_server($host, $port, $timeoutMs)) {
        $logs = read_test_server_logs($server);
        stop_test_php_server($server);
        throw new RuntimeException(
            "PHP test server did not become ready on http://{$host}:{$port}" .
            ($logs !== '' ? "\n\n{$logs}" : '')
        );
    }

    return $server;
}

function stop_test_php_server(array &$server): void
{
    $process = $server['process'] ?? null;
    $pid = null;

    if (is_resource($process)) {
        $status = proc_get_status($process);
        $pid = isset($status['pid']) ? (int) $status['pid'] : null;

        if (!empty($status['running'])) {
            @proc_terminate($process);

            $deadline = microtime(true) + 2.0;
            do {
                usleep(100000);
                $status = proc_get_status($process);
            } while (!empty($status['running']) && microtime(true) < $deadline);

            if (!empty($status['running']) && $pid) {
                if (DIRECTORY_SEPARATOR === '\\') {
                    @pclose(@popen("taskkill /PID {$pid} /T /F >NUL 2>NUL", 'r'));
                } else {
                    @exec("kill -TERM {$pid} >/dev/null 2>&1");
                }
            }
        }

        @proc_close($process);
    }

    foreach (['stdout_file', 'stderr_file'] as $key) {
        if (isset($server[$key]) && is_string($server[$key]) && is_file($server[$key])) {
            @unlink($server[$key]);
        }
    }

    $server = [];
}
