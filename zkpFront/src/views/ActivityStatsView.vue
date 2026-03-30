<template>
  <div class="page-stack">
    <section class="section-heading">
      <div>
        <p class="eyebrow">活动报告</p>
        <h2>活动统计与链上记录</h2>
      </div>
      <div class="button-row">
        <router-link class="ghost-button" to="/vote">返回投票页</router-link>
        <router-link class="ghost-button" to="/contract">查看合约状态</router-link>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">筛选条件</p>
          <h2>投票记录查询</h2>
        </div>
      </div>

      <div class="form-grid compact">
        <label class="field">
          <span>投票筛选</span>
          <select v-model="filters.vote">
            <option
              v-for="item in VOTE_FILTER_OPTIONS"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>每页条数</span>
          <select v-model.number="filters.pageSize">
            <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">
              {{ size }} 条
            </option>
          </select>
        </label>
      </div>
    </section>

    <div v-if="loading" class="panel empty-state">正在加载活动统计...</div>
    <div v-else-if="errorMessage" class="panel empty-state">{{ errorMessage }}</div>
    <template v-else-if="stats">
      <StatsCard :stats="stats" />

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">分页控制</p>
            <h2>翻页查看记录</h2>
          </div>
          <span class="activity-meta">
            共 {{ stats.pagination?.total ?? 0 }} 条
          </span>
        </div>

        <div class="button-row">
          <button
            type="button"
            class="ghost-button"
            :disabled="!stats.pagination?.hasPrev || loading"
            @click="changePage((stats.pagination?.page ?? 1) - 1)"
          >
            上一页
          </button>
          <button
            type="button"
            class="ghost-button"
            :disabled="!stats.pagination?.hasNext || loading"
            @click="changePage((stats.pagination?.page ?? 1) + 1)"
          >
            下一页
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from "vue"
import StatsCard from "../components/StatsCard.vue"
import { PAGE_SIZE_OPTIONS, VOTE_FILTER_OPTIONS } from "../constants/app"
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
const filters = reactive({
  vote: "all",
  page: 1,
  pageSize: PAGE_SIZE_OPTIONS[1],
})

async function loadStats() {
  loading.value = true
  errorMessage.value = ""

  try {
    stats.value = await voting.fetchActivityStats(props.externalNullifier, filters)
  } catch (error) {
    errorMessage.value = error.message || "加载统计信息失败"
  } finally {
    loading.value = false
  }
}

function changePage(nextPage) {
  filters.page = Math.max(1, nextPage)
}

watch(
  () => props.externalNullifier,
  () => {
    filters.page = 1
    loadStats()
  },
  { immediate: true }
)

watch(
  () => [filters.vote, filters.pageSize],
  () => {
    filters.page = 1
    loadStats()
  }
)

watch(
  () => filters.page,
  () => {
    loadStats()
  }
)
</script>
