const express = require("express")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const hre = require("hardhat")
const snarkjs = require("snarkjs")
const { buildPoseidon } = require("circomlibjs")

const app = express()

app.use(cors())
app.use(express.json())

const DATA_DIR = path.join(__dirname, "data")
const TREE_META_FILE = path.join(DATA_DIR, "tree_meta.json")
const LEAVES_FILE = path.join(DATA_DIR, "leaves.json")
const USERS_FILE = path.join(DATA_DIR, "users.json")
const VOTES_FILE = path.join(DATA_DIR, "votes.json")
const EXTERNAL_NULLIFIERS_FILE = path.join(
  DATA_DIR,
  "external_nullifiers.json"
)
const DEPLOYMENTS_FILE = path.join(__dirname, "..", "deployments", "localhost.json")
const VOTING_ARTIFACT_FILE = path.join(
  __dirname,
  "..",
  "hardhat-artifacts",
  "contracts",
  "VotingWithVerifier.sol",
  "VotingWithVerifier.json"
)
const CIRCUIT_TREE_LEVELS = 20
const MAX_LEAF_COUNT = 2 ** CIRCUIT_TREE_LEVELS
const BN128_FIELD_SIZE = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
)
const CHAIN_RPC_URL = process.env.CHAIN_RPC_URL || "http://127.0.0.1:8545"
const CHAIN_EXPLORER_BASE_URL = (
  process.env.CHAIN_EXPLORER_BASE_URL || ""
).replace(/\/+$/, "")
const CHAIN_PRIVATE_KEY =
  process.env.CHAIN_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

ensureDataDir()

const TreeMeta = readJson(TREE_META_FILE, {
  root: null,
  depth: 0,
  leafCount: 0,
})

const LeavesData = readJson(LEAVES_FILE, { leaves: [] })
if (!Array.isArray(LeavesData.leaves)) {
  LeavesData.leaves = []
}

const UsersData = readJson(USERS_FILE, { users: [] })
if (!Array.isArray(UsersData.users)) {
  UsersData.users = []
}

const VotesData = readJson(VOTES_FILE, { votes: [] })
if (!Array.isArray(VotesData.votes)) {
  VotesData.votes = []
}

const ExternalNullifiersData = readJson(EXTERNAL_NULLIFIERS_FILE, {
  externalNullifiers: [],
})
if (!Array.isArray(ExternalNullifiersData.externalNullifiers)) {
  ExternalNullifiersData.externalNullifiers = []
}

ExternalNullifiersData.externalNullifiers = ExternalNullifiersData.externalNullifiers
  .map((item) => {
    if (typeof item === "string") {
      return {
        externalNullifier: item,
        name: "",
        descrption: "",
        startAt: null,
        endAt: null,
        maxVoters: null,
        createdBy: "",
        createdAt: new Date(0).toISOString(),
      }
    }

    if (!item || typeof item !== "object") {
      return null
    }

    const externalNullifier = normalizeExternalNullifier(item.externalNullifier)

    if (!externalNullifier) {
      return null
    }

    return {
      externalNullifier,
      name: normalizeActivityText(item.name),
      descrption: normalizeActivityText(item.descrption ?? item.description),
      startAt: normalizeActivityDate(item.startAt),
      endAt: normalizeActivityDate(item.endAt),
      maxVoters: normalizePositiveInteger(item.maxVoters),
      createdBy: normalizeActivityText(item.createdBy),
      createdAt: item.createdAt ?? new Date(0).toISOString(),
    }
  })
  .filter(Boolean)

const LEAVES = []

let poseidon
let F
let ZERO_VALUES = []

const poseidonReady = (async () => {
  poseidon = await buildPoseidon()
  F = poseidon.F
})()

async function ensureZeroValues() {
  await poseidonReady

  if (ZERO_VALUES.length === CIRCUIT_TREE_LEVELS + 1) {
    return
  }

  ZERO_VALUES = [0n]

  for (let level = 0; level < CIRCUIT_TREE_LEVELS; level += 1) {
    const nextZero = poseidon([ZERO_VALUES[level], ZERO_VALUES[level]])
    ZERO_VALUES.push(F.toObject(nextZero))
  }
}

