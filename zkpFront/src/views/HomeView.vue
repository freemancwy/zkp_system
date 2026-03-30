<template>
  <div class="page-stack">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">零知识投票系统</p>
        <h2>围绕匿名投票、链上验证与隐私保护构建的完整演示平台</h2>
        <p>
          系统整合了匿名身份、Merkle Tree、ZK-SNARK 证明、Solidity 合约验证和
          DApp 前端交互，可展示从活动发布、证明生成到链上提交的完整流程。
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
        <p>查看活动状态、生成零知识证明，并选择后端代发或钱包直连上链。</p>
      </router-link>

      <router-link class="entry-card" to="/admin">
        <p class="eyebrow">面向管理员</p>
        <h3>进入管理页</h3>
        <p>配置活动时间窗口、投票人数上限、创建者信息和活动元数据。</p>
      </router-link>

      <router-link class="entry-card" to="/contract">
        <p class="eyebrow">面向演示与论文</p>
        <h3>查看合约状态</h3>
        <p>集中展示网络、合约地址、验证器、累计投票数和区块浏览器入口。</p>
      </router-link>
    </section>

    <ChainStatusCard :chain="voting.state.chainInfo" />

    <ActivityList
      title="已发布活动"
      eyebrow="活动列表"
      description="展示活动编号、名称、描述、投票时间、人数上限、当前状态和创建者信息。"
      :activities="voting.state.activities"
      empty-text="当前还没有已发布的活动。"
    />
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue"
import ActivityList from "../components/ActivityList.vue"
import ChainStatusCard from "../components/ChainStatusCard.vue"
import { useVoting } from "../composables/useVoting"

const voting = useVoting()

const rootLabel = computed(() => {
  const root = voting.state.rootInfo.root
  if (!root) return "尚未生成"
  return root.length > 18 ? `${root.slice(0, 10)}...${root.slice(-8)}` : root
})

onMounted(() => {
  voting.loadDashboard().catch(() => {})
})
</script>
