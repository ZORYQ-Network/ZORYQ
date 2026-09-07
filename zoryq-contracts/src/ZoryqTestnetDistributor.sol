// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Testnet-only native ZQ distributor. A dedicated operator fulfills verified
/// Sepolia deposits without holding the ZORYQ core admin key.
contract ZoryqTestnetDistributor {
    address public owner;
    address public operator;
    bool public paused;
    uint256 public maxFulfillment;
    uint256 private locked = 1;

    mapping(bytes32 => bool) public fulfilled;

    event Fulfilled(bytes32 indexed fulfillmentId, address indexed recipient, uint256 amount);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event MaxFulfillmentUpdated(uint256 amount);
    event Paused(bool paused);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Funded(address indexed sender, uint256 amount);
    event EmergencyWithdrawal(address indexed recipient, uint256 amount);

    error Unauthorized();
    error PausedError();
    error InvalidInput();
    error AlreadyFulfilled();
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

    constructor(address initialOwner, address initialOperator, uint256 initialMaxFulfillment) payable {
        if (initialOwner == address(0) || initialOperator == address(0) || initialMaxFulfillment == 0) revert InvalidInput();
        owner = initialOwner;
        operator = initialOperator;
        maxFulfillment = initialMaxFulfillment;
        emit OwnershipTransferred(address(0), initialOwner);
        emit OperatorUpdated(address(0), initialOperator);
        emit MaxFulfillmentUpdated(initialMaxFulfillment);
        if (msg.value > 0) emit Funded(msg.sender, msg.value);
    }

    function fulfill(bytes32 fulfillmentId, address payable recipient, uint256 amount) external onlyOperator nonReentrant {
        if (paused) revert PausedError();
        if (fulfillmentId == bytes32(0) || recipient == address(0) || amount == 0 || amount > maxFulfillment || amount > address(this).balance) revert InvalidInput();
        if (fulfilled[fulfillmentId]) revert AlreadyFulfilled();
        fulfilled[fulfillmentId] = true;
        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Fulfilled(fulfillmentId, recipient, amount);
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert InvalidInput();
        address previous = operator;
        operator = newOperator;
        emit OperatorUpdated(previous, newOperator);
    }

    function setMaxFulfillment(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidInput();
        maxFulfillment = amount;
        emit MaxFulfillmentUpdated(amount);
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