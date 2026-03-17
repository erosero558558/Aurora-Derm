<?php

declare(strict_types=1);

require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/common.php';

class TicketPrinter
{
    private bool $enabled;
    private string $host;
    private int $port;
    private int $timeoutMs;

    public function __construct(bool $enabled, string $host, int $port, int $timeoutMs)
    {
        $this->enabled = $enabled;
        $this->host = trim($host);
        $this->port = max(1, $port);
        $this->timeoutMs = max(200, $timeoutMs);
    }

    public static function fromEnv(): self
    {
        $enabledRaw = getenv('PIELARMONIA_TICKET_PRINTER_ENABLED');
        $hostRaw = getenv('PIELARMONIA_TICKET_PRINTER_HOST');
        $portRaw = getenv('PIELARMONIA_TICKET_PRINTER_PORT');
        $timeoutRaw = getenv('PIELARMONIA_TICKET_PRINTER_TIMEOUT_MS');

        $enabled = parse_bool(is_string($enabledRaw) ? $enabledRaw : false);
        $host = is_string($hostRaw) ? trim($hostRaw) : '';
        $port = is_string($portRaw) && preg_match('/^\d+$/', $portRaw) ? (int) $portRaw : 9100;
        $timeoutMs = is_string($timeoutRaw) && preg_match('/^\d+$/', $timeoutRaw) ? (int) $timeoutRaw : 1500;

        return new self($enabled, $host, $port, $timeoutMs);
    }

    /**
     * @return array{ok:bool,printed:bool,errorCode:string,message:string}
     */
    public function printQueueTicket(array $ticket): array
    {
        if (!$this->enabled) {
            return [
                'ok' => true,
                'printed' => false,
                'errorCode' => 'printer_disabled',
                'message' => 'Impresora deshabilitada por configuracion',
            ];
        }

        if ($this->host === '') {
            return [
                'ok' => true,
                'printed' => false,
                'errorCode' => 'printer_host_missing',
                'message' => 'Impresora no configurada (host vacio)',
            ];
        }

        $errno = 0;
        $errstr = '';
        $timeoutSec = max(0.2, $this->timeoutMs / 1000);
        $socket = @fsockopen($this->host, $this->port, $errno, $errstr, $timeoutSec);
        if (!is_resource($socket)) {
            return [
                'ok' => false,
                'printed' => false,
                'errorCode' => 'printer_connect_failed',
                'message' => 'No se pudo conectar a la impresora: ' . trim($errstr !== '' ? $errstr : (string) $errno),
            ];
        }

        stream_set_timeout($socket, (int) ceil($timeoutSec));
        $payload = $this->buildEscPosPayload($ticket);
        $written = @fwrite($socket, $payload);
        @fflush($socket);
        @fclose($socket);

        if ($written === false || $written <= 0) {
            return [
                'ok' => false,
                'printed' => false,
                'errorCode' => 'printer_write_failed',
                'message' => 'No se pudo enviar el ticket a la impresora',
            ];
        }

        return [
            'ok' => true,
            'printed' => true,
            'errorCode' => '',
            'message' => 'Ticket impreso',
        ];
    }

    private function buildEscPosPayload(array $ticket): string
    {
        $ticketCode = strtoupper(trim((string) ($ticket['ticketCode'] ?? 'A-000')));
        $initials = strtoupper(trim((string) ($ticket['patientInitials'] ?? 'PA')));
        $queueType = (string) ($ticket['queueType'] ?? 'walk_in');
        $createdAt = (string) ($ticket['createdAt'] ?? local_date('c'));
        $priority = (string) ($ticket['priorityClass'] ?? 'walk_in');
        $consultorio = $ticket['assignedConsultorio'] ?? null;

        $lines = [
            'AURORA DERM',
            'Turnero sala de espera',
            str_repeat('-', 32),
            'Turno: ' . ($ticketCode !== '' ? $ticketCode : 'A-000'),
            'Iniciales: ' . ($initials !== '' ? $initials : 'PA'),
            'Tipo: ' . ($queueType === 'appointment' ? 'Cita' : 'Walk-in'),
            'Prioridad: ' . $this->priorityLabel($priority),
            'Hora: ' . $this->printableDateTime($createdAt),
            'Consultorio: ' . ($consultorio === null ? '-' : (string) $consultorio),
            str_repeat('-', 32),
            'Espere su llamado en pantalla',
            'TV: ticket + iniciales',
            '',
            '',
        ];

        $esc = chr(27);
        $gs = chr(29);

        $payload = '';
        $payload .= $esc . '@'; // init
        $payload .= $esc . 'a' . chr(1); // center
        $payload .= $esc . '!' . chr(16); // double height
        $payload .= $this->line($lines[0]);
        $payload .= $esc . '!' . chr(0); // normal text
        $payload .= $this->line($lines[1]);
        $payload .= $esc . 'a' . chr(0); // left

        for ($i = 2, $total = count($lines); $i < $total; $i++) {
            $payload .= $this->line($lines[$i]);
        }

        $payload .= $gs . 'V' . chr(66) . chr(0); // full cut
        return $payload;
    }

    private function line(string $text): string
    {
        $text = preg_replace('/[^\x20-\x7E]/', '', $text);
        if (!is_string($text)) {
            $text = '';
        }
        return $text . "\n";
    }

    private function printableDateTime(string $isoDate): string
    {
        $ts = strtotime($isoDate);
        if ($ts === false) {
            return local_date('Y-m-d H:i');
        }
        return date('Y-m-d H:i', $ts);
    }

    private function priorityLabel(string $priorityClass): string
    {
        if ($priorityClass === 'appt_overdue') {
            return 'Cita vencida';
        }
        if ($priorityClass === 'appt_current') {
            return 'Cita vigente';
        }
        return 'Walk-in';
    }
}
