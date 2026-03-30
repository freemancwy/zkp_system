import { createRouter, createWebHistory } from "vue-router"
import HomeView from "../views/HomeView.vue"
import VoteView from "../views/VoteView.vue"
import AdminView from "../views/AdminView.vue"
import ActivityStatsView from "../views/ActivityStatsView.vue"
import ContractStatusView from "../views/ContractStatusView.vue"

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView },
    { path: "/vote", component: VoteView },
    { path: "/admin", component: AdminView },
    {
      path: "/activity/:externalNullifier",
      component: ActivityStatsView,
      props: true,
    },
    { path: "/contract", component: ContractStatusView },
  ],
})

export default router
