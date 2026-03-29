// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[2] calldata _pubSignals
    ) external view returns (bool);
}

contract VotingWithVerifier {
    IGroth16Verifier public immutable verifier;
    uint256 public totalVotes;

    mapping(uint256 => bool) public nullifierHashUsed;
    uint256[] private submittedNullifierHashes;
    uint256[] private submittedVoteHashes;

    event VoteVerifiedAndRecorded(uint256 indexed nullifierHash, uint256 voteHash);

    constructor(address verifierAddress) {
        require(verifierAddress != address(0), "invalid verifier");
        verifier = IGroth16Verifier(verifierAddress);
    }

    function submitVote(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[2] calldata pubSignals
    ) external returns (bool) {
        uint256 nullifierHash = pubSignals[0];
        uint256 voteHash = pubSignals[1];

        require(!nullifierHashUsed[nullifierHash], "duplicate vote");
        require(verifier.verifyProof(pA, pB, pC, pubSignals), "invalid proof");

        nullifierHashUsed[nullifierHash] = true;
        totalVotes += 1;
        submittedNullifierHashes.push(nullifierHash);
        submittedVoteHashes.push(voteHash);

        emit VoteVerifiedAndRecorded(nullifierHash, voteHash);
        return true;
    }

    function getVoteRecord(uint256 index) external view returns (uint256, uint256) {
        require(index < totalVotes, "index out of bounds");
        return (submittedNullifierHashes[index], submittedVoteHashes[index]);
    }

    function getAllVoteRecords()
        external
        view
        returns (uint256[] memory, uint256[] memory)
    {
        return (submittedNullifierHashes, submittedVoteHashes);
    }
}
