pragma circom 2.1.6;

include "circomlib/poseidon.circom";
include "circomlib/merkle.circom";

// Merkle Tree 深度（可调整）
template AnonymousVote(nLevels) {

    // =====================
    // 私有输入（不会公开）
    // =====================
    signal input secret;        // 用户私密值
    signal input nullifier;     // 防重复标识

    // Merkle 路径
    signal input pathElements[nLevels];
    signal input pathIndices[nLevels];

    // =====================
    // 公共输入（链上可见）
    // =====================
    signal input root;          // Merkle Root
    signal input externalNullifier; // 投票轮次ID

    signal output nullifierHash;

    // =====================
    // 1. 生成 commitment
    // =====================
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== secret;
    commitmentHasher.inputs[1] <== nullifier;

    signal commitment;
    commitment <== commitmentHasher.out;

    // =====================
    // 2. 验证 Merkle Tree
    // =====================
    component tree = MerkleTreeChecker(nLevels);

    tree.leaf <== commitment;
    tree.root <== root;

    for (var i = 0; i < nLevels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // =====================
    // 3. 生成 nullifierHash（防重复投票）
    // =====================
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHasher.inputs[1] <== externalNullifier;

    nullifierHash <== nullifierHasher.out;
}

// 实例化（树深 20，支持约 100万用户）
component main = AnonymousVote(20);