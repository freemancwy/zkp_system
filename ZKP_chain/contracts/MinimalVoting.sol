// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MinimalVoting {
    string public constant SYSTEM_NAME = "ZKP Privacy Voting Demo";
    uint256 public totalVotes;

    event VoteRecorded(address indexed voter, uint8 vote, uint256 blockNumber);

    function recordVote(uint8 vote) external {
        require(vote <= 1, "vote must be 0 or 1");

        totalVotes += 1;
        emit VoteRecorded(msg.sender, vote, block.number);
    }
}
