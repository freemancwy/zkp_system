# zkp_system

基于零知识证明与区块链的匿名投票演示系统，毕业设计

整个系统的工作流程是链上发布活动，用户可以注册活动从而获取

1.ZKP电路设计
1.1技术栈：采用MerkleTree存储用户信息，Poseidon算法进行哈希，Semaphore身份模型进行验证

    1.2MerkleProof，证明leaf即身份hash存在于以root为根节点的Merkle树中，在这个示例中即判断选民是否在白名单中，逻辑如下：用户输入叶子节点，树根，路径元素，路径方向，通过pathIndices选择左右节点顺序，用Poseidon算法计算父hash，逐层向上计算，得到根hahsh，约束root===hashes[nlevels]

    1.3SemaphoreVote主电路，私有输入为：1.identityNullifier/identityTrapdoor：选民身份密钥，生成唯一身份。2.treePathElements/treePathIndices：Merkle树证明路径，不暴露位置。公共输入包括：root：Merkle树根，选民的白名单；exernalNullifier：用于标记唯一的投票活动；vote：投票选项，是否支持，采用电路强约束，防止非法值传入

2.编译测试ZKP电路
具体可参考：[text](https://github.com/iden3/snarkjs?tab=readme-ov-file)

3.后端接口Server.js编写
3.1获取Merkle树根（/api/vote）
3.2获取Merkle Proof（/api/merkle-proof）
3.3投票接口（/api/vote）
