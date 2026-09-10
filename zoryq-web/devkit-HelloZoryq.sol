// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract HelloZoryq {
    string public message = "Hello ZORYQ";
    address public immutable builder = msg.sender;

    event MessageChanged(address indexed builder, string next);

    function setMessage(string calldata next) external {
        message = next;
        emit MessageChanged(msg.sender, next);
    }
}
