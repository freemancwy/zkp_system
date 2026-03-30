<template>
  <div class="button-row">
    <span class="metric-chip">
      {{ walletState.connected ? `钱包：${shortAddress}` : "钱包未连接" }}
    </span>
    <span v-if="walletState.chainId" class="metric-chip">链 ID：{{ walletState.chainId }}</span>
    <button
      class="ghost-button"
      type="button"
      :disabled="walletState.status === 'loading'"
      @click="connectWallet()"
    >
      {{ walletState.connected ? "重新连接钱包" : "连接钱包" }}
    </button>
  </div>
</template>

<script setup>
import { useWallet } from "../composables/useWallet"

const { walletState, shortAddress, connectWallet } = useWallet()
</script>