function normalizePhone(phone) {
  if (typeof phone !== "string") {
    return null
  }

  const normalized = phone.replace(/[\s-]/g, "")

  if (!/^\+?\d{6,20}$/.test(normalized)) {
    return null
  }

  return normalized
}

function normalizeExternalNullifier(externalNullifier) {
  if (typeof externalNullifier !== "string") {
    return null
  }

  const normalized = externalNullifier.trim()
  return normalized || null
}

function normalizeActivityText(value) {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

function normalizeActivityDate(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function normalizePositiveInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function normalizeVote(vote) {
  const normalized = String(vote)

  if (normalized !== "0" && normalized !== "1") {
    return null
  }

  return normalized
}

function randomFieldElement() {
  return BigInt(`0x${crypto.randomBytes(31).toString("hex")}`)
}

function externalNullifierToField(externalNullifier) {
  const hashHex = crypto
    .createHash("sha256")
    .update(externalNullifier, "utf8")
    .digest("hex")

  return (BigInt(`0x${hashHex}`) % BN128_FIELD_SIZE).toString()
}

function saveUsers() {
  writeJson(USERS_FILE, UsersData)
}

function saveVotes() {
  writeJson(VOTES_FILE, VotesData)
}

function saveExternalNullifiers() {
  writeJson(EXTERNAL_NULLIFIERS_FILE, ExternalNullifiersData)
}

function saveLeavesAndMeta() {
  LeavesData.leaves = LEAVES.map((leaf) => leaf.toString())
  TreeMeta.leafCount = LEAVES.length

  writeJson(LEAVES_FILE, LeavesData)
  writeJson(TREE_META_FILE, TreeMeta)
}

function findLeafIndex(commitment) {
  return LEAVES.findIndex((leaf) => leaf.toString() === String(commitment))
}

function findUser(phone) {
  return UsersData.users.find((user) => user.phone === phone) ?? null
}

function pickLegacyRegistration(registrations) {
  if (!Array.isArray(registrations) || registrations.length === 0) {
    return null
  }

  const sorted = [...registrations].sort((a, b) => {
    const aTime = Date.parse(a.createdAt ?? 0)
    const bTime = Date.parse(b.createdAt ?? 0)
    return aTime - bTime
  })

  return sorted[0] ?? null
}

function normalizeUserRecord(user) {
  if (!user || typeof user.phone !== "string") {
    return null
  }

  if (
    typeof user.identityNullifier === "string" &&
    typeof user.identityTrapdoor === "string" &&
    typeof user.commitment === "string"
  ) {
    return {
      phone: user.phone,
      identityNullifier: user.identityNullifier,
      identityTrapdoor: user.identityTrapdoor,
      commitment: user.commitment,
      createdAt: user.createdAt ?? new Date(0).toISOString(),
    }
  }

  const legacyRegistration = pickLegacyRegistration(user.registrations)
  if (!legacyRegistration) {
    return null
  }

  return {
    phone: user.phone,
    identityNullifier: String(legacyRegistration.identityNullifier),
    identityTrapdoor: String(legacyRegistration.identityTrapdoor),
    commitment: String(legacyRegistration.commitment),
    createdAt: legacyRegistration.createdAt ?? new Date(0).toISOString(),
  }
}

function synchronizeUsersAndLeaves() {
  const normalizedUsers = []

  for (const user of UsersData.users) {
    const normalizedUser = normalizeUserRecord(user)
    if (normalizedUser) {
      normalizedUsers.push(normalizedUser)
    }
  }

  normalizedUsers.sort((a, b) => {
    const aTime = Date.parse(a.createdAt ?? 0)
    const bTime = Date.parse(b.createdAt ?? 0)
    return aTime - bTime
  })

  const usersChanged =
    JSON.stringify(UsersData.users) !== JSON.stringify(normalizedUsers)
  UsersData.users = normalizedUsers

  LEAVES.length = 0
  for (const user of normalizedUsers) {
    LEAVES.push(BigInt(user.commitment))
  }

  if (usersChanged) {
    saveUsers()
  }
}

function findVoteRecordByNullifierHash(nullifierHash) {
  return (
    VotesData.votes.find((item) => item.nullifierHash === nullifierHash) ??
    null
  )
}

function readDeployment() {
  if (!fs.existsSync(DEPLOYMENTS_FILE)) {
    throw new Error(
      `Missing deployment file: ${DEPLOYMENTS_FILE}. Run \`npm run hardhat:deploy\` first.`
    )
  }

  const deployment = readJson(DEPLOYMENTS_FILE, {})

  if (!deployment.voting) {
    throw new Error(
      `Voting contract address is missing in ${DEPLOYMENTS_FILE}. Redeploy the contracts first.`
    )
  }

  return deployment
}

function readVotingArtifact() {
  if (!fs.existsSync(VOTING_ARTIFACT_FILE)) {
    throw new Error(
      `Missing contract artifact: ${VOTING_ARTIFACT_FILE}. Run \`npm run hardhat:compile\` first.`
    )
  }

  const artifact = readJson(VOTING_ARTIFACT_FILE, {})

  if (!Array.isArray(artifact.abi)) {
    throw new Error(`Invalid contract artifact: ${VOTING_ARTIFACT_FILE}`)
  }

  return artifact
}

function toContractArgs(proof, publicSignals) {
  return {
    pA: [String(proof.pi_a[0]), String(proof.pi_a[1])],
    pB: [
      [String(proof.pi_b[0][1]), String(proof.pi_b[0][0])],
      [String(proof.pi_b[1][1]), String(proof.pi_b[1][0])],
    ],
    pC: [String(proof.pi_c[0]), String(proof.pi_c[1])],
    pubSignals: [String(publicSignals[0]), String(publicSignals[1])],
  }
}

async function submitVoteOnChain(proof, publicSignals) {
  const deployment = readDeployment()
  const artifact = readVotingArtifact()
  const provider = new hre.ethers.JsonRpcProvider(CHAIN_RPC_URL)
  const wallet = new hre.ethers.Wallet(CHAIN_PRIVATE_KEY, provider)
  const voting = new hre.ethers.Contract(
    deployment.voting,
    artifact.abi,
    wallet
  )
  const contractArgs = toContractArgs(proof, publicSignals)

  const tx = await voting.submitVote(
    contractArgs.pA,
    contractArgs.pB,
    contractArgs.pC,
    contractArgs.pubSignals
  )
  const receipt = await tx.wait()

  return {
    txHash: receipt.hash,
    txUrl: buildTransactionUrl(receipt.hash),
    blockNumber: receipt.blockNumber,
    contractAddress: deployment.voting,
    network: deployment.network ?? "localhost",
  }
}

function hasPublishedExternalNullifier(externalNullifier) {
  return ExternalNullifiersData.externalNullifiers.some(
    (item) => item.externalNullifier === externalNullifier
  )
}

function findPublishedActivity(externalNullifier) {
  return (
    ExternalNullifiersData.externalNullifiers.find(
      (item) => item.externalNullifier === externalNullifier
    ) ?? null
  )
}

function deriveActivityStatus(activity, now = new Date()) {
  if (!activity) {
    return "unknown"
  }

  const nowMs = now.getTime()
  const startMs = activity.startAt ? Date.parse(activity.startAt) : null
  const endMs = activity.endAt ? Date.parse(activity.endAt) : null

  if (startMs && nowMs < startMs) {
    return "upcoming"
  }

  if (endMs && nowMs > endMs) {
    return "closed"
  }

  return "active"
}

function enrichActivity(activity) {
  if (!activity) {
    return null
  }

  const votes = VotesData.votes.filter(
    (item) => item.externalNullifier === activity.externalNullifier
  )

  return {
    ...activity,
    status: deriveActivityStatus(activity),
    currentVoters: votes.length,
    remainingVoters:
      activity.maxVoters == null ? null : Math.max(activity.maxVoters - votes.length, 0),
  }
}

function buildTransactionUrl(txHash) {
  if (!txHash || !CHAIN_EXPLORER_BASE_URL) {
    return null
  }

  return `${CHAIN_EXPLORER_BASE_URL}/tx/${txHash}`
}

async function getChainSnapshot() {
  const deployment = readDeployment()
  const artifact = readVotingArtifact()
  const provider = new hre.ethers.JsonRpcProvider(CHAIN_RPC_URL)
  const voting = new hre.ethers.Contract(deployment.voting, artifact.abi, provider)
  const totalVotes = await voting.totalVotes()

  return {
    network: deployment.network ?? "localhost",
    chainId: deployment.chainId,
    contractAddress: deployment.voting,
    verifierAddress: deployment.verifier ?? null,
    deployedAt: deployment.deployedAt ?? null,
    totalVotes: totalVotes.toString(),
    rpcUrl: CHAIN_RPC_URL,
    explorerBaseUrl: CHAIN_EXPLORER_BASE_URL || null,
  }
}

async function rebuildMerkleTree() {
  await ensureZeroValues()

  let current = [...LEAVES]

  for (let level = 0; level < CIRCUIT_TREE_LEVELS; level += 1) {
    const next = []
    const zero = ZERO_VALUES[level]

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]
      const right = current[i + 1] ?? zero
      const hash = poseidon([left, right])

      next.push(F.toObject(hash))
    }

    if (next.length === 0) {
      next.push(ZERO_VALUES[level + 1])
    }

    current = next
  }

  TreeMeta.root = current[0].toString()
  TreeMeta.depth = CIRCUIT_TREE_LEVELS
  TreeMeta.leafCount = LEAVES.length
  saveLeavesAndMeta()
}

