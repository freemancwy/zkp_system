<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">身份准备</p>
        <h2>匿名身份准备</h2>
      </div>
      <span class="status-badge" :data-status="registerStatus">{{ statusText }}</span>
    </div>

    <p class="panel-copy">
      使用手机号注册后，系统会将匿名身份保存到当前浏览器。本演示暂不支持跨设备恢复。
    </p>

    <form class="stack-form" @submit.prevent="handleRegister">
      <label class="field">
        <span>手机号</span>
        <input
          v-model.trim="phone"
          type="tel"
          placeholder="例如：13800138000"
          autocomplete="tel"
        />
      </label>

      <div class="button-row">
        <button class="primary-button" type="submit" :disabled="isLoading">
          {{ isLoading ? "注册中..." : "注册匿名身份" }}
        </button>
        <button class="ghost-button" type="button" @click="handleRestore">
          恢复本地身份
        </button>
      </div>
    </form>

    <p v-if="message" class="hint-text">{{ message }}</p>

    <div v-if="identity" class="identity-card">
      <div class="identity-row">
        <span>手机号</span>
        <code>{{ identity.phone }}</code>
      </div>
      <div class="identity-row">
        <span>Commitment</span>
        <code>{{ shorten(identity.commitment) }}</code>
      </div>
      <div class="identity-row">
        <span>Nullifier</span>
        <code>{{ shorten(identity.identityNullifier) }}</code>
      </div>
      <button class="ghost-button danger" type="button" @click="$emit('clear-identity')">
        清除本地身份
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue"
import { STATUS } from "../constants/app"

const props = defineProps({
  identity: { type: Object, default: null },
  registerStatus: { type: String, default: STATUS.IDLE },
  message: { type: String, default: "" },
})

const emit = defineEmits(["register", "restore", "clear-identity"])

const phone = ref(props.identity?.phone ?? "")

watch(
  () => props.identity?.phone,
  (value) => {
    if (value) {
      phone.value = value
    }
  }
)

const isLoading = computed(() => props.registerStatus === STATUS.LOADING)

const statusText = computed(() => {
  switch (props.registerStatus) {
    case STATUS.LOADING:
      return "处理中"
    case STATUS.SUCCESS:
      return "已就绪"
    case STATUS.ERROR:
      return "异常"
    default:
      return "未开始"
  }
})

function handleRegister() {
  emit("register", phone.value)
}

function handleRestore() {
  emit("restore", phone.value)
}

function shorten(value = "") {
  if (value.length <= 16) {
    return value
  }

  return `${value.slice(0, 8)}...${value.slice(-8)}`
}
</script>
