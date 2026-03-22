const express = require("express")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
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
const CIRCUIT_TREE_LEVELS = 20
const MAX_LEAF_COUNT = 2 ** CIRCUIT_TREE_LEVELS
const BN128_FIELD_SIZE = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
)

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

const LEAVES = LeavesData.leaves.map((value) => BigInt(value))

let poseidon
let F

const poseidonReady = (async () => {
  poseidon = await buildPoseidon()
  F = poseidon.F
})()

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

function findRegistration(phone, externalNullifier) {
  const user = findUser(phone)

  if (!user) {
    return null
  }

  const registration =
    user.registrations.find(
      (item) => item.externalNullifier === externalNullifier
    ) ?? null

  if (!registration) {
    return null
  }

  return { user, registration }
}

function findVoteRecordByNullifierHash(nullifierHash) {
  return (
    VotesData.votes.find((item) => item.nullifierHash === nullifierHash) ??
    null
  )
}

function hasPublishedExternalNullifier(externalNullifier) {
  return ExternalNullifiersData.externalNullifiers.some(
    (item) => item.externalNullifier === externalNullifier
  )
}

async function rebuildMerkleTree() {
  await poseidonReady

  if (LEAVES.length === 0) {
    TreeMeta.root = null
    TreeMeta.depth = 0
    TreeMeta.leafCount = 0
    saveLeavesAndMeta()
    return
  }

  let current = [...LEAVES]
  let depth = 0

  while (current.length > 1) {
    const next = []

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]
      const right = current[i + 1] ?? current[i]
      const hash = poseidon([left, right])

      next.push(F.toObject(hash))
    }

    current = next
    depth += 1
  }

  TreeMeta.root = current[0].toString()
  TreeMeta.depth = depth
  TreeMeta.leafCount = LEAVES.length
  saveLeavesAndMeta()
}

async function createCommitment(identityNullifier, identityTrapdoor) {
  await poseidonReady

  return F.toString(poseidon([identityNullifier, identityTrapdoor]))
}

async function generateMerkleProof(leafIndex) {
  await poseidonReady

  const pathElements = []
  const pathIndices = []
  let current = [...LEAVES]
  let index = leafIndex

  while (current.length > 1) {
    const isRight = index % 2
    const pairIndex = isRight ? index - 1 : index + 1
    const sibling =
      pairIndex < current.length ? current[pairIndex] : current[index]

    pathElements.push(sibling.toString())
    pathIndices.push(isRight)

    const next = []

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]
      const right = current[i + 1] ?? current[i]
      const hash = poseidon([left, right])

      next.push(F.toObject(hash))
    }

    current = next
    index = Math.floor(index / 2)
  }

  return {
    pathElements,
    pathIndices,
  }
}

// 查询 merkleTree 的根节点
app.get("/api/root", (req, res) => {
  res.json({
    root: TreeMeta.root,
    depth: TreeMeta.depth,
    leafCount: TreeMeta.leafCount,
  })
})

//发布活动
app.post("/api/external-nullifier/publish", (req, res) => {
  const externalNullifier = normalizeExternalNullifier(
    req.body.externalNullifier
  )

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
    createdAt: new Date().toISOString(),
  })
  saveExternalNullifiers()

  res.json({
    success: true,
    message: "externalNullifier发布成功",
    externalNullifier,
  })
})

//查询已经发布的活动
app.get("/api/external-nullifiers", (req, res) => {
  res.json({
    success: true,
    total: ExternalNullifiersData.externalNullifiers.length,
    externalNullifiers: ExternalNullifiersData.externalNullifiers,
  })
})

// 用户注册，提供手机号，登录时，输入手机号发送验证码登录
app.post("/api/register", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone)
    const externalNullifier = normalizeExternalNullifier(
      req.body.externalNullifier
    )

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "无效手机号",
      })
    }

    if (!externalNullifier) {
      return res.status(400).json({
        success: false,
        error: "缺少活动标识",
      })
    }

    if (!hasPublishedExternalNullifier(externalNullifier)) {
      return res.status(400).json({
        success: false,
        error: "活动未发布",
      })
    }

    if (LEAVES.length >= MAX_LEAF_COUNT) {
      return res.status(400).json({
        success: false,
        error: `存储树已满(最大${MAX_LEAF_COUNT}节点)`,
      })
    }

    const existing = findRegistration(phone, externalNullifier)
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "用户已经注册过此活动",
        phone,
        externalNullifier,
        commitment: existing.registration.commitment,
      })
    }

    const identityNullifier = randomFieldElement()
    const identityTrapdoor = randomFieldElement()
    const commitment = await createCommitment(
      identityNullifier,
      identityTrapdoor
    )

    const registration = {
      externalNullifier,
      phone,
      identityNullifier: identityNullifier.toString(),
      identityTrapdoor: identityTrapdoor.toString(),
      commitment,
      createdAt: new Date().toISOString(),
    }

    let user = findUser(phone)
    if (!user) {
      user = {
        phone,
        registrations: [],
      }
      UsersData.users.push(user)
    }

    user.registrations.push(registration)
    saveUsers()

    LEAVES.push(BigInt(commitment))
    await rebuildMerkleTree()

    res.json({
      success: true,
      message: "注册成功",
      phone,
      externalNullifier,
      identityNullifier: registration.identityNullifier,
      identityTrapdoor: registration.identityTrapdoor,
      commitment: registration.commitment,
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

// 根据用户提供的手机号和活动id查找证明信息，pathElements和pathIndices
app.post("/api/merkle-proof", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone)
    const externalNullifier = normalizeExternalNullifier(
      req.body.externalNullifier
    )

    if (!phone || !externalNullifier) {
      return res.status(400).json({
        success: false,
        error: "缺少手机号和活动标识",
      })
    }

    if (!hasPublishedExternalNullifier(externalNullifier)) {
      return res.status(400).json({
        success: false,
        error: "活动未发布",
      })
    }

    const record = findRegistration(phone, externalNullifier)

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "未注册",
      })
    }

    const identityCommitment = record.registration.commitment
    const index = findLeafIndex(identityCommitment)

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "该用户不在活动中",
      })
    }

    const proof = await generateMerkleProof(index)

    res.json({
      success: true,
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

// 用户投票
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
          error: `缺少导致失败${key}`,
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

    if (input.treePathElements.length !== TreeMeta.depth) {
      return res.status(400).json({
        success: false,
        error: `pathElements长度不等于${TreeMeta.depth}`,
      })
    }

    if (input.treePathIndices.length !== TreeMeta.depth) {
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

    const voteRecord = {
      externalNullifier,
      vote,
      nullifierHash,
      signalHash,
      createdAt: new Date().toISOString(),
    }

    VotesData.votes.push(voteRecord)
    saveVotes()

    res.json({
      success: true,
      proof,
      publicSignals: [normalizedInput.root, nullifierHash, signalHash],
      externalNullifierField: normalizedInput.externalNullifier,
      nullifierHash,
      signalHash,
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

// 根据活动id查询投票情况
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

  res.json({
    success: true,
    externalNullifier,
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
