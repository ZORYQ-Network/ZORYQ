// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ZQ Migration Escrow
/// @notice Locks pre-mainnet ZQ and records a 1:1 native ZORYQ Mainnet entitlement.
/// @dev Destination address is stored as text so the native zq1... format can be validated off-chain
///      before the final ZORYQ mainnet address codec is frozen.
contract ZQMigrationEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public totalLocked;
    uint256 public migrationCount;

    mapping(bytes32 => bool) public usedMigrationId;

    event MigrationLocked(
        bytes32 indexed migrationId,
        address indexed sender,
        uint256 amount,
        string zoryqDestination,
        uint256 sequence
    );

    error ZeroToken();
    error ZeroAmount();
    error InvalidDestination();

    constructor(IERC20 zqToken) {
        if (address(zqToken) == address(0)) revert ZeroToken();
        token = zqToken;
    }

    function migrate(uint256 amount, string calldata zoryqDestination)
        external
        nonReentrant
        returns (bytes32 migrationId)
    {
        if (amount == 0) revert ZeroAmount();
        bytes memory destination = bytes(zoryqDestination);
        if (destination.length < 8 || destination.length > 128) revert InvalidDestination();

        uint256 sequence = ++migrationCount;
        migrationId = keccak256(
            abi.encode(block.chainid, address(this), msg.sender, amount, zoryqDestination, sequence)
        );

        token.safeTransferFrom(msg.sender, address(this), amount);
        totalLocked += amount;
        usedMigrationId[migrationId] = true;

        emit MigrationLocked(migrationId, msg.sender, amount, zoryqDestination, sequence);
    }
}
