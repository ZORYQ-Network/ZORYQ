// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqAutonomousEconomy.sol";

interface VmAutonomous {
    function deal(address who, uint256 newBalance) external;
    function prank(address msgSender) external;
}

contract ZoryqAutonomousEconomyTest {
    VmAutonomous constant vm = VmAutonomous(address(uint160(uint256(keccak256("hevm cheat code")))));
    receive() external payable {}

    function testProofOfAgentAndOrganizationPolicySpend() public {
        ZoryqAutonomousEconomy e = new ZoryqAutonomousEconomy();
        address finance = address(0xF100);
        address vendor = address(0xBEEF);
        vm.deal(address(this), 30 ether);

        vm.prank(finance);
        e.registerAgent(bytes32("AI Finance"), keccak256("finance-meta"), keccak256("payments"));

        uint256 orgId = e.createOrganization(bytes32("Demo Studio"), keccak256("studio-meta"), 20 ether);
        e.fundOrganization{value: 10 ether}(orgId);
        e.setAgentPolicy(orgId, finance, e.ROLE_FINANCE(), 2 ether, 5 ether, true);

        uint256 beforeVendor = vendor.balance;
        vm.prank(finance);
        e.agentSpend(orgId, payable(vendor), 1 ether, keccak256("compute"), keccak256("api invoice 1"));
        require(vendor.balance == beforeVendor + 1 ether, "vendor not paid");

        (, , uint256 orgBalance, , , , uint256 lifetimeOut, ) = e.organizationSummary(orgId);
        require(orgBalance == 9 ether, "org balance");
        require(lifetimeOut == 1 ether, "org out");

        (, , , , , , uint256 grossSpent, bool active) = e.agentSummary(finance);
        require(active, "finance active");
        require(grossSpent == 1 ether, "agent spend accounting");

        vm.prank(finance);
        (bool ok,) = address(e).call(
            abi.encodeWithSelector(
                e.agentSpend.selector,
                orgId,
                payable(vendor),
                3 ether,
                keccak256("compute"),
                keccak256("over per tx limit")
            )
        );
        require(!ok, "per-tx limit should block overspend");
    }

    function testOrganizationTaskMarketplaceEscrowAndReputation() public {
        ZoryqAutonomousEconomy e = new ZoryqAutonomousEconomy();
        address worker = address(0xA11CE);
        vm.deal(address(this), 30 ether);

        vm.prank(worker);
        e.registerAgent(bytes32("AI Designer"), keccak256("designer-meta"), keccak256("design-copy"));

        uint256 orgId = e.createOrganization(bytes32("Campaign DAO"), keccak256("campaign-org"), 10 ether);
        e.fundOrganization{value: 8 ether}(orgId);
        uint256 taskId = e.createTask(orgId, keccak256("Create ZORYQ launch campaign"), 2 ether, uint64(block.timestamp + 1 days));

        vm.prank(worker);
        e.bidForTask(taskId, 15 ether / 10, keccak256("proposal-v1"));
        e.assignTask(taskId, worker);

        vm.prank(worker);
        e.submitTask(taskId, keccak256("ipfs://campaign-result"));
        uint256 workerBefore = worker.balance;
        e.settleTask(taskId);
        require(worker.balance == workerBefore + 15 ether / 10, "worker payment");

        (, , uint256 orgBalance, , , , uint256 lifetimeOut, ) = e.organizationSummary(orgId);
        require(orgBalance == 65 ether / 10, "unused escrow should return");
        require(lifetimeOut == 15 ether / 10, "settled accounting");

        (, , uint256 reputation, uint256 successes, , uint256 earned, , bool active) = e.agentSummary(worker);
        require(active, "worker active");
        require(successes == 1, "success count");
        require(reputation == 5100, "reputation update");
        require(earned == 15 ether / 10, "earnings update");

        (, , , , , , , uint256 escrowed, , ZoryqAutonomousEconomy.TaskStatus status) = e.taskSummary(taskId);
        require(escrowed == 0, "escrow cleared");
        require(status == ZoryqAutonomousEconomy.TaskStatus.Settled, "task settled");
    }

    function testAssignedCancellationRefundsEscrowAndRecordsWorkerFailure() public {
        ZoryqAutonomousEconomy e = new ZoryqAutonomousEconomy();
        address worker = address(0xCA11CE);
        vm.deal(address(this), 30 ether);

        vm.prank(worker);
        e.registerAgent(bytes32("AI Worker"), keccak256("worker-meta"), keccak256("worker-capabilities"));

        uint256 orgId = e.createOrganization(bytes32("Cancellation DAO"), keccak256("cancel-org"), 10 ether);
        e.fundOrganization{value: 8 ether}(orgId);
        uint256 taskId = e.createTask(orgId, keccak256("Cancelable assigned task"), 2 ether, uint64(block.timestamp + 1 days));

        vm.prank(worker);
        e.bidForTask(taskId, 1 ether, keccak256("cancel-proposal"));
        e.assignTask(taskId, worker);

        (, , uint256 beforeCancelBalance, , , , , ) = e.organizationSummary(orgId);
        require(beforeCancelBalance == 6 ether, "escrow should leave org balance");

        e.cancelTask(taskId);

        (, , uint256 afterCancelBalance, , , , , ) = e.organizationSummary(orgId);
        require(afterCancelBalance == 8 ether, "full escrow should return to org");

        (, , , uint256 successes, uint256 failures, uint256 earned, , bool active) = e.agentSummary(worker);
        require(active, "worker active");
        require(successes == 0, "cancelled task must not count as success");
        require(failures == 1, "assigned cancellation must count worker failure");
        require(earned == 0, "cancelled task must not pay worker");

        (, , address assignedWorker, , , , , uint256 escrowed, , ZoryqAutonomousEconomy.TaskStatus status) = e.taskSummary(taskId);
        require(assignedWorker == worker, "worker assignment should remain auditable");
        require(escrowed == 0, "cancelled escrow must be cleared");
        require(status == ZoryqAutonomousEconomy.TaskStatus.Cancelled, "task cancelled");
    }

    function testDirectAgentToAgentEconomy() public {
        ZoryqAutonomousEconomy e = new ZoryqAutonomousEconomy();
        address manager = address(0xA001);
        address worker = address(0xA002);
        vm.deal(manager, 10 ether);

        vm.prank(manager);
        e.registerAgent(bytes32("AI Manager"), keccak256("manager"), keccak256("coordination"));
        vm.prank(worker);
        e.registerAgent(bytes32("AI Analyst"), keccak256("analyst"), keccak256("analysis"));

        vm.prank(manager);
        uint256 taskId = e.createDirectTask{value: 2 ether}(keccak256("Analyze 5M records"), 2 ether, uint64(block.timestamp + 2 days));

        vm.prank(worker);
        e.bidForTask(taskId, 12 ether / 10, keccak256("analysis proposal"));
        vm.prank(manager);
        e.assignTask(taskId, worker);
        vm.prank(worker);
        e.submitTask(taskId, keccak256("analysis delivered"));

        uint256 workerBefore = worker.balance;
        uint256 managerBefore = manager.balance;
        vm.prank(manager);
        e.settleTask(taskId);
        require(worker.balance == workerBefore + 12 ether / 10, "agent B paid");
        require(manager.balance == managerBefore + 8 ether / 10, "agent A refund");

        (, , , uint256 successes, , uint256 earned, , ) = e.agentSummary(worker);
        require(successes == 1, "direct success");
        require(earned == 12 ether / 10, "direct earnings");
    }
}
