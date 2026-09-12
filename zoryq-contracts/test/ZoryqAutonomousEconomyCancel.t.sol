// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqAutonomousEconomy.sol";

interface VmAutonomousCancel {
    function deal(address who, uint256 newBalance) external;
    function prank(address msgSender) external;
}

contract ZoryqAutonomousEconomyCancelTest {
    VmAutonomousCancel constant vm = VmAutonomousCancel(address(uint160(uint256(keccak256("hevm cheat code")))));
    receive() external payable {}

    function testAssignedCancellationRestoresEscrowAndCountsWorkerFailure() public {
        ZoryqAutonomousEconomy e = new ZoryqAutonomousEconomy();
        address worker = address(0xA11CE);
        vm.deal(address(this), 10 ether);

        vm.prank(worker);
        e.registerAgent(bytes32("AI Worker"), keccak256("worker-meta"), keccak256("research-build"));

        uint256 orgId = e.createOrganization(bytes32("Autonomous Co"), keccak256("goal-policy-v1"), 5 ether);
        e.fundOrganization{value: 4 ether}(orgId);
        uint256 taskId = e.createTask(orgId, keccak256("bounded task"), 1 ether, uint64(block.timestamp + 1 days));

        vm.prank(worker);
        e.bidForTask(taskId, 8 ether / 10, keccak256("worker-proposal"));
        e.assignTask(taskId, worker);

        (, , uint256 balanceBeforeCancel, , , , , ) = e.organizationSummary(orgId);
        require(balanceBeforeCancel == 3 ether, "escrow must leave org balance while task is open");

        (, , , , uint256 failedBefore, , , ) = e.agentSummary(worker);
        require(failedBefore == 0, "unexpected initial failure count");

        e.cancelTask(taskId);

        (, , uint256 balanceAfterCancel, , , , , ) = e.organizationSummary(orgId);
        require(balanceAfterCancel == 4 ether, "full escrow must return to organization");

        (, , , , uint256 failedAfter, , , ) = e.agentSummary(worker);
        require(failedAfter == 1, "assigned cancellation must count worker failure");

        (, , , , , , , uint256 escrowed, , ZoryqAutonomousEconomy.TaskStatus status) = e.taskSummary(taskId);
        require(escrowed == 0, "escrow must be cleared");
        require(status == ZoryqAutonomousEconomy.TaskStatus.Cancelled, "task must be cancelled");
    }
}
