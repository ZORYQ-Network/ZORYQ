// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Testnet-only native ZQ staking vault used to prove participation.
/// It does not mint yield, promise returns, or convert stake into a production token.
contract ZoryqTestnetStake {
    mapping(address => uint256) public staked;
    mapping(address => uint64) public stakedSince;
    uint256 public totalStaked;

    event Staked(address indexed account, uint256 amount, uint256 newBalance, uint64 stakedSince);
    event Unstaked(address indexed account, uint256 amount, uint256 remainingBalance);

    function stake() external payable {
        require(msg.value > 0, "zero_amount");
        if (staked[msg.sender] == 0) stakedSince[msg.sender] = uint64(block.timestamp);
        staked[msg.sender] += msg.value;
        totalStaked += msg.value;
        emit Staked(msg.sender, msg.value, staked[msg.sender], stakedSince[msg.sender]);
    }

    function unstake(uint256 amount) external {
        require(amount > 0 && amount <= staked[msg.sender], "invalid_amount");
        staked[msg.sender] -= amount;
        totalStaked -= amount;
        if (staked[msg.sender] == 0) stakedSince[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer_failed");
        emit Unstaked(msg.sender, amount, staked[msg.sender]);
    }

    function position(address account) external view returns (uint256 amount, uint64 since, uint256 ageSeconds) {
        amount = staked[account];
        since = stakedSince[account];
        ageSeconds = since == 0 ? 0 : block.timestamp - since;
    }
}
