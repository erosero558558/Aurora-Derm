import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3020);
const host = "0.0.0.0";

const app = await createApp({
  dispatchWorker: {
    autoStart: true,
    workerId: process.env.PATIENT_FLOW_DISPATCH_WORKER_ID || "patient_flow_server",
    intervalMs: Number(process.env.PATIENT_FLOW_DISPATCH_WORKER_INTERVAL_MS || 1500),
    limit: Number(process.env.PATIENT_FLOW_DISPATCH_WORKER_LIMIT || 5),
    leaseTtlMs: Number(process.env.PATIENT_FLOW_DISPATCH_WORKER_LEASE_MS || 60000)
  }
});

try {
  await app.listen({ port, host });
  console.log(`Patient Flow OS listening on http://localhost:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
