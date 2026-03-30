<template>
  <div class="page-stack">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">零知识投票系统</p>
        <h2>在一个控制台中完成匿名投票、Merkle Root 展示与活动管理</h2>
        <p>
          前端同时支持投票用户与管理员两类流程。用户可以恢复本地匿名身份并参与投票，
          管理员可以发布带有编号、名称和描述的投票活动。
        </p>
      </div>

      <div class="hero-metrics">
        <article class="metric-card">
          <span>Merkle Root</span>
          <code>{{ rootLabel }}</code>
        </article>
        <article class="metric-card">
          <span>树深度</span>
          <strong>{{ voting.state.rootInfo.depth }}</strong>
        </article>
        <article class="metric-card">
          <span>已注册身份数</span>
          <strong>{{ voting.state.rootInfo.leafCount }}</strong>
        </article>
      </div>
    </section>

    <section class="entry-grid">
      <router-link class="entry-card" to="/vote">
        <p class="eyebrow">面向投票用户</p>
        <h3>进入投票页</h3>
        <p>选择活动、查看描述，并提交一次匿名投票。</p>
      </router-link>
      <router-link class="entry-card" to="/admin">
        <p class="eyebrow">面向管理员</p>
        <h3>进入管理页</h3>
        <p>发布新的投票活动，并维护 `externalNullifier`、名称和描述信息。</p>
      </router-link>
    </section>

    <ActivityList
      title="已发布活动"
      eyebrow="活动列表"
      description="这里展示的活动直接来自 external_nullifiers.json。"
      :activities="voting.state.activities"
      empty-text="当前还没有已发布的活动。"
    />
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue"
import ActivityList from "../components/ActivityList.vue"
import { useVoting } from "../composables/useVoting"

const voting = useVoting()

const rootLabel = computed(() => {
  const root = voting.state.rootInfo.root
  if (!root) {
    return "尚未生成"
  }

  return root.length > 18 ? `${root.slice(0, 10)}...${root.slice(-8)}` : root
})

onMounted(() => {
  voting.loadDashboard().catch(() => {})
})
</script>
