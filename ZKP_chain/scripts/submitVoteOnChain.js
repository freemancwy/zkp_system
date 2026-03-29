const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"
const PHONE =
  process.env.PHONE || `139${String(Date.now()).slice(-8).padStart(8, "0")}`
const ACTIVITY = process.env.ACTIVITY || `vote-chain-${Date.now()}`
const VOTE = process.env.VOTE || "1"
const DEPLOYMENTS_FILE = path.join(__dirname, "..", "deployments", "localhost.json")

function resolveVotingAddress() {
  if (process.env.VOTING_ADDRESS) {
    return process.env.VOTING_ADDRESS
  }

  if (!fs.existsSync(DEPLOYMENTS_FILE)) {
    return null
  }

  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf8"))
  return deployment.voting ?? null
}

const VOTING_ADDRESS = resolveVotingAddress()

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  })

  const data = await response.json()
  return { ok: response.ok, status: response.status, data }
}

async function ensureActivityPublished() {
  const result = await request("/api/external-nullifier/publish", {
    method: "POST",
    body: JSON.stringify({ externalNullifier: ACTIVITY }),
  })

  if (!result.ok && result.status !== 409) {
    throw new Error(
      `Failed to publish activity: ${JSON.stringify(result.data, null, 2)}`
    )
  }

  return result.data
}

async function ensureRegistered() {
  const result = await request("/api/register", {
    method: "POST",
    body: JSON.stringify({ phone: PHONE }),
  })

  if (result.ok) {
    return result.data
  }

  if (result.status !== 409) {
    throw new Error(
      `Failed to register user: ${JSON.stringify(result.data, null, 2)}`
    )
  }

  throw new Error(
    [
      "The generated phone is already registered.",
      "Set a fresh PHONE env var and rerun.",
      `Current phone: ${PHONE}`,
    ].join(" ")
  )
}

async function getMerkleProof() {
  const result = await request("/api/merkle-proof", {
    method: "POST",
    body: JSON.stringify({ phone: PHONE }),
  })

  if (!result.ok) {
    throw new Error(
      `Failed to fetch merkle proof: ${JSON.stringify(result.data, null, 2)}`
    )
  }

  return result.data
}

async function generateVoteProof(identityNullifier, identityTrapdoor, proofData) {
  const result = await request("/api/vote", {
    method: "POST",
    body: JSON.stringify({
      identityNullifier,
      identityTrapdoor,
      treePathElements: proofData.pathElements,
      treePathIndices: proofData.pathIndices,
      root: proofData.root,
      externalNullifier: ACTIVITY,
      vote: VOTE,
    }),
  })

  if (!result.ok) {
    throw new Error(
      `Failed to generate vote proof: ${JSON.stringify(result.data, null, 2)}`
    )
  }

  return result.data
}

function toContractArgs(voteResponse) {
  const { proof, publicSignals } = voteResponse

  return {
    pA: [proof.pi_a[0], proof.pi_a[1]],
    pB: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    pC: [proof.pi_c[0], proof.pi_c[1]],
    pubSignals: [publicSignals[0], publicSignals[1]],
  }
}

async function main() {
  if (!VOTING_ADDRESS) {
    throw new Error(
      [
        "Missing voting contract address.",
        "Deploy the contracts first with `npm.cmd run hardhat:deploy`,",
        "or set VOTING_ADDRESS manually.",
      ].join(" ")
    )
  }

  console.log("Submitting a vote on-chain with these settings:")
  console.log(`BASE_URL=${BASE_URL}`)
  console.log(`PHONE=${PHONE}`)
  console.log(`ACTIVITY=${ACTIVITY}`)
  console.log(`VOTE=${VOTE}`)
  console.log(`VOTING_ADDRESS=${VOTING_ADDRESS}`)

  await ensureActivityPublished()
  const registration = await ensureRegistered()
  const merkleProof = await getMerkleProof()
  const voteProof = await generateVoteProof(
    registration.identityNullifier,
    registration.identityTrapdoor,
    merkleProof
  )

  const contractArgs = toContractArgs(voteProof)
  const voting = await hre.ethers.getContractAt(
    "VotingWithVerifier",
    VOTING_ADDRESS
  )

  const tx = await voting.submitVote(
    contractArgs.pA,
    contractArgs.pB,
    contractArgs.pC,
    contractArgs.pubSignals
  )
  const receipt = await tx.wait()

  console.log("Vote proof generated off-chain:")
  console.log(JSON.stringify(voteProof, null, 2))
  console.log("Transaction submitted on-chain:")
  console.log(`txHash=${receipt.hash}`)
  console.log(`blockNumber=${receipt.blockNumber}`)

  const totalVotes = await voting.totalVotes()
  console.log(`Contract totalVotes=${totalVotes.toString()}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
