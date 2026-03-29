<template>
  <div class="page-stack">
    <section class="section-heading">
      <div>
        <p class="eyebrow">Activity Report</p>
        <h2>活动统计面板</h2>
      </div>
      <div class="button-row">
        <router-link class="ghost-button" to="/vote">返回投票页</router-link>
        <router-link class="ghost-button" to="/admin">返回管理员页</router-link>
      </div>
    </section>

    <div v-if="loading" class="panel empty-state">正在加载活动统计...</div>
    <div v-else-if="errorMessage" class="panel empty-state">{{ errorMessage }}</div>
    <StatsCard v-else :stats="stats" />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue"
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
    errorMessage.value = error.message || "统计加载失败"
  } finally {
    loading.value = false
  }
}

watch(() => props.externalNullifier, loadStats)

onMounted(() => {
  loadStats()
})
</script>
