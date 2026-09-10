// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Testnet-only Sepolia ETH deposit vault for ZORYQ Testnet onboarding.
///         Deposits create verifiable evidence for an off-chain/on-chain ZQ Testnet distributor.
///         This contract does not sell or represent future Mainnet ZQ.
contract ZoryqTestnetExchangeVault {
    address public owner;
    bool public paused;
    uint256 public minDeposit;
    uint256 public maxDeposit;
    uint256 public nextDepositId = 1;
    uint256 private locked = 1;

    event Deposited(uint256 indexed depositId, address indexed sender, address indexed zoryqRecipient, uint256 amount);
    event Paused(bool paused);
    event LimitsUpdated(uint256 minDeposit, uint256 maxDeposit);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TreasuryWithdrawal(address indexed recipient, uint256 amount);

    error Unauthorized();
    error PausedError();
    error InvalidRecipient();
    error InvalidAmount();
    error TransferFailed();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address initialOwner, uint256 initialMinDeposit, uint256 initialMaxDeposit) {
        if (initialOwner == address(0) || initialMinDeposit == 0 || initialMaxDeposit < initialMinDeposit) revert InvalidAmount();
        owner = initialOwner;
        minDeposit = initialMinDeposit;
        maxDeposit = initialMaxDeposit;
        emit OwnershipTransferred(address(0), initialOwner);
        emit LimitsUpdated(initialMinDeposit, initialMaxDeposit);
    }

    function deposit(address zoryqRecipient) external payable returns (uint256 depositId) {
        if (paused) revert PausedError();
        if (zoryqRecipient == address(0)) revert InvalidRecipient();
        if (msg.value < minDeposit || msg.value > maxDeposit) revert InvalidAmount();
        depositId = nextDepositId++;
        emit Deposited(depositId, msg.sender, zoryqRecipient, msg.value);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit Paused(value);
    }

    function setLimits(uint256 newMinDeposit, uint256 newMaxDeposit) external onlyOwner {
        if (newMinDeposit == 0 || newMaxDeposit < newMinDeposit) revert InvalidAmount();
        minDeposit = newMinDeposit;
        maxDeposit = newMaxDeposit;
        emit LimitsUpdated(newMinDeposit, newMaxDeposit);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidRecipient();
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    function withdraw(address payable recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0) || amount == 0 || amount > address(this).balance) revert InvalidAmount();
        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit TreasuryWithdrawal(recipient, amount);
    }

    receive() external payable {
        revert InvalidRecipient();
    }
}