<template>
  <div class="page-stack">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">Zero-Knowledge Voting MVP</p>
        <h2>匿名投票、Merkle Root 与活动管理汇总在一个控制台里</h2>
        <p>
          这个前端面向双角色演示：普通用户可以准备匿名身份并参与投票，管理员可以发布活动并查看统计。
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
          <span>已注册身份</span>
          <strong>{{ voting.state.rootInfo.leafCount }}</strong>
        </article>
      </div>
    </section>

    <section class="entry-grid">
      <router-link class="entry-card" to="/vote">
        <p class="eyebrow">For Voters</p>
        <h3>进入用户投票页</h3>
        <p>完成手机号注册、恢复本地匿名身份、选择活动并生成证明。</p>
      </router-link>
      <router-link class="entry-card" to="/admin">
        <p class="eyebrow">For Admin</p>
        <h3>进入管理员页</h3>
        <p>发布活动标识、查看已发布活动，并进入活动统计页。</p>
      </router-link>
    </section>

    <ActivityList
      title="已发布活动"
      eyebrow="Active Polls"
      description="这里展示当前系统中可以被用户投票的活动。"
      :activities="voting.state.activities"
      empty-text="管理员还没有发布活动。"
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
