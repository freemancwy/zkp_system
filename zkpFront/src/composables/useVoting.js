import { computed, reactive } from "vue"
import {
  getActivities,
  getActivityStats,
  getChainStatus,
  getMerkleProof,
  getRootInfo,
  prepareVote,
  publishActivity,
  recordVote,
  registerPhone,
  submitVote as submitVoteRequest,
} from "../services/api"
import { LOCAL_IDENTITY_KEY, STATUS } from "../constants/app"

function safeStorageGet() {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(LOCAL_IDENTITY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function safeStorageSet(value) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LOCAL_IDENTITY_KEY, JSON.stringify(value))
}

function safeStorageClear() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(LOCAL_IDENTITY_KEY)
}

const state = reactive({
  rootInfo: {
    root: null,
    depth: 0,
    leafCount: 0,
  },
  activities: [],
  chainInfo: null,
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

async function refreshChainInfo() {
  const data = await getChainStatus()
  state.chainInfo = data.chain ?? null
  return state.chainInfo
}

async function loadDashboard() {
  state.globalStatus = STATUS.LOADING

  try {
    await Promise.all([refreshRootInfo(), refreshActivities(), refreshChainInfo()])
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
        "该手机号已经注册。如果当前浏览器中没有保存身份信息，将无法继续投票。"
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
      "当前浏览器中没有保存匿名身份，无法恢复。请使用原浏览器继续，或清理该手机号后重新演示。"
    )
    return null
  }

  if (phone && saved.phone !== phone) {
    setRegisterError("本地保存的手机号与当前输入不一致。")
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
    state.publishMessage = "活动发布成功，用户现在可以参与投票。"
    await refreshActivities()
    await refreshChainInfo()
    return data
  } catch (error) {
    state.publishStatus = STATUS.ERROR
    state.publishMessage = error.message || "活动发布失败"
    throw error
  }
}

async function submitVote({ externalNullifier, vote }) {
  if (!state.localIdentity?.phone) {
    const error = new Error("当前浏览器中没有可用身份，请先注册或恢复身份。")
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
    state.voteMessage = "证明已生成并提交成功。"
    await Promise.all([refreshActivities(), refreshRootInfo(), refreshChainInfo()])
    return result
  } catch (error) {
    state.voteStatus = STATUS.ERROR
    state.voteMessage = error.message || "投票失败"
    throw error
  }
}

async function prepareVoteWithClientWallet({ externalNullifier, vote }) {
  if (!state.localIdentity?.phone) {
    const error = new Error("当前浏览器中没有可用身份，请先注册或恢复身份。")
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

    return await prepareVote(payload)
  } catch (error) {
    state.voteStatus = STATUS.ERROR
    state.voteMessage = error.message || "准备链上投票失败"
    throw error
  }
}

async function confirmClientVote(result) {
  const payload = {
    externalNullifier: result.voteRecord.externalNullifier,
    vote: result.voteRecord.vote,
    nullifierHash: result.nullifierHash,
    signalHash: result.signalHash,
    onChain: result.onChain,
    metrics: result.metrics ?? null,
  }

  const recorded = await recordVote(payload)
  state.lastVoteResult = { ...result, voteRecord: recorded.voteRecord }
  state.voteStatus = STATUS.SUCCESS
  state.voteMessage = "钱包交易已确认，投票记录已同步。"
  await Promise.all([refreshActivities(), refreshRootInfo(), refreshChainInfo()])
  return state.lastVoteResult
}

async function fetchActivityStats(externalNullifier, options = {}) {
  return getActivityStats(externalNullifier, options)
}

export function useVoting() {
  const hasIdentity = computed(() => Boolean(state.localIdentity?.phone))

  return {
    state,
    hasIdentity,
    loadDashboard,
    refreshActivities,
    refreshRootInfo,
    refreshChainInfo,
    registerWithPhone,
    restoreIdentityFromStorage,
    clearIdentity,
    publishNewActivity,
    submitVote,
    prepareVoteWithClientWallet,
    confirmClientVote,
    fetchActivityStats,
    setRegisterError,
    setPublishError,
  }
}
