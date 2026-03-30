# 零知识投票系统增强说明

## 当前增强点

1. 活动元数据增强
- `externalNullifier`
- `name`
- `descrption`
- `startAt`
- `endAt`
- `maxVoters`
- `createdBy`
- `createdAt`

2. 活动状态控制
- `upcoming`：尚未开始
- `active`：进行中
- `closed`：已结束

3. 链上状态展示
- 合约地址
- 验证器地址
- 网络名称
- 链上总票数
- 部署时间

4. 投票链路实验指标
- `proofDurationMs`
- `chainDurationMs`

## 论文可写内容建议

### 系统架构
- 前端 Vue 应用
- Node.js/Express 后端
- Circom + SnarkJS 证明生成
- Solidity 合约验证
- Hardhat 本地链部署与测试

### 业务流程
1. 管理员发布活动
2. 用户注册匿名身份
3. 后端生成 Merkle Proof
4. 后端生成 ZK 证明
5. 合约验证并记录投票
6. 前端展示链上结果与统计信息

### 实验建议
1. 记录不同活动下的投票耗时
2. 比较 proof 生成耗时与链上验证耗时
3. 统计链上总票数与本地记录的一致性
4. 对比不同树深度下的证明生成性能

## 图表建议
- 系统总体架构图
- 投票时序图
- 零知识证明生成流程图
- 链上验证流程图
- 实验数据表格与柱状图
