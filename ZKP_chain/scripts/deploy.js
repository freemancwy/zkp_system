const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

const DEPLOYMENTS_DIR = path.join(__dirname, "..", "deployments")
const DEPLOYMENTS_FILE = path.join(DEPLOYMENTS_DIR, "localhost.json")

async function main() {
  const verifierFactory = await hre.ethers.getContractFactory("Groth16Verifier")
  const verifier = await verifierFactory.deploy()
  await verifier.waitForDeployment()

  const votingFactory = await hre.ethers.getContractFactory("VotingWithVerifier")
  const voting = await votingFactory.deploy(await verifier.getAddress())
  await voting.waitForDeployment()

  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true })
  }

  const deployment = {
    network: hre.network.name,
    chainId: hre.network.config.chainId ?? null,
    deployedAt: new Date().toISOString(),
    verifier: await verifier.getAddress(),
    voting: await voting.getAddress(),
  }

  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(deployment, null, 2))

  console.log("Groth16Verifier deployed to:", await verifier.getAddress())
  console.log("VotingWithVerifier deployed to:", await voting.getAddress())
  console.log("Deployment info written to:", DEPLOYMENTS_FILE)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
