// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqTestnetExchangeVault.sol";
import "../src/ZoryqTestnetDistributor.sol";

interface VmSepolia {
    function deal(address who, uint256 newBalance) external;
}

contract RejectEther {
    receive() external payable { revert("reject"); }
}

contract UnauthorizedActor {
    function pauseVault(ZoryqTestnetExchangeVault vault) external returns (bool) {
        (bool ok,) = address(vault).call(abi.encodeWithSelector(vault.setPaused.selector, true));
        return ok;
    }

    function fulfillDistributor(ZoryqTestnetDistributor distributor, bytes32 id, address payable recipient, uint256 amount) external returns (bool) {
        (bool ok,) = address(distributor).call(abi.encodeWithSelector(distributor.fulfill.selector, id, recipient, amount));
        return ok;
    }
}

contract ReentrantOperator {
    ZoryqTestnetDistributor public distributor;
    bytes32 public nestedId;
    bool public attempted;

    function configure(ZoryqTestnetDistributor d, bytes32 id) external {
        distributor = d;
        nestedId = id;
    }

    function execute(bytes32 id, uint256 amount) external {
        distributor.fulfill(id, payable(address(this)), amount);
    }

    receive() external payable {
        if (!attempted) {
            attempted = true;
            distributor.fulfill(nestedId, payable(address(this)), 1 wei);
        }
    }
}

