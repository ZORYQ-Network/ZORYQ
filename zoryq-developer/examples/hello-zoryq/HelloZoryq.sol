// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HelloZoryq
/// @notice Minimal contract for verifying a builder's first ZORYQ deployment.
contract HelloZoryq {
    address public immutable creator;
    string public message;
    uint256 public updates;

    event MessageUpdated(address indexed account, string message, uint256 updateNumber);

    constructor(string memory initialMessage) {
        creator = msg.sender;
        message = initialMessage;
        emit MessageUpdated(msg.sender, initialMessage, 0);
    }

    function setMessage(string calldata nextMessage) external {
        require(bytes(nextMessage).length > 0, "empty_message");
        message = nextMessage;
        updates += 1;
        emit MessageUpdated(msg.sender, nextMessage, updates);
    }
}
