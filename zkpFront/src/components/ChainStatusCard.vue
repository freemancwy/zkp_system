<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">链上状态</p>
        <h2>本地验证网络</h2>
      </div>
      <span class="metric-chip">{{ chain?.network || "未知网络" }}</span>
    </div>

    <div v-if="chain" class="stats-grid">
      <article class="stat-box">
        <span>投票合约地址</span>
        <code>{{ shorten(chain.contractAddress) }}</code>
      </article>
      <article class="stat-box">
        <span>验证器地址</span>
        <code>{{ shorten(chain.verifierAddress) }}</code>
      </article>
      <article class="stat-box">
        <span>链上累计投票</span>
        <strong>{{ chain.totalVotes }}</strong>
      </article>
    </div>

    <div v-if="chain" class="panel-subsection">
      <p class="activity-meta">链 ID：{{ chain.chainId || "未提供" }}</p>
      <p class="activity-meta">部署时间：{{ formatDate(chain.deployedAt) }}</p>
      <p class="activity-meta">RPC 地址：{{ chain.rpcUrl }}</p>
      <p class="activity-meta">
        浏览器：
        <a
          v-if="chain.explorerBaseUrl"
          :href="chain.explorerBaseUrl"
          target="_blank"
          rel="noreferrer"
        >
          {{ chain.explorerBaseUrl }}
        </a>
        <span v-else>当前网络未配置区块浏览器</span>
      </p>
      <router-link class="ghost-button" to="/contract">查看合约状态页</router-link>
    </div>

    <div v-else class="empty-state">
      暂未获取到链上状态，请确认本地链和合约已经启动。
    </div>
  </section>
</template>

<script setup>
defineProps({
  chain: { type: Object, default: null },
})

function shorten(value = "") {
  if (!value) return "未知"
  if (value.length <= 18) return value
  return `${value.slice(0, 10)}...${value.slice(-8)}`
}

function formatDate(value) {
  if (!value) return "未知"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", { hour12: false })
}
</script>
