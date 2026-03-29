<template>
  <div class="page-stack">
    <section class="section-heading">
      <div>
        <p class="eyebrow">Activity Report</p>
        <h2>Activity Statistics</h2>
      </div>
      <div class="button-row">
        <router-link class="ghost-button" to="/vote">Back to Vote</router-link>
        <router-link class="ghost-button" to="/admin">Back to Admin</router-link>
      </div>
    </section>

    <div v-if="loading" class="panel empty-state">Loading activity statistics...</div>
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
    errorMessage.value = error.message || "Failed to load statistics"
  } finally {
    loading.value = false
  }
}

watch(() => props.externalNullifier, loadStats, { immediate: true })
</script>
