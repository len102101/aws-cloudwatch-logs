import { RequestWithBody } from "../types";
import { SENSITIVE_FIELDS } from "./constants";

export function getClientIp(req: RequestWithBody): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    (req as any).connection?.remoteAddress ||
    (req as any).socket?.remoteAddress ||
    "unknown"
  );
}

export function sanitizeData(data: any): any {
  if (!data || !SENSITIVE_FIELDS) return data;

  try {
    const sanitized = JSON.parse(JSON.stringify(data));
    return removeSensitiveFields(sanitized, SENSITIVE_FIELDS);
  } catch (error) {
    return data;
  }
}

export function removeSensitiveFields(
  obj: any,
  sensitiveFields: string[]
): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeSensitiveFields(item, sensitiveFields));
  }

  const result = { ...obj };

  for (const key in result) {
    if (
      sensitiveFields.some((field) =>
        key.toLowerCase().includes(field.toLowerCase())
      )
    ) {
      result[key] = "[REDACTED]";
    } else if (typeof result[key] === "object") {
      result[key] = removeSensitiveFields(result[key], sensitiveFields);
    }
  }

  return result;
}
