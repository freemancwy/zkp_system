import { computed, reactive } from "vue"
import { BrowserProvider, Contract } from "ethers"
import { getChainStatus } from "../services/api"

const VOTING_ABI = [
  "function submitVote(uint256[2] pA,uint256[2][2] pB,uint256[2] pC,uint256[2] pubSignals) returns (bool)",
  "function totalVotes() view returns (uint256)",
]

const walletState = reactive({
  available: typeof window !== "undefined" && Boolean(window.ethereum),
  connected: false,
  address: "",
  chainId: "",
  status: "idle",
  message: "",
})

async function readWalletState() {
  if (typeof window === "undefined" || !window.ethereum) {
    walletState.available = false
    walletState.connected = false
    walletState.address = ""
    walletState.chainId = ""
    return
  }

  walletState.available = true
  const [address] = await window.ethereum.request({ method: "eth_accounts" })
  const chainId = await window.ethereum.request({ method: "eth_chainId" })

  walletState.connected = Boolean(address)
  walletState.address = address ?? ""
  walletState.chainId = chainId ?? ""
}

async function connectWallet() {
  if (typeof window === "undefined" || !window.ethereum) {
    walletState.status = "error"
    walletState.message = "当前浏览器未检测到钱包扩展。"
    return null
  }

  walletState.status = "loading"
  walletState.message = ""

  try {
    const [address] = await window.ethereum.request({
      method: "eth_requestAccounts",
    })
    const chainId = await window.ethereum.request({ method: "eth_chainId" })

    walletState.available = true
    walletState.connected = Boolean(address)
    walletState.address = address ?? ""
    walletState.chainId = chainId ?? ""
    walletState.status = "success"
    walletState.message = "钱包连接成功。"
    return walletState.address
  } catch (error) {
    walletState.status = "error"
    walletState.message = error.message || "钱包连接失败"
    throw error
  }
}

async function submitVoteWithWallet(contractArgs) {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("未检测到钱包扩展")
  }

  const chainData = await getChainStatus()
  const provider = new BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  const contract = new Contract(
    chainData.chain.contractAddress,
    VOTING_ABI,
    signer
  )

  const tx = await contract.submitVote(
    contractArgs.pA,
    contractArgs.pB,
    contractArgs.pC,
    contractArgs.pubSignals
  )
  const receipt = await tx.wait()
  const explorerBaseUrl = chainData.chain.explorerBaseUrl

  return {
    txHash: receipt.hash,
    txUrl: explorerBaseUrl ? `${explorerBaseUrl}/tx/${receipt.hash}` : null,
    blockNumber: receipt.blockNumber,
    contractAddress: chainData.chain.contractAddress,
    network: chainData.chain.network,
  }
}

export function useWallet() {
  const shortAddress = computed(() => {
    if (!walletState.address) return ""
    return `${walletState.address.slice(0, 6)}...${walletState.address.slice(-4)}`
  })

  return {
    walletState,
    shortAddress,
    connectWallet,
    readWalletState,
    submitVoteWithWallet,
  }
}
