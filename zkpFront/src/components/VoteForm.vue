<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">匿名投票</p>
        <h2>提交匿名投票</h2>
      </div>
      <span class="status-badge" :data-status="voteStatus">{{ statusText }}</span>
    </div>

    <p class="panel-copy">
      当前支持两种模式：后端代发链上交易，或连接钱包后由前端直接调用合约。
    </p>

    <div v-if="!hasIdentity" class="empty-state">
      当前浏览器中没有可用的本地身份，请先注册或恢复身份。
    </div>

    <div v-else-if="!activities.length" class="empty-state">
      当前还没有可投票的活动，请先在管理页发布活动。
    </div>

    <form v-else class="stack-form" @submit.prevent="handleSubmit">
      <label class="field">
        <span>选择活动</span>
        <select v-model="selectedActivity">
          <option disabled value="">请选择活动</option>
          <option
            v-for="activity in activities"
            :key="activity.externalNullifier"
            :value="activity.externalNullifier"
          >
            {{ activity.name || activity.externalNullifier }}
          </option>
        </select>
      </label>

      <div v-if="selectedActivityMeta" class="panel-copy">
        <strong>{{ selectedActivityMeta.name || selectedActivityMeta.externalNullifier }}</strong>
        <span v-if="selectedActivityMeta.descrption">：{{ selectedActivityMeta.descrption }}</span>
        <span>，状态：{{ formatStatus(selectedActivityMeta.status) }}</span>
      </div>

      <label class="field">
        <span>提交模式</span>
        <select v-model="submitMode">
          <option value="server">后端代发交易</option>
          <option value="wallet">钱包直连合约</option>
        </select>
      </label>

      <div class="vote-grid">
        <button
          v-for="option in voteOptions"
          :key="option.value"
          class="vote-choice"
          type="button"
          :data-active="selectedVote === option.value"
          @click="selectedVote = option.value"
        >
          <strong>{{ option.label }}</strong>
          <span>{{ option.description }}</span>
        </button>
      </div>

      <div class="button-row">
        <button
          class="primary-button"
          type="submit"
          :disabled="voteStatus === STATUS.LOADING || !selectedActivity || !selectedVote"
        >
          {{ submitMode === "wallet" ? "使用钱包提交投票" : "生成证明并投票" }}
        </button>
        <router-link
          v-if="selectedActivity"
          class="ghost-button"
          :to="`/activity/${encodeURIComponent(selectedActivity)}`"
        >
          查看活动统计
        </router-link>
      </div>
    </form>

    <p v-if="submitMode === 'wallet'" class="hint-text">
      钱包模式下，会先在后端生成证明，再由浏览器钱包直接向链上合约发送交易。
    </p>
    <p v-if="message" class="hint-text">{{ message }}</p>

    <div v-if="result" class="result-card">
      <div class="result-header">
        <div>
          <p class="eyebrow">证明结果</p>
          <h3>投票已提交</h3>
        </div>
        <router-link
          class="ghost-button"
          :to="`/activity/${encodeURIComponent(result.voteRecord.externalNullifier)}`"
        >
          打开统计页
        </router-link>
      </div>

      <div class="result-grid">
        <div>
          <span>活动编号</span>
          <code>{{ result.voteRecord.externalNullifier }}</code>
        </div>
        <div>
          <span>Nullifier Hash</span>
          <code>{{ shorten(result.nullifierHash) }}</code>
        </div>
        <div>
          <span>Signal Hash</span>
          <code>{{ shorten(result.signalHash) }}</code>
        </div>
        <div>
          <span>Merkle Root</span>
          <code>{{ shorten(result.merkleRoot) }}</code>
        </div>
      </div>

      <div v-if="result.metrics" class="result-grid">
        <div>
          <span>证明耗时</span>
          <code>{{ result.metrics.proofDurationMs }} ms</code>
        </div>
        <div v-if="result.metrics.chainDurationMs != null">
          <span>链上耗时</span>
          <code>{{ result.metrics.chainDurationMs }} ms</code>
        </div>
      </div>

      <div v-if="result.onChain" class="result-grid">
        <div>
          <span>链上交易哈希</span>
          <code>{{ shorten(result.onChain.txHash) }}</code>
        </div>
        <div>
          <span>区块高度</span>
          <code>{{ result.onChain.blockNumber }}</code>
        </div>
      </div>

      <div v-if="result.onChain" class="button-row">
        <a
          v-if="transactionUrl"
          class="ghost-button"
          :href="transactionUrl"
          target="_blank"
          rel="noreferrer"
        >
          在区块浏览器查看交易
        </a>
        <router-link v-else class="ghost-button" to="/contract">
          查看合约状态页
        </router-link>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue"
import { STATUS, VOTE_OPTIONS } from "../constants/app"

const props = defineProps({
  activities: { type: Array, default: () => [] },
  chainInfo: { type: Object, default: null },
  hasIdentity: { type: Boolean, default: false },
  voteStatus: { type: String, default: STATUS.IDLE },
  message: { type: String, default: "" },
  result: { type: Object, default: null },
  initialActivity: { type: String, default: "" },
})

const emit = defineEmits(["submit"])

const voteOptions = VOTE_OPTIONS
const selectedActivity = ref(props.initialActivity)
const selectedVote = ref("1")
const submitMode = ref("server")

const selectedActivityMeta = computed(
  () =>
    props.activities.find(
      (activity) => activity.externalNullifier === selectedActivity.value
    ) ?? null
)

const transactionUrl = computed(() => {
  if (!props.result?.onChain?.txHash) return null
  if (props.result.onChain.txUrl) return props.result.onChain.txUrl
  const base = props.chainInfo?.explorerBaseUrl
  return base ? `${base}/tx/${props.result.onChain.txHash}` : null
})

watch(
  () => props.initialActivity,
  (value) => {
    if (value) {
      selectedActivity.value = value
    }
  },
  { immediate: true }
)

const statusText = computed(() => {
  switch (props.voteStatus) {
    case STATUS.LOADING:
      return "处理中"
    case STATUS.SUCCESS:
      return "成功"
    case STATUS.ERROR:
      return "异常"
    default:
      return "未开始"
  }
})

function handleSubmit() {
  emit("submit", {
    externalNullifier: selectedActivity.value,
    vote: selectedVote.value,
    submitMode: submitMode.value,
  })
}

function formatStatus(status) {
  if (status === "upcoming") return "未开始"
  if (status === "closed") return "已结束"
  if (status === "active") return "进行中"
  return "未知"
}

function shorten(value = "") {
  if (value.length <= 18) return value
  return `${value.slice(0, 10)}...${value.slice(-8)}`
}
</script>
