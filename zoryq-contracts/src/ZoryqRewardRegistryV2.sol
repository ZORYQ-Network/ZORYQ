// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ZoryqRewardRegistryV2 {
    enum RewardClass { Mobile, Contributor, Validator }

    address public owner;
    uint256 public totalFinalizedPoints;
    mapping(address => uint256) public finalizedPoints;
    mapping(address => uint256) public claimedPoints;
    mapping(address => mapping(uint8 => uint256)) public pointsByClass;
    mapping(uint256 => uint256) public epochTotals;

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

    function _credit(uint256 epoch, address account, RewardClass rewardClass, uint256 points, bytes32 proofRef) internal {
        require(account != address(0), "zero_account");
        require(points > 0, "zero_points");
        finalizedPoints[account] += points;
        pointsByClass[account][uint8(rewardClass)] += points;
        epochTotals[epoch] += points;
        totalFinalizedPoints += points;
        emit RewardFinalized(epoch, account, rewardClass, points, proofRef);
    }

    function finalizeReward(uint256 epoch, address account, RewardClass rewardClass, uint256 points, bytes32 proofRef) external onlyOwner {
        _credit(epoch, account, rewardClass, points, proofRef);
    }

    function finalizeBatch(uint256 epoch, address[] calldata accounts, RewardClass[] calldata classes, uint256[] calldata points, bytes32[] calldata proofRefs) external onlyOwner {
        uint256 n = accounts.length;
        require(n == classes.length && n == points.length && n == proofRefs.length, "length_mismatch");
        for (uint256 i; i < n; ++i) _credit(epoch, accounts[i], classes[i], points[i], proofRefs[i]);
    }

    function scoreOf(address account) external view returns (uint256 total, uint256 mobile, uint256 contributor, uint256 validator, uint256 claimed, uint256 claimablePoints) {
        total = finalizedPoints[account];
        mobile = pointsByClass[account][uint8(RewardClass.Mobile)];
        contributor = pointsByClass[account][uint8(RewardClass.Contributor)];
        validator = pointsByClass[account][uint8(RewardClass.Validator)];
        claimed = claimedPoints[account];
        claimablePoints = total - claimed;
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
