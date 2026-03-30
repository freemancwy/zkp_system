import { API_BASE_URL } from "../constants/app"

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data.error || data.message || "请求失败")
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export function getRootInfo() {
  return request("/api/root")
}

export function getActivities() {
  return request("/api/external-nullifiers")
}

export function publishActivity(payload) {
  return request("/api/external-nullifier/publish", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function registerPhone(phone) {
  return request("/api/register", {
    method: "POST",
    body: JSON.stringify({ phone }),
  })
}

export function getMerkleProof(phone) {
  return request("/api/merkle-proof", {
    method: "POST",
    body: JSON.stringify({ phone }),
  })
}

export function submitVote(payload) {
  return request("/api/vote", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getActivityStats(externalNullifier) {
  return request(
    `/api/activity-stats/${encodeURIComponent(externalNullifier)}`
  )
}
