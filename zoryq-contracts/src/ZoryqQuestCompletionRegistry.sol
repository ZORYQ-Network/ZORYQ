// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Records verified Testnet quest completions on-chain.
/// Verification may be performed by an approved coordinator or future decentralized verifier.
contract ZoryqQuestCompletionRegistry {
    address public owner;
    mapping(address => bool) public verifiers;
    mapping(uint256 => mapping(address => bool)) public completed;
    mapping(address => uint256) public completionCount;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event VerifierUpdated(address indexed verifier, bool allowed);
    event QuestCompleted(uint256 indexed questId, address indexed account, address indexed verifier, bytes32 proofRef);

    modifier onlyOwner() {
        require(msg.sender == owner, "not_owner");
        _;
    }

    modifier onlyVerifier() {
        require(verifiers[msg.sender] || msg.sender == owner, "not_verifier");
        _;
    }

    constructor(address initialOwner) {
        require(initialOwner != address(0), "zero_owner");
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "zero_owner");
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }

    function setVerifier(address verifier, bool allowed) external onlyOwner {
        require(verifier != address(0), "zero_verifier");
        verifiers[verifier] = allowed;
        emit VerifierUpdated(verifier, allowed);
    }

    function recordCompletion(uint256 questId, address account, bytes32 proofRef) external onlyVerifier {
        require(questId > 0, "bad_quest");
        require(account != address(0), "zero_account");
        require(!completed[questId][account], "already_completed");
        completed[questId][account] = true;
        completionCount[account] += 1;
        emit QuestCompleted(questId, account, msg.sender, proofRef);
    }

    function recordBatch(uint256 questId, address[] calldata accounts, bytes32[] calldata proofRefs) external onlyVerifier {
        require(accounts.length == proofRefs.length, "length_mismatch");
        for (uint256 i; i < accounts.length; ++i) {
            address account = accounts[i];
            require(account != address(0), "zero_account");
            if (!completed[questId][account]) {
                completed[questId][account] = true;
                completionCount[account] += 1;
                emit QuestCompleted(questId, account, msg.sender, proofRefs[i]);
            }
        }
    }
}
