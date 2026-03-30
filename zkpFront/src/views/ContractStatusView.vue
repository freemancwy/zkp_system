<template>
  <div class="page-stack">
    <section class="section-heading">
      <div>
        <p class="eyebrow">合约状态</p>
        <h2>链上验证合约信息</h2>
      </div>
      <router-link class="ghost-button" to="/">返回首页</router-link>
    </section>

    <ChainStatusCard :chain="voting.state.chainInfo" />

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">合约详情</p>
          <h2>当前部署摘要</h2>
        </div>
      </div>

      <div v-if="voting.state.chainInfo" class="detail-grid">
        <article class="detail-card">
          <span>网络名称</span>
          <strong>{{ voting.state.chainInfo.network || "未知网络" }}</strong>
        </article>
        <article class="detail-card">
          <span>链 ID</span>
          <strong>{{ voting.state.chainInfo.chainId || "未提供" }}</strong>
        </article>
        <article class="detail-card">
          <span>累计链上投票</span>
          <strong>{{ voting.state.chainInfo.totalVotes }}</strong>
        </article>
        <article class="detail-card">
          <span>浏览器链接</span>
          <a
            v-if="voting.state.chainInfo.explorerBaseUrl"
            :href="voting.state.chainInfo.explorerBaseUrl"
            target="_blank"
            rel="noreferrer"
          >
            打开区块浏览器
          </a>
          <span v-else>当前网络未配置区块浏览器</span>
        </article>
      </div>

      <div v-else class="empty-state">
        暂未获取到链上状态，请确认本地链、合约与后端服务已启动。
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from "vue"
import ChainStatusCard from "../components/ChainStatusCard.vue"
import { useVoting } from "../composables/useVoting"

const voting = useVoting()

onMounted(() => {
  voting.loadDashboard().catch(() => {})
})
</script>
