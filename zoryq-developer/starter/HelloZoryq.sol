// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract HelloZoryq {
    string public message = "Hello ZORYQ";
    uint256 public writes;

    event MessageUpdated(address indexed sender, string message, uint256 writes);

    function setMessage(string calldata newMessage) external {
        require(bytes(newMessage).length > 0 && bytes(newMessage).length <= 140, "invalid_message");
        message = newMessage;
        writes += 1;
        emit MessageUpdated(msg.sender, newMessage, writes);
    }
}
