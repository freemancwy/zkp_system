<template>
  <div class="app-shell">
    <header class="topbar">
      <router-link class="brand" to="/">
        <span class="brand-mark">ZKP</span>
        <div>
          <p class="eyebrow">可信投票控制台</p>
          <h1>匿名投票演示系统</h1>
        </div>
      </router-link>

      <div class="topnav-wrap">
        <nav class="topnav" aria-label="主导航">
          <router-link
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav-link"
          >
            {{ item.label }}
          </router-link>
        </nav>
        <WalletStatusBadge />
      </div>
    </header>

    <main class="page-body">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from "vue"
import { NAV_ITEMS } from "../constants/app"
import WalletStatusBadge from "./WalletStatusBadge.vue"
import { useWallet } from "../composables/useWallet"

const navItems = NAV_ITEMS
const { readWalletState } = useWallet()

onMounted(() => {
  readWalletState().catch(() => {})
})
</script>
