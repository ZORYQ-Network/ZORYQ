// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqTestnetFaucet.sol";

interface VmFaucet {
    function deal(address who, uint256 newBalance) external;
    function warp(uint256 newTimestamp) external;
}

contract FaucetCaller {
    function fulfill(ZoryqTestnetFaucet faucet, bytes32 claimId, address payable recipient) external {
        faucet.fulfill(claimId, recipient);
    }
}

contract ZoryqTestnetFaucetTest {
    VmFaucet constant vm = VmFaucet(address(uint160(uint256(keccak256("hevm cheat code")))));
    receive() external payable {}

    function deployFunded(uint256 amount, uint256 cooldown) internal returns (ZoryqTestnetFaucet faucet) {
        vm.deal(address(this), 1000 ether);
        faucet = new ZoryqTestnetFaucet{value: 500 ether}(address(this), address(this), amount, cooldown);
    }

    function testClaimTransfersNativeZQAndRecordsState() public {
        ZoryqTestnetFaucet faucet = deployFunded(100 ether, 1 days);
        uint256 beforeBalance = address(this).balance;
        bytes32 id = keccak256("claim-1");
        faucet.fulfill(id, payable(address(this)));
        require(address(this).balance == beforeBalance + 100 ether, "claim amount");
        require(faucet.fulfilledClaims(id), "claim recorded");
        require(faucet.lastClaimAt(address(this)) == block.timestamp, "last claim");
    }

    function testClaimIdCannotReplay() public {
        ZoryqTestnetFaucet faucet = deployFunded(100 ether, 0);
        bytes32 id = keccak256("replay");
        faucet.fulfill(id, payable(address(this)));
        bool reverted;
        try faucet.fulfill(id, payable(address(this))) {} catch { reverted = true; }
        require(reverted, "replay must revert");
    }

    function testRecipientCooldownAppliesAcrossClaimIds() public {
        ZoryqTestnetFaucet faucet = deployFunded(100 ether, 1 days);
        faucet.fulfill(keccak256("claim-a"), payable(address(this)));
        bool reverted;
        try faucet.fulfill(keccak256("claim-b"), payable(address(this))) {} catch { reverted = true; }
        require(reverted, "cooldown must revert");
        vm.warp(block.timestamp + 1 days);
        faucet.fulfill(keccak256("claim-c"), payable(address(this)));
        require(faucet.fulfilledClaims(keccak256("claim-c")), "claim after cooldown");
    }

    function testOnlyOperatorCanFulfill() public {
        ZoryqTestnetFaucet faucet = deployFunded(100 ether, 0);
        FaucetCaller caller = new FaucetCaller();
        bool reverted;
        try caller.fulfill(faucet, keccak256("unauthorized"), payable(address(this))) {} catch { reverted = true; }
        require(reverted, "non operator must revert");
    }

    function testPauseBlocksClaims() public {
        ZoryqTestnetFaucet faucet = deployFunded(100 ether, 0);
        faucet.setPaused(true);
        bool reverted;
        try faucet.fulfill(keccak256("paused"), payable(address(this))) {} catch { reverted = true; }
        require(reverted, "paused claim must revert");
    }

    function testOwnerCanRotateOperatorAndConfig() public {
        ZoryqTestnetFaucet faucet = deployFunded(100 ether, 1 days);
        address newOperator = address(0xBEEF);
        faucet.setOperator(newOperator);
        faucet.setClaimConfig(50 ether, 12 hours);
        require(faucet.operator() == newOperator, "operator");
        require(faucet.claimAmount() == 50 ether, "amount");
        require(faucet.cooldown() == 12 hours, "cooldown");
    }

    function testInsufficientBalanceDoesNotConsumeClaim() public {
        vm.deal(address(this), 10 ether);
        ZoryqTestnetFaucet faucet = new ZoryqTestnetFaucet{value: 1 ether}(address(this), address(this), 100 ether, 0);
        bytes32 id = keccak256("empty");
        bool reverted;
        try faucet.fulfill(id, payable(address(this))) {} catch { reverted = true; }
        require(reverted, "insufficient balance must revert");
        require(!faucet.fulfilledClaims(id), "claim must stay unused");
    }
}
