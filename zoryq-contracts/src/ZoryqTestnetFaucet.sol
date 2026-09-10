// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Testnet-only native ZQ faucet designed for server-verified claims.
/// @dev The operator submits claims after off-chain eligibility checks (for example wallet/X gating).
///      This contract does not represent or promise Mainnet ZQ, allocation, airdrop, or monetary value.
contract ZoryqTestnetFaucet {
    address public owner;
    address public operator;
    bool public paused;
    uint256 public claimAmount;
    uint256 public cooldown;
    uint256 private locked = 1;

    mapping(bytes32 => bool) public fulfilledClaims;
    mapping(address => uint256) public lastClaimAt;

    event Claimed(bytes32 indexed claimId, address indexed recipient, uint256 amount, uint256 nextClaimAt);
    event Funded(address indexed sender, uint256 amount);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event ClaimConfigUpdated(uint256 claimAmount, uint256 cooldown);
    event Paused(bool paused);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event EmergencyWithdrawal(address indexed recipient, uint256 amount);

    error Unauthorized();
    error InvalidInput();
    error PausedError();
    error AlreadyFulfilled();
    error CooldownActive(uint256 nextClaimAt);
    error InsufficientFaucetBalance();
    error TransferFailed();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address initialOwner, address initialOperator, uint256 initialClaimAmount, uint256 initialCooldown) payable {
        if (initialOwner == address(0) || initialOperator == address(0) || initialClaimAmount == 0) revert InvalidInput();
        owner = initialOwner;
        operator = initialOperator;
        claimAmount = initialClaimAmount;
        cooldown = initialCooldown;
        emit OwnershipTransferred(address(0), initialOwner);
        emit OperatorUpdated(address(0), initialOperator);
        emit ClaimConfigUpdated(initialClaimAmount, initialCooldown);
        if (msg.value > 0) emit Funded(msg.sender, msg.value);
    }

    function fulfill(bytes32 claimId, address payable recipient) external onlyOperator nonReentrant {
        if (paused) revert PausedError();
        if (claimId == bytes32(0) || recipient == address(0)) revert InvalidInput();
        if (fulfilledClaims[claimId]) revert AlreadyFulfilled();

        uint256 last = lastClaimAt[recipient];
        if (last != 0 && block.timestamp < last + cooldown) revert CooldownActive(last + cooldown);
        if (address(this).balance < claimAmount) revert InsufficientFaucetBalance();

        fulfilledClaims[claimId] = true;
        lastClaimAt[recipient] = block.timestamp;
        uint256 nextClaimAt = block.timestamp + cooldown;

        (bool ok,) = recipient.call{value: claimAmount}("");
        if (!ok) revert TransferFailed();
        emit Claimed(claimId, recipient, claimAmount, nextClaimAt);
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert InvalidInput();
        address previous = operator;
        operator = newOperator;
        emit OperatorUpdated(previous, newOperator);
    }

    function setClaimConfig(uint256 newClaimAmount, uint256 newCooldown) external onlyOwner {
        if (newClaimAmount == 0) revert InvalidInput();
        claimAmount = newClaimAmount;
        cooldown = newCooldown;
        emit ClaimConfigUpdated(newClaimAmount, newCooldown);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit Paused(value);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidInput();
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    function emergencyWithdraw(address payable recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0) || amount == 0 || amount > address(this).balance) revert InvalidInput();
        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit EmergencyWithdrawal(recipient, amount);
    }

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }
}
