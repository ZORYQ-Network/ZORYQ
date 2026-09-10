// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqAutonomousCompanyV3.sol";

contract ZoryqAutonomousCompanyV3Test {
    function testAiPlanChangesRoutingWithinOnchainLimits() public {
        ZoryqAutonomousCompanyV3 c = new ZoryqAutonomousCompanyV3();
        uint256 companyId = c.launchCompany(
            "AI Commerce Studio",
            "Criar produtos digitais com planejamento de um AI CEO",
            100 * c.USD(),
            keccak256("Crie uma empresa digital com US$100.")
        );

        uint256[] memory ids = c.companyAgentIds(companyId);
        require(ids.length == 7, "seven agents");

        uint256[] memory payIds = new uint256[](4);
        uint256[] memory pay = new uint256[](4);
        payIds[0] = ids[6]; // developer lead
        payIds[1] = ids[1]; // marketing
        payIds[2] = ids[4]; // sales
        payIds[3] = ids[5]; // finance
        pay[0] = 5 * c.USD();
        pay[1] = 4 * c.USD();
        pay[2] = 3 * c.USD();
        pay[3] = 2 * c.USD();

        bytes32 planHash = keccak256("ai-plan-1");
        ZoryqAutonomousCompanyV3.AiPlanInput memory plan = ZoryqAutonomousCompanyV3.AiPlanInput({
            planHash: planHash,
            specHash: keccak256("spec-1"),
            executionEvidenceHash: keccak256("execution-evidence-1"),
            leadAgentId: ids[6],
            verifierAgentId: ids[3],
            expectedRevenue: 30 * c.USD(),
            paymentAgentIds: payIds,
            paymentAmounts: pay
        });

        uint256 jobId = c.runAiApprovedCycle(companyId, plan);
        require(jobId == 2, "second job");
        require(c.executedAiPlans(planHash), "replay flag");

        (
            , , , , , uint256 treasuryBalance, , uint256 revenue, uint256 expenses,
            uint256 profit, uint32 cycleCount, uint32 aiApprovedCycles, , , bool active, , uint32 humanInterventions
        ) = c.companySnapshot(companyId);
        require(treasuryBalance == 139 * c.USD(), "treasury after AI cycle");
        require(revenue == 70 * c.USD(), "revenue after AI cycle");
        require(expenses == 31 * c.USD(), "expenses after AI cycle");
        require(profit == 39 * c.USD(), "profit after AI cycle");
        require(cycleCount == 2 && aiApprovedCycles == 1, "AI cycle counters");
        require(active && humanInterventions == 0, "safety state");

        (
            , uint256 jobCompany, uint256 leadId, uint256 verifierId, uint256 marketValue,
            uint256 cost, bytes32 storedPlanHash, , bytes32 resultHash, bool aiPlanned, bool verified, bool settled
        ) = c.jobs(jobId);
        require(jobCompany == companyId, "job company");
        require(leadId == ids[6] && verifierId == ids[3], "AI route stored");
        require(marketValue == 30 * c.USD() && cost == 14 * c.USD(), "AI economics stored");
        require(storedPlanHash == planHash && resultHash != bytes32(0), "AI evidence stored");
        require(aiPlanned && verified && settled, "AI job complete");

        (bool replayOk,) = address(c).call(abi.encodeWithSelector(c.runAiApprovedCycle.selector, companyId, plan));
        require(!replayOk, "AI plan replay must fail");
    }

    function testAiPlanCannotBreakPerAgentOrCyclePolicy() public {
        ZoryqAutonomousCompanyV3 c = new ZoryqAutonomousCompanyV3();
        uint256 companyId = c.launchCompany("Policy Studio", "Validate AI policy boundaries", 100 * c.USD(), keccak256("policy"));
        uint256[] memory ids = c.companyAgentIds(companyId);

        uint256[] memory payIds = new uint256[](1);
        uint256[] memory pay = new uint256[](1);
        payIds[0] = ids[6];
        pay[0] = 6 * c.USD(); // developer limit is 5 dUSD

        ZoryqAutonomousCompanyV3.AiPlanInput memory plan = ZoryqAutonomousCompanyV3.AiPlanInput({
            planHash: keccak256("bad-plan"),
            specHash: keccak256("bad-spec"),
            executionEvidenceHash: keccak256("bad-evidence"),
            leadAgentId: ids[6],
            verifierAgentId: ids[3],
            expectedRevenue: 20 * c.USD(),
            paymentAgentIds: payIds,
            paymentAmounts: pay
        });
        (bool ok,) = address(c).call(abi.encodeWithSelector(c.runAiApprovedCycle.selector, companyId, plan));
        require(!ok, "model must not exceed developer limit");

        pay[0] = 5 * c.USD();
        plan.planHash = keccak256("bad-separation");
        plan.verifierAgentId = ids[6];
        (ok,) = address(c).call(abi.encodeWithSelector(c.runAiApprovedCycle.selector, companyId, plan));
        require(!ok, "lead cannot self-verify");
    }
}
