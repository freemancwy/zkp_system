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
const CIRCUIT_TREE_LEVELS = 20
const MAX_LEAF_COUNT = 2 ** CIRCUIT_TREE_LEVELS

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

function randomFieldElement() {
  return BigInt(`0x${crypto.randomBytes(31).toString("hex")}`)
}

function saveUsers() {
  writeJson(USERS_FILE, UsersData)
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
    const sibling = pairIndex < current.length ? current[pairIndex] : current[index]

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


app.get("/api/root", (req, res) => {
  res.json({
    root: TreeMeta.root,
    depth: TreeMeta.depth,
    leafCount: TreeMeta.leafCount,
  })
})


app.post("/api/register", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone)
    const externalNullifier = normalizeExternalNullifier(
      req.body.externalNullifier
    )

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "无效的手机号码",
      })
    }

    if (!externalNullifier) {
      return res.status(400).json({
        success: false,
        error: "未填写活动唯一标识",
      })
    }

    if (LEAVES.length >= MAX_LEAF_COUNT) {
      return res.status(400).json({
        success: false,
        error: `MerkleTree已满(最大${MAX_LEAF_COUNT}叶子)`,
      })
    }

    const existing = findRegistration(phone, externalNullifier)
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "用户已经注册过该活动",
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

app.post("/api/merkle-proof", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone)
    const externalNullifier = normalizeExternalNullifier(
      req.body.externalNullifier
    )

    let identityCommitment = req.body.identityCommitment

    if (phone && externalNullifier) {
      const record = findRegistration(phone, externalNullifier)

      if (!record) {
        return res.status(404).json({
          success: false,
          error: "未注册",
        })
      }

      identityCommitment = record.registration.commitment
    }

    if (!identityCommitment) {
      return res.status(400).json({
        success: false,
        error: "缺失identityCommitment或phone/externalNullifier",
      })
    }

    const index = findLeafIndex(identityCommitment)

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "Commitment未发现",
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
    console.error("Merkleproof生成失败:", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})


//投票接口
app.post("/api/vote", async (req, res) => {
  try {
    const input = req.body
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
          error: `未填写字段: ${key}`,
        })
      }
    }

    if (input.treePathElements.length !== TreeMeta.depth) {
      return res.status(400).json({
        success: false,
        error: `pathElements长度必须等于${TreeMeta.depth}`,
      })
    }

    if (input.treePathIndices.length !== TreeMeta.depth) {
      return res.status(400).json({
        success: false,
        error: `pathIndices长度必须等于${TreeMeta.depth}`,
      })
    }

    const normalizedInput = {
      identityNullifier: String(input.identityNullifier),
      identityTrapdoor: String(input.identityTrapdoor),
      treePathElements: input.treePathElements.map(String),
      treePathIndices: input.treePathIndices.map(String),
      root: String(input.root),
      externalNullifier: String(input.externalNullifier),
      vote: String(input.vote),
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

    res.json({
      success: true,
      proof,
      publicSignals: [normalizedInput.root, nullifierHash, signalHash],
      nullifierHash,
      signalHash,
    })
  } catch (error) {
    console.error("投票无效:", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

const PORT = 3000

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
