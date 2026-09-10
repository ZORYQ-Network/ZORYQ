// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ZoryqRewardRegistry {
    enum RewardClass { Mobile, Contributor, Validator }

    address public owner;
    mapping(address => uint256) public finalizedPoints;
    mapping(address => uint256) public claimedPoints;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RewardFinalized(uint256 indexed epoch, address indexed account, RewardClass indexed rewardClass, uint256 points, bytes32 proofRef);
    event RewardClaimed(address indexed account, uint256 points);

    modifier onlyOwner() {
        require(msg.sender == owner, "not_owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "zero_owner");
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }

    function finalizeReward(
        uint256 epoch,
        address account,
        RewardClass rewardClass,
        uint256 points,
        bytes32 proofRef
    ) external onlyOwner {
        require(account != address(0), "zero_account");
        require(points > 0, "zero_points");
        finalizedPoints[account] += points;
        emit RewardFinalized(epoch, account, rewardClass, points, proofRef);
    }

    function finalizeBatch(
        uint256 epoch,
        address[] calldata accounts,
        RewardClass[] calldata classes,
        uint256[] calldata points,
        bytes32[] calldata proofRefs
    ) external onlyOwner {
        uint256 n = accounts.length;
        require(n == classes.length && n == points.length && n == proofRefs.length, "length_mismatch");
        for (uint256 i; i < n; ++i) {
            require(accounts[i] != address(0) && points[i] > 0, "invalid_reward");
            finalizedPoints[accounts[i]] += points[i];
            emit RewardFinalized(epoch, accounts[i], classes[i], points[i], proofRefs[i]);
        }
    }

    function claimable(address account) public view returns (uint256) {
        return finalizedPoints[account] - claimedPoints[account];
    }

    function claim() external returns (uint256 points) {
        points = claimable(msg.sender);
        require(points > 0, "nothing_to_claim");
        claimedPoints[msg.sender] += points;
        emit RewardClaimed(msg.sender, points);
    }
}
