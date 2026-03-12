const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export type ConsentStatus = "granted" | "pending";

type ConsentStatusResponse = {
  status: string;
  consent: ConsentStatus;
  session: string;
};

type ConsentMutationResponse = {
  status: string;
  consent: ConsentStatus;
  session: string;
  updatedAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let details = `Request failed with ${response.status}`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        details = payload.message;
      }
    } catch {
      // Ignore parse errors and keep default message.
    }

    throw new Error(details);
  }

  return (await response.json()) as T;
}

export function getConsentStatus() {
  return request<ConsentStatusResponse>("/api/consent/status");
}

export function grantConsent() {
  return request<ConsentMutationResponse>("/api/consent/grant", {
    method: "POST",
  });
}

export function revokeConsent() {
  return request<ConsentMutationResponse>("/api/consent/revoke", {
    method: "POST",
  });
}

export { API_BASE_URL };
