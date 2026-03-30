<template>
  <div class="page-stack">
    <section class="section-heading">
      <div>
        <p class="eyebrow">活动报告</p>
        <h2>活动统计</h2>
      </div>
      <div class="button-row">
        <router-link class="ghost-button" to="/vote">返回投票页</router-link>
        <router-link class="ghost-button" to="/admin">返回管理页</router-link>
      </div>
    </section>

    <div v-if="loading" class="panel empty-state">正在加载活动统计...</div>
    <div v-else-if="errorMessage" class="panel empty-state">{{ errorMessage }}</div>
    <StatsCard v-else :stats="stats" />
  </div>
</template>

<script setup>
import { ref, watch } from "vue"
import StatsCard from "../components/StatsCard.vue"
import { useVoting } from "../composables/useVoting"

const props = defineProps({
  externalNullifier: {
    type: String,
    required: true,
  },
})

const voting = useVoting()
const stats = ref(null)
const loading = ref(false)
const errorMessage = ref("")

async function loadStats() {
  loading.value = true
  errorMessage.value = ""

  try {
    stats.value = await voting.fetchActivityStats(props.externalNullifier)
  } catch (error) {
    errorMessage.value = error.message || "加载统计信息失败"
  } finally {
    loading.value = false
  }
}

watch(() => props.externalNullifier, loadStats, { immediate: true })
</script>