async function createCommitment(identityNullifier, identityTrapdoor) {
  await poseidonReady

  return F.toString(poseidon([identityNullifier, identityTrapdoor]))
}

async function generateMerkleProof(leafIndex) {
  await ensureZeroValues()

  const pathElements = []
  const pathIndices = []
  let current = [...LEAVES]
  let index = leafIndex

  for (let level = 0; level < CIRCUIT_TREE_LEVELS; level += 1) {
    const isRight = index % 2
    const pairIndex = isRight ? index - 1 : index + 1
    const sibling =
      pairIndex < current.length ? current[pairIndex] : ZERO_VALUES[level]

    pathElements.push(sibling.toString())
    pathIndices.push(isRight)

    const next = []
    const zero = ZERO_VALUES[level]

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]
      const right = current[i + 1] ?? zero
      const hash = poseidon([left, right])

      next.push(F.toObject(hash))
    }

    current = next.length > 0 ? next : [ZERO_VALUES[level + 1]]
    index = Math.floor(index / 2)
  }

  return {
    pathElements,
    pathIndices,
  }
}


app.get("/api/root", (req, res) => {
  res.json({
    root: TreeMeta.root,
    depth: TreeMeta.depth,
    leafCount: TreeMeta.leafCount,
    generatedAt: new Date().toISOString(),
  })
})

