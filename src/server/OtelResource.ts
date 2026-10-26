import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { ServerEnv } from "./ServerEnv";

export function getOtelResource() {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "closefront",
    [ATTR_SERVICE_VERSION]: "1.0.0",
    ...getPromLabels(),
  });
}

export function getPromLabels() {
  const workerId = ServerEnv.workerId();
  return {
    "service.instance.id": ServerEnv.hostname(),
    "closefront.environment": ServerEnv.env(),
    "closefront.host": ServerEnv.host(),
    "closefront.domain": ServerEnv.domain(),
    "closefront.subdomain": ServerEnv.subdomain(),
    "closefront.component":
      workerId !== undefined ? "Worker " + workerId : "Master",
  };
}
