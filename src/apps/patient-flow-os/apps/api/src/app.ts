import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  AgentRuntime,
  HeuristicFallbackProvider,
  createDefaultAgentRuntime
} from "../../../packages/agent-runtime/src/index.js";
import { PatientCaseCopilotService } from "./copilot.js";
import type { DestinationDispatchPorts } from "./destination-ports.js";
import { createCopilotDispatchWorker, type CopilotDispatchWorkerOptions } from "./dispatch-worker.js";
import { createDefaultRuntimeRepository } from "./postgres-runtime.js";
import { registerRoutes } from "./routes.js";
import type { FastifyInstance } from "fastify";
import type { AgentProvider } from "../../../packages/agent-runtime/src/index.js";
import type { PlatformRepository } from "./state.js";

export interface AppOptions {
  provider?: AgentProvider;
  repository?: PlatformRepository;
  dispatchPorts?: DestinationDispatchPorts;
  dispatchWorker?: boolean | CopilotDispatchWorkerOptions;
}

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  const repository = options.repository ?? (await createDefaultRuntimeRepository());
  const runtime = options.provider
    ? new AgentRuntime(options.provider, new HeuristicFallbackProvider())
    : createDefaultAgentRuntime();
  const copilot = new PatientCaseCopilotService(repository, runtime, options.dispatchPorts);

  const dispatchWorkerOptions =
    typeof options.dispatchWorker === "object"
      ? options.dispatchWorker
      : options.dispatchWorker
        ? { autoStart: true }
        : null;
  const dispatchWorker = dispatchWorkerOptions
    ? createCopilotDispatchWorker(copilot, dispatchWorkerOptions)
    : null;

  const closableRepository = repository as PlatformRepository & { close?: () => Promise<void> };
  if (dispatchWorker) {
    app.addHook("onClose", async () => {
      dispatchWorker.stop();
    });
  }
  if (typeof closableRepository.close === "function") {
    app.addHook("onClose", async () => {
      await closableRepository.close?.();
    });
  }

  await registerRoutes(app, repository, runtime, copilot);
  return app;
}
