pragma circom 2.1.6;

include "node_modules/circomlib/Circuits/poseidon.circom";

template MerkleProof(nLevels) {
    signal input leaf;
    signal input root;
    signal input pathElements[nLevels];
    signal input pathIndices[nLevels];

    signal hashes[nLevels + 1];
    signal left[nLevels];
    signal right[nLevels];

    signal selHash[nLevels];
    signal selPath[nLevels];
    signal selHashR[nLevels];
    signal selPathR[nLevels];

    component hashers[nLevels];

    hashes[0] <== leaf;

    for (var i = 0; i < nLevels; i++) {

        hashers[i] = Poseidon(2);

        // left
        selHash[i] <== (1 - pathIndices[i]) * hashes[i];
        selPath[i] <== pathIndices[i] * pathElements[i];
        left[i] <== selHash[i] + selPath[i];

        // right
        selHashR[i] <== (1 - pathIndices[i]) * pathElements[i];
        selPathR[i] <== pathIndices[i] * hashes[i];
        right[i] <== selHashR[i] + selPathR[i];

        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];

        hashes[i + 1] <== hashers[i].out;
    }

    root === hashes[nLevels];
}

/**
 * Semaphore-style Anonymous Voting Circuit
 * - nLevels: Merkle tree depth
 * - vote: 投票选项（如 0/1 或候选人ID）
 */
template SemaphoreVote(nLevels) {

    // =========================
    // 私有输入（Prover only）
    // =========================
    signal input identityNullifier;
    signal input identityTrapdoor;

    // Merkle 路径
    signal input treePathElements[nLevels];
    signal input treePathIndices[nLevels];

    // =========================
    // 公共输入（Verifier 可见）
    // =========================
    signal input root;
    signal input externalNullifier;

    // ❗ 修复点：避免使用关键字 signal
    signal input vote;

    // =========================
    // 输出
    // =========================
    signal output nullifierHash;
    signal output signalHash;

    // =========================
    // 1. identity commitment
    // =========================
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== identityNullifier;
    commitmentHasher.inputs[1] <== identityTrapdoor;

    signal identityCommitment;
    identityCommitment <== commitmentHasher.out;

    // =========================
    // 2. Merkle membership
    // =========================
    component tree = MerkleProof(nLevels);

    tree.leaf <== identityCommitment;
    tree.root <== root;

    for (var i = 0; i < nLevels; i++) {
        tree.pathElements[i] <== treePathElements[i];
        tree.pathIndices[i] <== treePathIndices[i];
    }

    // =========================
    // 3. nullifierHash
    // =========================
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== identityNullifier;
    nullifierHasher.inputs[1] <== externalNullifier;

    nullifierHash <== nullifierHasher.out;

    // =========================
    // 4. vote hash
    // =========================
    component signalHasher = Poseidon(1);
    signalHasher.inputs[0] <== vote;

    signalHash <== signalHasher.out;
}

// 实例化
component main = SemaphoreVote(20);