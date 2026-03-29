<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Anonymous Ballot</p>
        <h2>提交匿名投票</h2>
      </div>
      <span class="status-badge" :data-status="voteStatus">{{ statusText }}</span>
    </div>

    <p class="panel-copy">
      页面会自动读取本地保存的匿名身份，并在提交时向后端申请 Merkle Proof，再生成证明完成投票。
    </p>

    <div v-if="!hasIdentity" class="empty-state">
      当前浏览器没有可用身份，请先完成注册或恢复身份。
    </div>

    <div v-else-if="!activities.length" class="empty-state">
      暂无已发布活动，请先前往管理员页发布活动。
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
            {{ activity.externalNullifier }}
          </option>
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
          {{ voteStatus === STATUS.LOADING ? "证明生成中..." : "生成证明并投票" }}
        </button>
        <router-link
          v-if="selectedActivity"
          class="ghost-button"
          :to="`/activity/${encodeURIComponent(selectedActivity)}`"
        >
          查看该活动统计
        </router-link>
      </div>
    </form>

    <p v-if="message" class="hint-text">{{ message }}</p>

    <div v-if="result" class="result-card">
      <div class="result-header">
        <div>
          <p class="eyebrow">Proof Result</p>
          <h3>证明已生成</h3>
        </div>
        <router-link
          class="ghost-button"
          :to="`/activity/${encodeURIComponent(result.voteRecord.externalNullifier)}`"
        >
          跳转统计页
        </router-link>
      </div>

      <div class="result-grid">
        <div>
          <span>活动</span>
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

      <button class="ghost-button" type="button" disabled>
        提交到合约（Coming Soon）
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue"
import { STATUS, VOTE_OPTIONS } from "../constants/app"

const props = defineProps({
  activities: { type: Array, default: () => [] },
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
      return "已完成"
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
  })
}

function shorten(value = "") {
  if (value.length <= 16) {
    return value
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`
}
</script>