app.get("/api/chain-status", async (req, res) => {
  try {
    const chain = await getChainSnapshot()

    res.json({
      success: true,
      chain,
    })
  } catch (error) {
    res.status(503).json({
      success: false,
      error: `鑾峰彇閾句笂鐘舵€佸け璐? ${error.message}`,
    })
  }
})

app.post("/api/external-nullifier/publish", (req, res) => {
  const externalNullifier = normalizeExternalNullifier(
    req.body.externalNullifier
  )
  const name = normalizeActivityText(req.body.name)
  const descrption = normalizeActivityText(req.body.descrption)
  const startAt = normalizeActivityDate(req.body.startAt)
  const endAt = normalizeActivityDate(req.body.endAt)
  const maxVoters = normalizePositiveInteger(req.body.maxVoters)
  const createdBy = normalizeActivityText(req.body.createdBy)

  if (!externalNullifier) {
    return res.status(400).json({
      success: false,
      error: "缂哄皯娲诲姩鏍囪瘑",
    })
  }

  if (hasPublishedExternalNullifier(externalNullifier)) {
    return res.status(409).json({
      success: false,
      error: "???????",
      externalNullifier,
    })
  }

  if (startAt && endAt && Date.parse(startAt) >= Date.parse(endAt)) {
    return res.status(400).json({
      success: false,
      error: "??????????????",
    })
  }

  const activity = {
    externalNullifier,
    name,
    descrption,
    startAt,
    endAt,
    maxVoters,
    createdBy,
    createdAt: new Date().toISOString(),
  }
  ExternalNullifiersData.externalNullifiers.push(activity)
  saveExternalNullifiers()

  res.json({
    success: true,
    message: "externalNullifier鍙戝竷鎴愬姛",
    externalNullifier,
    name,
    descrption,
    activity: enrichActivity(activity),
  })
})

