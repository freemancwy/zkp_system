pragma circom 2.1.6;

include "node_modules/circomlib/Circuits/poseidon.circom";
include "node_modules/circomlib/Circuits/comparators.circom";

template MerkleProof(nLevels) {
    signal input leaf;
    signal input root;
    signal input pathElements[nLevels];
    signal input pathIndices[nLevels];

    signal hashes[nLevels + 1];
    signal left[nLevels];
    signal right[nLevels];

    signal s[nLevels];

    component hashers[nLevels];

    hashes[0] <== leaf;

    for (var i = 0; i < nLevels; i++) {

        // bit 约束
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        // 使用数组
        s[i] <== pathIndices[i];

        left[i]  <== hashes[i] + s[i] * (pathElements[i] - hashes[i]);
        right[i] <== pathElements[i] + s[i] * (hashes[i] - pathElements[i]);

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];

        hashes[i + 1] <== hashers[i].out;
    }

    root === hashes[nLevels];
}

template SemaphoreVote(nLevels) {
    // 私有输入
    signal input identityNullifier;
    signal input identityTrapdoor;
    signal input treePathElements[nLevels];
    signal input treePathIndices[nLevels];

    // 公共输入
    signal input root;
    signal input externalNullifier;
    signal input vote;

    // 输出
    signal output nullifierHash;
    signal output voteHash;

    // 1. 身份承诺
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== identityNullifier;
    commitmentHasher.inputs[1] <== identityTrapdoor;
    signal identityCommitment <== commitmentHasher.out;

    // 2. Merkle 成员证明
    component tree = MerkleProof(nLevels);
    tree.leaf <== identityCommitment;
    tree.root <== root;
    for (var i = 0; i < nLevels; i++) {
        tree.pathElements[i] <== treePathElements[i];
        tree.pathIndices[i] <== treePathIndices[i];
    }

    // 3. 防重复投票
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== identityNullifier;
    nullifierHasher.inputs[1] <== externalNullifier;
    nullifierHash <== nullifierHasher.out;

    // 4. 投票约束：必须是 0 或 1（二选一投票）
    component voteCheck = LessThan(3);
    voteCheck.in[0] <== vote;
    voteCheck.in[1] <== 2;
    voteCheck.out === 1;

    // 5. 投票哈希（强约束，不可伪造）
    component voteHasher = Poseidon(1);
    voteHasher.inputs[0] <== vote;
    voteHash <== voteHasher.out;
}

component main = SemaphoreVote(20);