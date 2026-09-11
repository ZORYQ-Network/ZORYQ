// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ZoryqSocialPayRouter
/// @notice Non-custodial social payment router. Splits each payment atomically
///         between the profile recipient and the ZORIQ treasury.
contract ZoryqSocialPayRouter {
    uint16 public constant MAX_FEE_BPS = 250; // 2.50% hard cap

    address public owner;
    address payable public treasury;
    uint16 public feeBps;
    uint256 private locked = 1;

    event SocialPayment(
        address indexed payer,
        address indexed recipient,
        address indexed asset,
        uint256 grossAmount,
        uint256 recipientAmount,
        uint256 protocolFee,
        bytes32 reference
    );
    event TreasuryUpdated(address indexed treasury);
    event FeeUpdated(uint16 feeBps);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error FeeTooHigh();
    error TransferFailed();
    error ReentrantCall();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address initialOwner, address payable initialTreasury, uint16 initialFeeBps) {
        if (initialOwner == address(0) || initialTreasury == address(0)) revert InvalidAddress();
        if (initialFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        owner = initialOwner;
        treasury = initialTreasury;
        feeBps = initialFeeBps;
        emit TreasuryUpdated(initialTreasury);
        emit FeeUpdated(initialFeeBps);
    }

    function quote(uint256 grossAmount) public view returns (uint256 recipientAmount, uint256 protocolFee) {
        protocolFee = (grossAmount * feeBps) / 10_000;
        recipientAmount = grossAmount - protocolFee;
    }

    /// @notice Pay with the native coin of the current EVM network (ETH, ZQ, POL, AVAX, etc.).
    function payNative(address payable recipient, bytes32 reference) external payable nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        if (msg.value == 0) revert InvalidAmount();
        (uint256 net, uint256 fee) = quote(msg.value);

        if (fee != 0) {
            (bool feeOk,) = treasury.call{value: fee}("");
            if (!feeOk) revert TransferFailed();
        }
        (bool recipientOk,) = recipient.call{value: net}("");
        if (!recipientOk) revert TransferFailed();

        emit SocialPayment(msg.sender, recipient, address(0), msg.value, net, fee, reference);
    }

    /// @notice Pay with an ERC-20 token after approving this router for `amount`.
    function payToken(address token, address recipient, uint256 amount, bytes32 reference) external nonReentrant {
        if (token == address(0) || recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        (uint256 net, uint256 fee) = quote(amount);

        _safeTransferFrom(token, msg.sender, recipient, net);
        if (fee != 0) _safeTransferFrom(token, msg.sender, treasury, fee);

        emit SocialPayment(msg.sender, recipient, token, amount, net, fee, reference);
    }

    function setTreasury(address payable nextTreasury) external onlyOwner {
        if (nextTreasury == address(0)) revert InvalidAddress();
        treasury = nextTreasury;
        emit TreasuryUpdated(nextTreasury);
    }

    function setFeeBps(uint16 nextFeeBps) external onlyOwner {
        if (nextFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = nextFeeBps;
        emit FeeUpdated(nextFeeBps);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert InvalidAddress();
        address previous = owner;
        owner = nextOwner;
        emit OwnershipTransferred(previous, nextOwner);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
