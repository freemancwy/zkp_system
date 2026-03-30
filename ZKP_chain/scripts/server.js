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
  })
})

app.post("/api/external-nullifier/publish", (req, res) => {
  const externalNullifier = normalizeExternalNullifier(
    req.body.externalNullifier
  )
  const name = normalizeActivityText(req.body.name)
  const descrption = normalizeActivityText(req.body.descrption)

  if (!externalNullifier) {
    return res.status(400).json({
      success: false,
      error: "缺少活动标识",
    })
  }

  if (hasPublishedExternalNullifier(externalNullifier)) {
    return res.status(409).json({
      success: false,
      error: "活动标识已发布",
      externalNullifier,
    })
  }

  ExternalNullifiersData.externalNullifiers.push({
    externalNullifier,
    name,
    descrption,
    createdAt: new Date().toISOString(),
  })
  saveExternalNullifiers()

  res.json({
    success: true,
    message: "externalNullifier发布成功",
    externalNullifier,
    name,
    descrption,
  })
})

app.get("/api/external-nullifiers", (req, res) => {
  res.json({
    success: true,
    total: ExternalNullifiersData.externalNullifiers.length,
    externalNullifiers: ExternalNullifiersData.externalNullifiers,
  })
})

app.post("/api/register", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone)

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "无效手机号",
      })
    }

    if (LEAVES.length >= MAX_LEAF_COUNT) {
      return res.status(400).json({
        success: false,
        error: `存储树已满(最大 ${MAX_LEAF_COUNT} 节点)`,
      })
    }

    const existingUser = findUser(phone)
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "用户已经注册",
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
      message: "注册成功",
      phone,
      identityNullifier: user.identityNullifier,
      identityTrapdoor: user.identityTrapdoor,
      commitment: user.commitment,
      root: TreeMeta.root,
      leafCount: TreeMeta.leafCount,
    })
  } catch (error) {
    console.error("注册失败", error)
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
        error: "缺少手机号",
      })
    }

    const user = findUser(phone)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "用户未注册",
      })
    }

    const identityCommitment = user.commitment
    const index = findLeafIndex(identityCommitment)

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "用户不在默克尔树中",
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
    console.error("proof生成失败", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

app.post("/api/vote", async (req, res) => {
  try {
    const input = req.body
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
          error: `缺少必要参数: ${key}`,
        })
      }
    }

    if (!externalNullifier) {
      return res.status(400).json({
        success: false,
        error: "无效的活动标识",
      })
    }

    if (!hasPublishedExternalNullifier(externalNullifier)) {
      return res.status(400).json({
        success: false,
        error: "活动未发布",
      })
    }

    if (!vote) {
      return res.status(400).json({
        success: false,
        error: "vote不合法",
      })
    }

    if (input.treePathElements.length !== CIRCUIT_TREE_LEVELS) {
      return res.status(400).json({
        success: false,
        error: `pathElements长度不等于${TreeMeta.depth}`,
      })
    }

    if (input.treePathIndices.length !== CIRCUIT_TREE_LEVELS) {
      return res.status(400).json({
        success: false,
        error: `pathIndices长度不等于${TreeMeta.depth}`,
      })
    }

    const normalizedInput = {
      identityNullifier: String(input.identityNullifier),
      identityTrapdoor: String(input.identityTrapdoor),
      treePathElements: input.treePathElements.map(String),
      treePathIndices: input.treePathIndices.map(String),
      root: String(input.root),
      externalNullifier: externalNullifierToField(externalNullifier),
      vote,
    }

    const wasmPath = path.join(__dirname, "../build/circuit_js/circuit.wasm")
    const zkeyPath = path.join(__dirname, "../zkey/circuit_final.zkey")

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      normalizedInput,
      wasmPath,
      zkeyPath
    )

    const nullifierHash = publicSignals[0]
    const signalHash = publicSignals[1]

    const existingVote = findVoteRecordByNullifierHash(nullifierHash)

    if (existingVote) {
      return res.status(409).json({
        success: false,
        error: "活动重复投票",
        externalNullifier,
        nullifierHash,
      })
    }

    let chainReceipt

    try {
      chainReceipt = await submitVoteOnChain(proof, publicSignals)
    } catch (error) {
      return res.status(503).json({
        success: false,
        error: `链上提交失败: ${error.message}`,
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
      onChain: chainReceipt,
      voteRecord,
    })
  } catch (error) {
    console.error("投票失败", error)
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
      error: "无效id",
    })
  }

  const activityVotes = VotesData.votes.filter(
    (item) => item.externalNullifier === externalNullifier
  )
  const activity = findPublishedActivity(externalNullifier)

  res.json({
    success: true,
    externalNullifier,
    name: activity?.name ?? "",
    descrption: activity?.descrption ?? "",
    createdAt: activity?.createdAt ?? null,
    totalVoters: activityVotes.length,
    voteCounts: {
      support: activityVotes.filter((item) => item.vote === "1").length,
      against: activityVotes.filter((item) => item.vote === "0").length,
    },
    voters: activityVotes.map((item) => ({
      vote: item.vote,
      votedAt: item.createdAt,
      nullifierHash: item.nullifierHash,
    })),
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
    console.error("Server启动失败", error)
    process.exit(1)
  }
})()
