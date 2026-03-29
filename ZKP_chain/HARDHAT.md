# Hardhat Quick Start

This project now includes a minimal Hardhat environment for local blockchain work.

## 1. Install dependencies

Run this from `ZKP_chain/`:

```bash
npm install
```

## 2. Start a local chain

```bash
npm run hardhat:node
```

Keep this terminal open.

## 3. Compile contracts

Open a second terminal in `ZKP_chain/`:

```bash
npm run hardhat:compile
```

## 4. Deploy the contracts

```bash
npm run hardhat:deploy
```

This deploys:

- `contracts/Verifier.sol`
- `contracts/VotingWithVerifier.sol`

The deployment addresses are written to:

```text
deployments/localhost.json
```

## 5. Next step for this thesis project

After the environment is working, the next blockchain step is:

1. Generate `contracts/Verifier.sol`
2. Replace `MinimalVoting.sol` with a verifier-aware voting contract
3. Submit the proof returned by `scripts/server.js` to the deployed contract

## 6. Submit a proof on-chain

Start the backend server first in another terminal:

```bash
node scripts/server.js
```

Then call the on-chain submit script:

```bash
npm run hardhat:submit-vote
```

By default it reads the voting contract address from `deployments/localhost.json`.
You can still override it manually:

```bash
VOTING_ADDRESS=<deployed-address> npm run hardhat:submit-vote
```

Optional environment variables:

- `BASE_URL`
- `PHONE`
- `ACTIVITY`
- `VOTE`

## Useful commands

Generate a Solidity verifier from the current zkey:

```bash
npm run hardhat:export-verifier
```
