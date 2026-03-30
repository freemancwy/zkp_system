<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">管理员控制台</p>
        <h2>发布投票活动</h2>
      </div>
      <span class="status-badge" :data-status="publishStatus">{{ statusText }}</span>
    </div>

    <p class="panel-copy">
      请按 `external_nullifiers.json` 的结构完善活动信息，包括编号、名称、描述、时间窗口、人数上限和创建者。
    </p>

    <form class="stack-form" @submit.prevent="handleSubmit">
      <label class="field">
        <span>活动编号</span>
        <input v-model.trim="form.externalNullifier" type="text" placeholder="campus-budget-2026" />
      </label>

      <label class="field">
        <span>活动名称</span>
        <input v-model.trim="form.name" type="text" placeholder="校园预算投票" />
      </label>

      <label class="field">
        <span>活动描述</span>
        <textarea
          v-model.trim="form.descrption"
          rows="3"
          placeholder="请填写本次投票活动的说明"
        />
      </label>

      <label class="field">
        <span>开始时间</span>
        <input v-model="form.startAt" type="datetime-local" />
      </label>

      <label class="field">
        <span>结束时间</span>
        <input v-model="form.endAt" type="datetime-local" />
      </label>

      <label class="field">
        <span>人数上限</span>
        <input v-model.trim="form.maxVoters" type="number" min="1" placeholder="例如：100" />
      </label>

      <label class="field">
        <span>创建者/管理员</span>
        <input v-model.trim="form.createdBy" type="text" placeholder="例如：系统管理员" />
      </label>

      <button class="primary-button" type="submit" :disabled="publishStatus === STATUS.LOADING">
        {{ publishStatus === STATUS.LOADING ? "发布中..." : "发布活动" }}
      </button>
    </form>

    <p v-if="message" class="hint-text">{{ message }}</p>
  </section>
</template>

<script setup>
import { computed, reactive } from "vue"
import { STATUS } from "../constants/app"

const props = defineProps({
  publishStatus: { type: String, default: STATUS.IDLE },
  message: { type: String, default: "" },
})

const emit = defineEmits(["publish"])

const form = reactive({
  externalNullifier: "",
  name: "",
  descrption: "",
  startAt: "",
  endAt: "",
  maxVoters: "",
  createdBy: "",
})

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

function toIsoLike(value) {
  return value ? new Date(value).toISOString() : null
}

function handleSubmit() {
  emit("publish", {
    externalNullifier: form.externalNullifier,
    name: form.name,
    descrption: form.descrption,
    startAt: toIsoLike(form.startAt),
    endAt: toIsoLike(form.endAt),
    maxVoters: form.maxVoters,
    createdBy: form.createdBy,
  })

  if (form.externalNullifier) {
    form.externalNullifier = ""
    form.name = ""
    form.descrption = ""
    form.startAt = ""
    form.endAt = ""
    form.maxVoters = ""
    form.createdBy = ""
  }
}
</script>
