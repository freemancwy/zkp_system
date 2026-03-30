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

export function getChainStatus() {
  return request("/api/chain-status")
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

export function prepareVote(payload) {
  return request("/api/vote", {
    method: "POST",
    body: JSON.stringify({ ...payload, submitMode: "client" }),
  })
}

export function recordVote(payload) {
  return request("/api/vote-record", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getActivityStats(externalNullifier, options = {}) {
  const params = new URLSearchParams()

  if (options.vote && options.vote !== "all") {
    params.set("vote", options.vote)
  } else if (options.vote === "all") {
    params.set("vote", "all")
  }

  if (options.page) {
    params.set("page", String(options.page))
  }

  if (options.pageSize) {
    params.set("pageSize", String(options.pageSize))
  }

  const query = params.toString()
  const path = `/api/activity-stats/${encodeURIComponent(externalNullifier)}${
    query ? `?${query}` : ""
  }`

  return request(path)
}