app.get("/api/external-nullifiers", (req, res) => {
  res.json({
    success: true,
    total: ExternalNullifiersData.externalNullifiers.length,
    externalNullifiers: ExternalNullifiersData.externalNullifiers.map(enrichActivity),
  })
})

app.post("/api/register", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone)

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "?????",
      })
    }

    if (LEAVES.length >= MAX_LEAF_COUNT) {
      return res.status(400).json({
        success: false,
        error: `瀛樺偍鏍戝凡婊?鏈€澶?${MAX_LEAF_COUNT} 鑺傜偣)`,
      })
    }

    const existingUser = findUser(phone)
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "鐢ㄦ埛宸茬粡娉ㄥ唽",
        phone,
        commitment: existingUser.commitment,
      })
    }

    const identityNullifier = randomFieldElement()
    const identityTrapdoor = randomFieldElement()
    const commitment = await createCommitment(
      identityNullifier,
      identityTrapdoor
    )

    const user = {
      phone,
      identityNullifier: identityNullifier.toString(),
      identityTrapdoor: identityTrapdoor.toString(),
      commitment,
      createdAt: new Date().toISOString(),
    }

    UsersData.users.push(user)
    saveUsers()

    LEAVES.push(BigInt(commitment))
    await rebuildMerkleTree()

    res.json({
      success: true,
      message: "娉ㄥ唽鎴愬姛",
      phone,
      identityNullifier: user.identityNullifier,
      identityTrapdoor: user.identityTrapdoor,
      commitment: user.commitment,
      root: TreeMeta.root,
      leafCount: TreeMeta.leafCount,
    })
  } catch (error) {
    console.error("娉ㄥ唽澶辫触", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

app.post("/api/merkle-proof", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone)

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "?????",
      })
    }

    const user = findUser(phone)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "?????",
      })
    }

    const identityCommitment = user.commitment
    const index = findLeafIndex(identityCommitment)

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "???? Merkle ??",
      })
    }

    const proof = await generateMerkleProof(index)

    res.json({
      success: true,
      phone,
      root: TreeMeta.root,
      depth: TreeMeta.depth,
      identityCommitment: String(identityCommitment),
      index,
      ...proof,
    })
  } catch (error) {
    console.error("proof鐢熸垚澶辫触", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

app.post("/api/vote", async (req, res) => {
  try {
    const input = req.body
    const submitMode = input.submitMode === "client" ? "client" : "server"
    const externalNullifier = normalizeExternalNullifier(
      input.externalNullifier
    )
    const vote = normalizeVote(input.vote)

    const requiredFields = [
      "identityNullifier",
      "identityTrapdoor",
      "treePathElements",
      "treePathIndices",
      "root",
      "externalNullifier",
      "vote",
    ]

    for (const key of requiredFields) {
      if (input[key] === undefined) {
        return res.status(400).json({
          success: false,
          error: `缂哄皯蹇呰鍙傛暟: ${key}`,
        })
      }
    }

    if (!externalNullifier) {
      return res.status(400).json({
        success: false,
        error: "???????",
      })
    }

    if (!hasPublishedExternalNullifier(externalNullifier)) {
      return res.status(400).json({
        success: false,
        error: "?????",
      })
    }

    if (!vote) {
      return res.status(400).json({
        success: false,
        error: "???????",
      })
    }

    if (input.treePathElements.length !== CIRCUIT_TREE_LEVELS) {
      return res.status(400).json({
        success: false,
        error: `pathElements闀垮害涓嶇瓑浜?{TreeMeta.depth}`,
      })
    }

    if (input.treePathIndices.length !== CIRCUIT_TREE_LEVELS) {
      return res.status(400).json({
        success: false,
        error: `pathIndices闀垮害涓嶇瓑浜?{TreeMeta.depth}`,
      })
    }

    const activity = findPublishedActivity(externalNullifier)
    const activityStatus = deriveActivityStatus(activity)
    const activityVotes = VotesData.votes.filter(
      (item) => item.externalNullifier === externalNullifier
    )

    if (activityStatus === "upcoming") {
      return res.status(400).json({
        success: false,
        error: "??????",
      })
    }

    if (activityStatus === "closed") {
      return res.status(400).json({
        success: false,
        error: "?????",
      })
    }

    if (activity?.maxVoters != null && activityVotes.length >= activity.maxVoters) {
      return res.status(400).json({
        success: false,
        error: "娲诲姩鍙備笌浜烘暟宸茶揪涓婇檺",
      })
    }

    // 使用随机盐，避免链上可见的 signalHash 从投票值直接反推
    const voteSalt = randomFieldElement()

    const normalizedInput = {
      identityNullifier: String(input.identityNullifier),
      identityTrapdoor: String(input.identityTrapdoor),
      treePathElements: input.treePathElements.map(String),
      treePathIndices: input.treePathIndices.map(String),
      root: String(input.root),
      externalNullifier: externalNullifierToField(externalNullifier),
      vote,
      voteSalt: voteSalt.toString(),
    }

    const wasmPath = path.join(__dirname, "../build/circuit_js/circuit.wasm")
    const zkeyPath = path.join(__dirname, "../zkey/circuit_final.zkey")

    const proofStartedAt = Date.now()
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      normalizedInput,
      wasmPath,
      zkeyPath
    )
    const proofDurationMs = Date.now() - proofStartedAt

    const nullifierHash = publicSignals[0]
    const signalHash = publicSignals[1]

    const existingVote = findVoteRecordByNullifierHash(nullifierHash)

    if (existingVote) {
      return res.status(409).json({
        success: false,
        error: "娲诲姩閲嶅鎶曠エ",
        externalNullifier,
        nullifierHash,
      })
    }

    if (submitMode === "client") {
      return res.json({
        success: true,
        proof,
        publicSignals,
        contractArgs: toContractArgs(proof, publicSignals),
        merkleRoot: normalizedInput.root,
        externalNullifierField: normalizedInput.externalNullifier,
        nullifierHash,
        signalHash,
        voteRecord: {
          externalNullifier,
          vote,
        },
        metrics: {
          proofDurationMs,
        },
      })
    }

    let chainReceipt

    try {
      const chainStartedAt = Date.now()
      chainReceipt = await submitVoteOnChain(proof, publicSignals)
      chainReceipt.durationMs = Date.now() - chainStartedAt
    } catch (error) {
      return res.status(503).json({
        success: false,
        error: `閾句笂鎻愪氦澶辫触: ${error.message}`,
        nullifierHash,
        signalHash,
      })
    }

    const voteRecord = {
      externalNullifier,
      vote,
      nullifierHash,
      signalHash,
      createdAt: new Date().toISOString(),
      onChain: chainReceipt,
    }

    VotesData.votes.push(voteRecord)
    saveVotes()

    res.json({
      success: true,
      proof,
      publicSignals,
      merkleRoot: normalizedInput.root,
      externalNullifierField: normalizedInput.externalNullifier,
      nullifierHash,
      signalHash,
      metrics: {
        proofDurationMs,
        chainDurationMs: chainReceipt.durationMs,
      },
      onChain: chainReceipt,
      voteRecord,
    })
  } catch (error) {
    console.error("鎶曠エ澶辫触", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

app.get("/api/activity-stats/:externalNullifier", (req, res) => {
  const externalNullifier = normalizeExternalNullifier(
    req.params.externalNullifier
  )

  if (!externalNullifier) {
    return res.status(400).json({
      success: false,
      error: "鏃犳晥id",
    })
  }

  const activity = findPublishedActivity(externalNullifier)
  const voteFilterRaw = String(req.query.vote ?? "all")
  const voteFilter = voteFilterRaw === "all" ? null : normalizeVote(voteFilterRaw)
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1)
  const pageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(String(req.query.pageSize ?? "10"), 10) || 10)
  )

  if (!activity) {
    return res.status(404).json({
      success: false,
      error: "?????",
    })
  }

  if (voteFilterRaw !== "all" && !voteFilter) {
    return res.status(400).json({
      success: false,
      error: "?????????",
    })
  }

  const activityVotes = VotesData.votes
    .filter((item) => item.externalNullifier === externalNullifier)
    .sort((a, b) => Date.parse(b.createdAt ?? 0) - Date.parse(a.createdAt ?? 0))
  const filteredVotes = voteFilter
    ? activityVotes.filter((item) => item.vote === voteFilter)
    : activityVotes
  const totalPages = Math.max(1, Math.ceil(filteredVotes.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const pagedVotes = filteredVotes.slice(startIndex, startIndex + pageSize)

  res.json({
    success: true,
    externalNullifier,
    name: activity?.name ?? "",
    descrption: activity?.descrption ?? "",
    createdAt: activity?.createdAt ?? null,
    startAt: activity?.startAt ?? null,
    endAt: activity?.endAt ?? null,
    maxVoters: activity?.maxVoters ?? null,
    createdBy: activity?.createdBy ?? "",
    status: deriveActivityStatus(activity),
    totalVoters: activityVotes.length,
    voteCounts: {
      support: activityVotes.filter((item) => item.vote === "1").length,
      against: activityVotes.filter((item) => item.vote === "0").length,
    },
    pagination: {
      page: safePage,
      pageSize,
      total: filteredVotes.length,
      totalPages,
      hasPrev: safePage > 1,
      hasNext: safePage < totalPages,
    },
    filters: {
      vote: voteFilterRaw,
    },
    voters: pagedVotes.map((item) => ({
      vote: item.vote,
      votedAt: item.createdAt,
      nullifierHash: item.nullifierHash,
      txHash: item.onChain?.txHash ?? null,
      blockNumber: item.onChain?.blockNumber ?? null,
      txUrl: buildTransactionUrl(item.onChain?.txHash),
    })),
  })
})

app.post("/api/vote-record", (req, res) => {
  const externalNullifier = normalizeExternalNullifier(req.body.externalNullifier)
  const vote = normalizeVote(req.body.vote)
  const nullifierHash = String(req.body.nullifierHash ?? "")
  const signalHash = String(req.body.signalHash ?? "")

  if (!externalNullifier || !vote || !nullifierHash || !signalHash) {
    return res.status(400).json({
      success: false,
      error: "缂哄皯鎶曠エ璁板綍鍙傛暟",
    })
  }

  const existingVote = findVoteRecordByNullifierHash(nullifierHash)
  if (existingVote) {
    return res.status(409).json({
      success: false,
      error: "?????????",
      voteRecord: existingVote,
    })
  }

  const voteRecord = {
    externalNullifier,
    vote,
    nullifierHash,
    signalHash,
    createdAt: new Date().toISOString(),
    onChain: req.body.onChain ?? null,
    metrics: req.body.metrics ?? null,
  }

  VotesData.votes.push(voteRecord)
  saveVotes()

  res.json({
    success: true,
    message: "閾句笂鎶曠エ璁板綍鍚屾鎴愬姛",
    voteRecord,
  })
})

const PORT = 3000

;(async () => {
  try {
    synchronizeUsersAndLeaves()
    await rebuildMerkleTree()

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error("Server鍚姩澶辫触", error)
    process.exit(1)
  }
})()
