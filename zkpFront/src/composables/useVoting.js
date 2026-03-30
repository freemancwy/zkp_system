import { computed, reactive } from "vue"
import {
  getActivities,
  getActivityStats,
  getMerkleProof,
  getRootInfo,
  publishActivity,
  registerPhone,
  submitVote as submitVoteRequest,
} from "../services/api"
import { LOCAL_IDENTITY_KEY, STATUS } from "../constants/app"

function safeStorageGet() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_IDENTITY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function safeStorageSet(value) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(LOCAL_IDENTITY_KEY, JSON.stringify(value))
}

function safeStorageClear() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(LOCAL_IDENTITY_KEY)
}

const state = reactive({
  rootInfo: {
    root: null,
    depth: 0,
    leafCount: 0,
  },
  activities: [],
  localIdentity: safeStorageGet(),
  registerStatus: STATUS.IDLE,
  voteStatus: STATUS.IDLE,
  publishStatus: STATUS.IDLE,
  globalStatus: STATUS.IDLE,
  registerMessage: "",
  voteMessage: "",
  publishMessage: "",
  lastVoteResult: null,
})

function normalizeActivities(data) {
  return Array.isArray(data?.externalNullifiers) ? data.externalNullifiers : []
}

async function refreshRootInfo() {
  state.rootInfo = await getRootInfo()
  return state.rootInfo
}

async function refreshActivities() {
  const data = await getActivities()
  state.activities = normalizeActivities(data)
  return state.activities
}

async function loadDashboard() {
  state.globalStatus = STATUS.LOADING

  try {
    await Promise.all([refreshRootInfo(), refreshActivities()])
    state.globalStatus = STATUS.SUCCESS
  } catch (error) {
    state.globalStatus = STATUS.ERROR
    throw error
  }
}

function setRegisterError(message) {
  state.registerStatus = STATUS.ERROR
  state.registerMessage = message
}

function setPublishError(message) {
  state.publishStatus = STATUS.ERROR
  state.publishMessage = message
}

async function registerWithPhone(phone) {
  state.registerStatus = STATUS.LOADING
  state.registerMessage = ""

  try {
    const data = await registerPhone(phone)
    const identity = {
      phone: data.phone,
      identityNullifier: data.identityNullifier,
      identityTrapdoor: data.identityTrapdoor,
      commitment: data.commitment,
      registeredAt: new Date().toISOString(),
    }

    state.localIdentity = identity
    safeStorageSet(identity)
    state.registerStatus = STATUS.SUCCESS
    state.registerMessage = "注册成功，匿名身份已保存到当前浏览器。"
    await refreshRootInfo()
    return data
  } catch (error) {
    if (error.status === 409) {
      state.registerMessage =
        "该手机号已注册。若当前浏览器未保存身份信息，将无法继续投票。"
    } else {
      state.registerMessage = error.message || "注册失败"
    }

    state.registerStatus = STATUS.ERROR
    throw error
  }
}

function restoreIdentityFromStorage(phone = "") {
  const saved = safeStorageGet()

  if (!saved) {
    setRegisterError(
      "当前浏览器没有保存匿名身份，无法恢复。请使用原浏览器继续，或清空该手机号后重新演示。"
    )
    return null
  }

  if (phone && saved.phone !== phone) {
    setRegisterError("本地保存的身份手机号与当前输入不一致。")
    return null
  }

  state.localIdentity = saved
  state.registerStatus = STATUS.SUCCESS
  state.registerMessage = "已从当前浏览器恢复匿名身份。"
  return saved
}

function clearIdentity() {
  state.localIdentity = null
  safeStorageClear()
  state.registerStatus = STATUS.IDLE
  state.registerMessage = ""
}

async function publishNewActivity(activity) {
  state.publishStatus = STATUS.LOADING
  state.publishMessage = ""

  try {
    const data = await publishActivity(activity)
    state.publishStatus = STATUS.SUCCESS
    state.publishMessage = "活动发布成功，用户端现在可以参与投票。"
    await refreshActivities()
    return data
  } catch (error) {
    state.publishStatus = STATUS.ERROR
    state.publishMessage = error.message || "活动发布失败"
    throw error
  }
}

async function submitVote({ externalNullifier, vote }) {
  if (!state.localIdentity?.phone) {
    const error = new Error("当前浏览器没有可用身份，请先注册或恢复身份。")
    state.voteStatus = STATUS.ERROR
    state.voteMessage = error.message
    throw error
  }

  state.voteStatus = STATUS.LOADING
  state.voteMessage = ""
  state.lastVoteResult = null

  try {
    const proof = await getMerkleProof(state.localIdentity.phone)
    const payload = {
      identityNullifier: state.localIdentity.identityNullifier,
      identityTrapdoor: state.localIdentity.identityTrapdoor,
      treePathElements: proof.pathElements,
      treePathIndices: proof.pathIndices,
      root: proof.root,
      externalNullifier,
      vote,
    }

    const result = await submitVoteRequest(payload)
    state.lastVoteResult = result
    state.voteStatus = STATUS.SUCCESS
    state.voteMessage = "证明已生成并记录成功。"
    await Promise.all([refreshActivities(), refreshRootInfo()])
    return result
  } catch (error) {
    state.voteStatus = STATUS.ERROR
    state.voteMessage = error.message || "投票失败"
    throw error
  }
}

async function fetchActivityStats(externalNullifier) {
  return getActivityStats(externalNullifier)
}

export function useVoting() {
  const hasIdentity = computed(() => Boolean(state.localIdentity?.phone))

  return {
    state,
    hasIdentity,
    loadDashboard,
    refreshActivities,
    refreshRootInfo,
    registerWithPhone,
    restoreIdentityFromStorage,
    clearIdentity,
    publishNewActivity,
    submitVote,
    fetchActivityStats,
    setRegisterError,
    setPublishError,
  }
}