contract ZoryqSepoliaExchangeTest {
    VmSepolia constant vm = VmSepolia(address(uint160(uint256(keccak256("hevm cheat code")))));
    receive() external payable {}

    function testVaultDepositLimitsPauseAndDirectEthRejection() public {
        vm.deal(address(this), 10 ether);
        ZoryqTestnetExchangeVault vault = new ZoryqTestnetExchangeVault(address(this), 0.01 ether, 0.10 ether);

        uint256 id = vault.deposit{value: 0.02 ether}(address(0xBEEF));
        require(id == 1, "deposit id");
        require(vault.nextDepositId() == 2, "next id");
        require(address(vault).balance == 0.02 ether, "deposit balance");

        (bool belowMin,) = address(vault).call{value: 0.001 ether}(abi.encodeWithSelector(vault.deposit.selector, address(0xBEEF)));
        require(!belowMin, "below min accepted");
        (bool aboveMax,) = address(vault).call{value: 0.11 ether}(abi.encodeWithSelector(vault.deposit.selector, address(0xBEEF)));
        require(!aboveMax, "above max accepted");
        (bool zeroRecipient,) = address(vault).call{value: 0.02 ether}(abi.encodeWithSelector(vault.deposit.selector, address(0)));
        require(!zeroRecipient, "zero recipient accepted");

        (bool direct,) = address(vault).call{value: 0.02 ether}("");
        require(!direct, "direct eth accepted");

        vault.setPaused(true);
        (bool pausedDeposit,) = address(vault).call{value: 0.02 ether}(abi.encodeWithSelector(vault.deposit.selector, address(0xBEEF)));
        require(!pausedDeposit, "paused deposit accepted");
    }

    function testVaultOwnershipAndWithdrawalControls() public {
        vm.deal(address(this), 10 ether);
        ZoryqTestnetExchangeVault vault = new ZoryqTestnetExchangeVault(address(this), 0.01 ether, 0.10 ether);
        vault.deposit{value: 0.05 ether}(address(0xCAFE));

        UnauthorizedActor actor = new UnauthorizedActor();
        require(!actor.pauseVault(vault), "unauthorized pause");

        uint256 beforeBalance = address(this).balance;
        vault.withdraw(payable(address(this)), 0.02 ether);
        require(address(vault).balance == 0.03 ether, "withdraw balance");
        require(address(this).balance == beforeBalance + 0.02 ether, "withdraw recipient");

        vault.transferOwnership(address(actor));
        require(vault.owner() == address(actor), "ownership transfer");
        (bool oldOwnerPause,) = address(vault).call(abi.encodeWithSelector(vault.setPaused.selector, true));
        require(!oldOwnerPause, "old owner retained privilege");
    }

    function testDistributorOperatorReplayCapAndPause() public {
        vm.deal(address(this), 10 ether);
        ZoryqTestnetDistributor distributor = new ZoryqTestnetDistributor{value: 2 ether}(address(this), address(this), 1 ether);
        address payable recipient = payable(address(0xBEEF));
        bytes32 id = keccak256("sepolia-deposit-1");

        uint256 beforeRecipient = recipient.balance;
        distributor.fulfill(id, recipient, 0.5 ether);
        require(distributor.fulfilled(id), "not fulfilled");
        require(recipient.balance == beforeRecipient + 0.5 ether, "recipient not paid");

        (bool replay,) = address(distributor).call(abi.encodeWithSelector(distributor.fulfill.selector, id, recipient, 0.1 ether));
        require(!replay, "replay accepted");

        (bool overCap,) = address(distributor).call(abi.encodeWithSelector(distributor.fulfill.selector, keccak256("over-cap"), recipient, 1.1 ether));
        require(!overCap, "over cap accepted");

        distributor.setPaused(true);
        (bool pausedFulfill,) = address(distributor).call(abi.encodeWithSelector(distributor.fulfill.selector, keccak256("paused"), recipient, 0.1 ether));
        require(!pausedFulfill, "paused fulfill accepted");
    }

    function testDistributorRejectsUnauthorizedOperator() public {
        vm.deal(address(this), 10 ether);
        ZoryqTestnetDistributor distributor = new ZoryqTestnetDistributor{value: 1 ether}(address(this), address(this), 0.5 ether);
        UnauthorizedActor actor = new UnauthorizedActor();
        bool ok = actor.fulfillDistributor(distributor, keccak256("unauthorized"), payable(address(0xBEEF)), 0.1 ether);
        require(!ok, "unauthorized operator accepted");
    }

    function testDistributorFailedTransferRollsBackReplayMark() public {
        vm.deal(address(this), 10 ether);
        ZoryqTestnetDistributor distributor = new ZoryqTestnetDistributor{value: 1 ether}(address(this), address(this), 0.5 ether);
        RejectEther rejector = new RejectEther();
        bytes32 id = keccak256("reject-transfer");

        (bool ok,) = address(distributor).call(abi.encodeWithSelector(distributor.fulfill.selector, id, payable(address(rejector)), 0.1 ether));
        require(!ok, "rejecting recipient accepted");
        require(!distributor.fulfilled(id), "failed transfer consumed id");
    }

    function testDistributorReentrancyRollsBackOuterFulfillment() public {
        vm.deal(address(this), 10 ether);
        ReentrantOperator operator = new ReentrantOperator();
        ZoryqTestnetDistributor distributor = new ZoryqTestnetDistributor{value: 1 ether}(address(this), address(operator), 0.5 ether);
        bytes32 outerId = keccak256("outer");
        bytes32 nestedId = keccak256("nested");
        operator.configure(distributor, nestedId);

        (bool ok,) = address(operator).call(abi.encodeWithSelector(operator.execute.selector, outerId, 0.1 ether));
        require(!ok, "reentrant fulfillment succeeded");
        require(!distributor.fulfilled(outerId), "outer id consumed");
        require(!distributor.fulfilled(nestedId), "nested id consumed");
    }

    function testDistributorEmergencyWithdrawalAndOwnership() public {
        vm.deal(address(this), 10 ether);
        ZoryqTestnetDistributor distributor = new ZoryqTestnetDistributor{value: 1 ether}(address(this), address(this), 0.5 ether);
        uint256 beforeBalance = address(this).balance;
        distributor.emergencyWithdraw(payable(address(this)), 0.25 ether);
        require(address(distributor).balance == 0.75 ether, "emergency balance");
        require(address(this).balance == beforeBalance + 0.25 ether, "emergency recipient");

        UnauthorizedActor actor = new UnauthorizedActor();
        distributor.transferOwnership(address(actor));
        require(distributor.owner() == address(actor), "owner transfer");
        (bool oldOwnerSetCap,) = address(distributor).call(abi.encodeWithSelector(distributor.setMaxFulfillment.selector, 0.25 ether));
        require(!oldOwnerSetCap, "old owner retained privilege");
    }
}
