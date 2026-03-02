# Monitoring Setup Guide

This document covers both cloud-based (UptimeRobot) and self-hosted (Grafana + Prometheus) monitoring solutions for PielArmonia.

---

## Option 1: UptimeRobot (Cloud - Recommended for Quick Setup)

To ensure high availability and quick response to downtime, we use UptimeRobot to monitor the application's health.

### Endpoint

The application exposes a health check endpoint:

- **URL**: `https://pielarmonia.com/api.php?resource=health`
- **Method**: `GET`
- **Expected Status**: `200 OK`
- **Expected Response Body**: `{"ok":true, "status":"ok", ...}`

### Configuration Steps

1.  **Create Account/Login**: Go to [uptimerobot.com](https://uptimerobot.com/) and log in.
2.  **Add New Monitor**:
    - Click **"Add New Monitor"**.
    - **Monitor Type**: Select "HTTP(s)".
    - **Friendly Name**: `PielArmonia Health`.
    - **URL (or IP)**: `https://pielarmonia.com/api.php?resource=health`
    - **Monitoring Interval**: `5 minutes` (or shorter if on paid plan).
    - **Monitor Timeout**: `30 seconds`.
3.  **Advanced Settings** (Recommended):
    - **Keyword Monitoring**: Enable.
    - **Keyword to find**: `"ok":true` (Case insensitive).
    - This ensures that not only the server responds (200 OK), but the application logic is also healthy (i.e., storage is writable).
4.  **Alert Contacts**:
    - Select the email addresses or integrations (Slack, Telegram) to notify upon downtime.
5.  **Create Monitor**.

### Verification

After creation, the monitor should show as **UP** within a few minutes. If it shows **DOWN**:

- Check if the site is accessible.
- Check if the `/api.php?resource=health` endpoint is returning `200 OK`.
- Verify no firewall rules are blocking UptimeRobot IPs.

### Maintenance

During planned maintenance or deployments, you can pause the monitor to avoid false alarms.

---

## Sentry Evidence Verification

Sentry evidence is tracked through a normalized runtime artifact:

- Local/runtime path: `verification/runtime/sentry-events-last.json`
- Producer command: `npm run verify:sentry:events`
- Manual workflow: `.github/workflows/sentry-events-verify.yml`
- Uploaded artifact name: `sentry-events-report`

Expected behavior:

1. The script always writes JSON, even when verification fails.
2. The JSON includes `status`, `failureReason`, and `actionRequired`.
3. `bin/prod-readiness-summary.js` consumes the latest Sentry workflow artifact first and falls back to the local runtime file.

Operational notes:

- If the status is `ok`, backend and frontend already have recent evidence.
- If the status is `needs_configuration`, the artifact should explicitly list missing env/secrets such as `SENTRY_AUTH_TOKEN` or `SENTRY_ORG`.
- If the status is `missing_events` or `stale_events`, the integration exists but recent events must be generated or recovered.

Recommended verification flow:

```bash
npm run verify:sentry:events
node bin/prod-readiness-summary.js
```

If local credentials are unavailable, run the manual workflow and review the uploaded `sentry-events-report` artifact.

---

## Option 2: Self-Hosted Grafana + Prometheus (Advanced)

This guide explains how to spin up a local or self-hosted Grafana + Prometheus stack to monitor the PielArmonia application.

### Prerequisites

- Docker and Docker Compose installed.
- The PHP application running on port `8080` (or update `prometheus.docker.yml`).

### Configuration Files

- `docker-compose.monitoring.yml`: Orchestrates Prometheus and Grafana containers.
- `prometheus.docker.yml`: Prometheus configuration file. Defaults to scraping `host.docker.internal:8080`.
- `grafana/dashboard.json`: The Grafana dashboard definition.
- `grafana/provisioning/`: Configuration to automatically load datasources and dashboards.

### Running the Monitoring Stack

1. Start your PHP application (e.g., using built-in server):

    ```bash
    php -S 0.0.0.0:8080
    ```

    _Note: Ensure it binds to `0.0.0.0` or uses `host.docker.internal` correctly._

2. Start the monitoring stack:

    ```bash
    docker-compose -f docker-compose.monitoring.yml up -d
    ```

3. Access the services:
    - **Prometheus**: [http://localhost:9090](http://localhost:9090)
    - **Grafana**: [http://localhost:3000](http://localhost:3000) (Login: `admin` / `admin`)

### Verification

1. Go to Prometheus -> **Status** -> **Targets**. Verify that `pielarmonia` target is UP.
2. Go to Grafana -> **Dashboards** -> **Piel en Armonía Metrics**. You should see the panels populating with data.

### Troubleshooting

- If Prometheus target is DOWN, check if `host.docker.internal` resolves correctly on your OS.
- If using Linux, you might need `network_mode: host` or ensure the firewall allows Docker to talk to host.
- Check logs: `docker-compose -f docker-compose.monitoring.yml logs -f`
