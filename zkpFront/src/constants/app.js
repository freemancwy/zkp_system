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

export const VOTE_FILTER_OPTIONS = [
  { label: "全部记录", value: "all" },
  { label: "仅看支持", value: "1" },
  { label: "仅看反对", value: "0" },
]

export const PAGE_SIZE_OPTIONS = [5, 10, 20]

export const NAV_ITEMS = [
  { label: "首页", to: "/" },
  { label: "用户投票", to: "/vote" },
  { label: "管理页", to: "/admin" },
  { label: "合约状态", to: "/contract" },
]
