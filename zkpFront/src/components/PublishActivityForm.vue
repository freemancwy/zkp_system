<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Admin Console</p>
        <h2>发布投票活动</h2>
      </div>
      <span class="status-badge" :data-status="publishStatus">{{ statusText }}</span>
    </div>

    <p class="panel-copy">
      演示环境下管理员页默认公开访问。这里发布的 `externalNullifier` 会作为一次投票活动的唯一标识。
    </p>

    <form class="stack-form" @submit.prevent="handleSubmit">
      <label class="field">
        <span>活动标识</span>
        <input
          v-model.trim="value"
          type="text"
          placeholder="例如：campus-budget-2026"
        />
      </label>

      <button class="primary-button" type="submit" :disabled="publishStatus === STATUS.LOADING">
        {{ publishStatus === STATUS.LOADING ? "发布中..." : "发布活动" }}
      </button>
    </form>

    <p v-if="message" class="hint-text">{{ message }}</p>
  </section>
</template>

<script setup>
import { computed, ref } from "vue"
import { STATUS } from "../constants/app"

const props = defineProps({
  publishStatus: { type: String, default: STATUS.IDLE },
  message: { type: String, default: "" },
})

const emit = defineEmits(["publish"])

const value = ref("")

const statusText = computed(() => {
  switch (props.publishStatus) {
    case STATUS.LOADING:
      return "处理中"
    case STATUS.SUCCESS:
      return "已发布"
    case STATUS.ERROR:
      return "异常"
    default:
      return "未开始"
  }
})

function handleSubmit() {
  const next = value.value
  emit("publish", next)
  if (next) {
    value.value = ""
  }
}
</script>
