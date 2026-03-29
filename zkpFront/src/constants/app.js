export const API_BASE_URL = "http://localhost:3000"

export const LOCAL_IDENTITY_KEY = "zkp_demo_local_identity"

export const STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
}

export const VOTE_OPTIONS = [
  { label: "支持", value: "1", description: "赞成该提案或活动。" },
  { label: "反对", value: "0", description: "反对该提案或活动。" },
]

export const NAV_ITEMS = [
  { label: "首页", to: "/" },
  { label: "用户投票", to: "/vote" },
  { label: "管理员", to: "/admin" },
]
