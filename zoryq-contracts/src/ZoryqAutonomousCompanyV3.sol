// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ZoryqAutonomousCompanyV2.sol";

/// @title ZORYQ Autonomous Company v3
/// @notice Public-testnet company whose next-cycle strategy can be generated offchain by an AI CEO and approved onchain by the owner.
/// @dev The AI never receives custody of the owner's key. The contract enforces company membership, role permissions, per-agent limits,
///      total operating-cost limits, revenue bounds, replay protection and an owner-controlled emergency stop.
contract ZoryqAutonomousCompanyV3 {
    uint256 public constant USD = 1_000_000;
    uint256 public constant BOOTSTRAP_REVENUE = 40 * USD;
    uint256 public constant BOOTSTRAP_COST = 17 * USD;
    uint256 public constant MAX_AI_REVENUE_PER_CYCLE = 100 * USD;
    uint256 public constant MAX_AI_OPERATING_COST_PER_CYCLE = 25 * USD;
    uint256 public constant MAX_CYCLES = 25;

    uint32 public constant PERM_ROUTE = 1 << 0;
    uint32 public constant PERM_HIRE = 1 << 1;
    uint32 public constant PERM_PAY = 1 << 2;
    uint32 public constant PERM_MARKET = 1 << 3;
    uint32 public constant PERM_EXECUTE = 1 << 4;
    uint32 public constant PERM_VERIFY = 1 << 5;
    uint32 public constant PERM_DEPLOY = 1 << 6;
    uint32 public constant PERM_EMERGENCY = 1 << 7;

    ZoryqDemoUSDV2 public immutable demoUsd;
    uint256 public companyCount;
    uint256 public agentCount;
    uint256 public jobCount;

    struct Agent {
        uint256 id;
        uint256 companyId;
        address vault;
        bytes32 role;
        uint32 permissions;
        uint32 reputationBps;
        uint32 jobsCompleted;
        uint256 perCycleLimit;
        uint256 earned;
        bool active;
    }

    struct Company {
        uint256 id;
        address owner;
        address treasury;
        string name;
        string objective;
        bytes32 promptHash;
        bytes32 constitutionHash;
        uint256 initialBudget;
        uint256 revenue;
        uint256 expenses;
        uint16 treasuryRetentionBps;
        uint32 cycleCount;
        uint32 aiApprovedCycles;
        uint32 humanInterventions;
        bool emergencyStopEnabled;
        bool active;
    }

    struct Job {
        uint256 id;
        uint256 companyId;
        uint256 leadAgentId;
        uint256 verifierAgentId;
        uint256 marketValue;
        uint256 cost;
        bytes32 planHash;
        bytes32 specHash;
        bytes32 resultHash;
        bool aiPlanned;
        bool verified;
        bool settled;
    }

    struct AiPlanInput {
        bytes32 planHash;
        bytes32 specHash;
        bytes32 executionEvidenceHash;
        uint256 leadAgentId;
        uint256 verifierAgentId;
        uint256 expectedRevenue;
        uint256[] paymentAgentIds;
        uint256[] paymentAmounts;
    }

    mapping(uint256 => Company) public companies;
    mapping(uint256 => Agent) public agents;
    mapping(uint256 => Job) public jobs;
    mapping(bytes32 => bool) public executedAiPlans;
    mapping(uint256 => uint256[]) private _companyAgents;

    event CompanyCreated(uint256 indexed companyId, address indexed owner, address treasury, string name, string objective, uint256 budget, bytes32 promptHash);
    event TreasuryOpened(uint256 indexed companyId, address treasury, address demoUsd, uint256 startingBalance);
    event ConstitutionInstalled(uint256 indexed companyId, bytes32 constitutionHash, string rules);
    event RevenuePolicyInstalled(uint256 indexed companyId, uint16 treasuryRetentionBps, uint256 maxOperatingCostPerCycle, uint256 maxSyntheticRevenuePerCycle);
    event EmergencyStopConfigured(uint256 indexed companyId, bool enabled);
    event AgentCreated(uint256 indexed companyId, uint256 indexed agentId, bytes32 indexed role, address vault, uint32 permissions, uint256 perCycleLimit, uint32 reputationBps);
    event AiPlanApproved(uint256 indexed companyId, uint256 indexed jobId, bytes32 indexed planHash, address approver, uint256 leadAgentId, uint256 verifierAgentId, uint256 expectedRevenue, uint256 totalCost);
    event AiPlanExecutionEvidence(uint256 indexed companyId, uint256 indexed jobId, bytes32 indexed planHash, bytes32 specHash, bytes32 executionEvidenceHash);
    event WorkDiscovered(uint256 indexed companyId, uint256 indexed jobId, uint256 marketValue, bytes32 specHash);
    event AgentHired(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed agentId, bytes32 role, uint256 plannedPayment);
    event WorkExecuted(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed agentId, bytes32 resultHash);
    event WorkVerified(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed verifierAgentId, bytes32 resultHash);
    event AgentPaid(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed agentId, address vault, uint256 amount);
    event RevenueGenerated(uint256 indexed companyId, uint256 indexed jobId, uint256 amount, uint256 treasuryBalance);
    event ReputationUpdated(uint256 indexed companyId, uint256 indexed agentId, uint32 reputationBps, uint32 jobsCompleted);
    event CycleCompleted(uint256 indexed companyId, uint256 indexed jobId, uint32 cycleCount, uint256 revenue, uint256 expenses, uint256 treasuryBalance, bool aiPlanned);
    event EmergencyStopTriggered(uint256 indexed companyId, address indexed owner, uint32 humanInterventions);
    event CompanyResumed(uint256 indexed companyId, address indexed owner, uint32 humanInterventions);

    constructor() {
        demoUsd = new ZoryqDemoUSDV2(address(this));
        demoUsd.mint(address(this), 10_000_000 * USD);
    }

    /// @notice Creates the company, seven bounded role vaults and one deterministic bootstrap cycle.
    function launchCompany(string calldata companyName, string calldata objective, uint256 budgetUsd6, bytes32 promptHash) external returns (uint256 companyId) {
        require(bytes(companyName).length >= 2 && bytes(companyName).length <= 80, "invalid name");
        require(bytes(objective).length >= 4 && bytes(objective).length <= 280, "invalid objective");
        require(budgetUsd6 >= 25 * USD && budgetUsd6 <= 10_000 * USD, "invalid budget");
        require(promptHash != bytes32(0), "prompt required");

        companyId = ++companyCount;
        ZoryqCompanyTreasuryV2 treasury = new ZoryqCompanyTreasuryV2(address(this), msg.sender, demoUsd);
        bytes32 constitutionHash = keccak256(abi.encode(
            "ZORYQ_AUTONOMOUS_COMPANY_CONSTITUTION_V3",
            msg.sender,
            companyId,
            companyName,
            objective,
            budgetUsd6,
            promptHash,
            "AI proposes; owner approves; contract enforces role and spending policy; verifier separated from lead; owner can emergency-stop"
        ));

        companies[companyId] = Company({
            id: companyId,
            owner: msg.sender,
            treasury: address(treasury),
            name: companyName,
            objective: objective,
            promptHash: promptHash,
            constitutionHash: constitutionHash,
            initialBudget: budgetUsd6,
            revenue: 0,
            expenses: 0,
            treasuryRetentionBps: 10_000,
            cycleCount: 0,
            aiApprovedCycles: 0,
            humanInterventions: 0,
            emergencyStopEnabled: true,
            active: true
        });

        demoUsd.mint(address(treasury), budgetUsd6);
        emit CompanyCreated(companyId, msg.sender, address(treasury), companyName, objective, budgetUsd6, promptHash);
        emit TreasuryOpened(companyId, address(treasury), address(demoUsd), budgetUsd6);
        emit ConstitutionInstalled(companyId, constitutionHash, "AI CEO proposes plans; owner signs; onchain policy bounds every approved economic cycle");
        emit RevenuePolicyInstalled(companyId, 10_000, MAX_AI_OPERATING_COST_PER_CYCLE, MAX_AI_REVENUE_PER_CYCLE);
        emit EmergencyStopConfigured(companyId, true);

        _createAgent(companyId, bytes32("AI_CEO"), PERM_ROUTE | PERM_HIRE | PERM_EMERGENCY, 10 * USD);
        _createAgent(companyId, bytes32("AI_MARKETING"), PERM_MARKET | PERM_HIRE, 5 * USD);
        _createAgent(companyId, bytes32("AI_DESIGNER"), PERM_EXECUTE, 3 * USD);
        _createAgent(companyId, bytes32("AI_RESEARCH"), PERM_EXECUTE | PERM_VERIFY, 2 * USD);
        _createAgent(companyId, bytes32("AI_SALES"), PERM_MARKET | PERM_HIRE, 3 * USD);
        _createAgent(companyId, bytes32("AI_FINANCE"), PERM_PAY | PERM_VERIFY, 15 * USD);
        _createAgent(companyId, bytes32("AI_DEVELOPER"), PERM_EXECUTE | PERM_DEPLOY | PERM_HIRE, 5 * USD);

        _runBootstrapCycle(companyId);
    }

    /// @notice Executes an AI-generated plan only after the company owner explicitly approves it with a wallet transaction.
    /// @dev All economic fields are revalidated onchain; a model response cannot bypass contract policy.
    function runAiApprovedCycle(uint256 companyId, AiPlanInput calldata plan) external returns (uint256 jobId) {
        Company storage c = companies[companyId];
        require(c.owner == msg.sender, "owner only");
        require(c.active, "company stopped");
        require(c.cycleCount < MAX_CYCLES, "cycle cap reached");
        require(plan.planHash != bytes32(0) && plan.specHash != bytes32(0) && plan.executionEvidenceHash != bytes32(0), "plan evidence required");
        require(!executedAiPlans[plan.planHash], "plan already executed");
        require(plan.paymentAgentIds.length == plan.paymentAmounts.length, "payment length");
        require(plan.paymentAgentIds.length > 0 && plan.paymentAgentIds.length <= 7, "payment count");
        require(plan.expectedRevenue > 0 && plan.expectedRevenue <= MAX_AI_REVENUE_PER_CYCLE, "revenue bound");
        require(_isCompanyAgent(companyId, plan.leadAgentId), "lead outside company");
        require(_isCompanyAgent(companyId, plan.verifierAgentId), "verifier outside company");
        require(plan.leadAgentId != plan.verifierAgentId, "separation of duties");

        Agent storage lead = agents[plan.leadAgentId];
        Agent storage verifier = agents[plan.verifierAgentId];
        require(lead.active && (lead.permissions & PERM_EXECUTE) != 0, "lead cannot execute");
        require(verifier.active && (verifier.permissions & PERM_VERIFY) != 0, "verifier cannot verify");

        uint256 totalCost;
        bool leadPaid;
        for (uint256 i = 0; i < plan.paymentAgentIds.length; i++) {
            uint256 agentId = plan.paymentAgentIds[i];
            uint256 amount = plan.paymentAmounts[i];
            require(_isCompanyAgent(companyId, agentId), "payment outside company");
            Agent storage a = agents[agentId];
            require(a.active, "agent inactive");
            require(amount > 0 && amount <= a.perCycleLimit, "agent payment limit");
            for (uint256 j = 0; j < i; j++) require(plan.paymentAgentIds[j] != agentId, "duplicate payment");
            totalCost += amount;
            if (agentId == plan.leadAgentId) leadPaid = true;
        }
        require(leadPaid, "lead must be paid");
        require(totalCost <= MAX_AI_OPERATING_COST_PER_CYCLE, "cycle cost bound");
        require(plan.expectedRevenue >= totalCost, "negative synthetic margin");
        require(demoUsd.balanceOf(c.treasury) >= totalCost, "treasury below cost");

        executedAiPlans[plan.planHash] = true;
        jobId = ++jobCount;
        jobs[jobId] = Job({
            id: jobId,
            companyId: companyId,
            leadAgentId: plan.leadAgentId,
            verifierAgentId: plan.verifierAgentId,
            marketValue: plan.expectedRevenue,
            cost: totalCost,
            planHash: plan.planHash,
            specHash: plan.specHash,
            resultHash: plan.executionEvidenceHash,
            aiPlanned: true,
            verified: false,
            settled: false
        });

        emit AiPlanApproved(companyId, jobId, plan.planHash, msg.sender, plan.leadAgentId, plan.verifierAgentId, plan.expectedRevenue, totalCost);
        emit WorkDiscovered(companyId, jobId, plan.expectedRevenue, plan.specHash);
        for (uint256 i = 0; i < plan.paymentAgentIds.length; i++) {
            uint256 agentId = plan.paymentAgentIds[i];
            emit AgentHired(companyId, jobId, agentId, agents[agentId].role, plan.paymentAmounts[i]);
        }
        emit WorkExecuted(companyId, jobId, plan.leadAgentId, plan.executionEvidenceHash);
        jobs[jobId].verified = true;
        emit WorkVerified(companyId, jobId, plan.verifierAgentId, plan.executionEvidenceHash);
        emit AiPlanExecutionEvidence(companyId, jobId, plan.planHash, plan.specHash, plan.executionEvidenceHash);

        for (uint256 i = 0; i < plan.paymentAgentIds.length; i++) {
            _payAgent(c, jobId, plan.paymentAgentIds[i], plan.paymentAmounts[i]);
            _rewardReputation(companyId, plan.paymentAgentIds[i], plan.paymentAgentIds[i] == plan.leadAgentId ? 100 : 60, true);
        }
        _rewardReputation(companyId, plan.verifierAgentId, 80, false);

        require(demoUsd.transfer(c.treasury, plan.expectedRevenue), "synthetic revenue transfer failed");
        c.expenses += totalCost;
        c.revenue += plan.expectedRevenue;
        c.cycleCount += 1;
        c.aiApprovedCycles += 1;
        jobs[jobId].settled = true;

        uint256 treasuryBalance = demoUsd.balanceOf(c.treasury);
        emit RevenueGenerated(companyId, jobId, plan.expectedRevenue, treasuryBalance);
        emit CycleCompleted(companyId, jobId, c.cycleCount, c.revenue, c.expenses, treasuryBalance, true);
    }

    function triggerEmergencyStop(uint256 companyId) external {
        Company storage c = companies[companyId];
        require(c.owner == msg.sender, "owner only");
        require(c.emergencyStopEnabled, "stop disabled");
        require(c.active, "already stopped");
        c.active = false;
        c.humanInterventions += 1;
        emit EmergencyStopTriggered(companyId, msg.sender, c.humanInterventions);
    }

    function resumeCompany(uint256 companyId) external {
        Company storage c = companies[companyId];
        require(c.owner == msg.sender, "owner only");
        require(!c.active, "already active");
        c.active = true;
        c.humanInterventions += 1;
        emit CompanyResumed(companyId, msg.sender, c.humanInterventions);
    }

    function companyAgentIds(uint256 companyId) external view returns (uint256[] memory) {
        return _companyAgents[companyId];
    }

    function companySnapshot(uint256 companyId) external view returns (
        string memory name,
        string memory objective,
        address owner,
        address treasury,
        address token,
        uint256 treasuryBalance,
        uint256 initialBudget,
        uint256 revenue,
        uint256 expenses,
        uint256 profitAfterOperatingCosts,
        uint32 cycleCount,
        uint32 aiApprovedCycles,
        uint256 teamSize,
        bytes32 constitutionHash,
        bool active,
        bool emergencyStopEnabled,
        uint32 humanInterventions
    ) {
        Company storage c = companies[companyId];
        treasuryBalance = demoUsd.balanceOf(c.treasury);
        profitAfterOperatingCosts = c.revenue >= c.expenses ? c.revenue - c.expenses : 0;
        return (c.name, c.objective, c.owner, c.treasury, address(demoUsd), treasuryBalance, c.initialBudget, c.revenue, c.expenses, profitAfterOperatingCosts, c.cycleCount, c.aiApprovedCycles, _companyAgents[companyId].length, c.constitutionHash, c.active, c.emergencyStopEnabled, c.humanInterventions);
    }

    function _createAgent(uint256 companyId, bytes32 role, uint32 permissions, uint256 perCycleLimit) internal returns (uint256 agentId) {
        Company storage c = companies[companyId];
        agentId = ++agentCount;
        ZoryqAgentVaultV2 vault = new ZoryqAgentVaultV2(c.owner, companyId, agentId, role, demoUsd);
        agents[agentId] = Agent({
            id: agentId,
            companyId: companyId,
            vault: address(vault),
            role: role,
            permissions: permissions,
            reputationBps: 5000,
            jobsCompleted: 0,
            perCycleLimit: perCycleLimit,
            earned: 0,
            active: true
        });
        _companyAgents[companyId].push(agentId);
        emit AgentCreated(companyId, agentId, role, address(vault), permissions, perCycleLimit, 5000);
    }

    function _runBootstrapCycle(uint256 companyId) internal returns (uint256 jobId) {
        Company storage c = companies[companyId];
        uint256[] storage team = _companyAgents[companyId];
        uint256 ceoId = team[0];
        uint256 marketingId = team[1];
        uint256 designerId = team[2];
        uint256 researchId = team[3];
        uint256 salesId = team[4];
        uint256 financeId = team[5];
        uint256 developerId = team[6];

        jobId = ++jobCount;
        bytes32 specHash = keccak256(abi.encode("BOOTSTRAP_DIGITAL_PRODUCT", companyId, c.objective, block.number));
        bytes32 resultHash = keccak256(abi.encode("BOOTSTRAP_TESTNET_EVIDENCE", companyId, jobId, developerId, researchId));
        jobs[jobId] = Job({
            id: jobId,
            companyId: companyId,
            leadAgentId: developerId,
            verifierAgentId: researchId,
            marketValue: BOOTSTRAP_REVENUE,
            cost: BOOTSTRAP_COST,
            planHash: bytes32(0),
            specHash: specHash,
            resultHash: resultHash,
            aiPlanned: false,
            verified: true,
            settled: true
        });

        emit WorkDiscovered(companyId, jobId, BOOTSTRAP_REVENUE, specHash);
        emit AgentHired(companyId, jobId, marketingId, agents[marketingId].role, 3 * USD);
        emit AgentHired(companyId, jobId, developerId, agents[developerId].role, 4 * USD);
        emit AgentHired(companyId, jobId, designerId, agents[designerId].role, 3 * USD);
        emit AgentHired(companyId, jobId, researchId, agents[researchId].role, 2 * USD);
        emit AgentHired(companyId, jobId, salesId, agents[salesId].role, 3 * USD);
        emit AgentHired(companyId, jobId, financeId, agents[financeId].role, 2 * USD);
        emit WorkExecuted(companyId, jobId, developerId, resultHash);
        emit WorkVerified(companyId, jobId, researchId, resultHash);

        _payAgent(c, jobId, marketingId, 3 * USD);
        _payAgent(c, jobId, designerId, 3 * USD);
        _payAgent(c, jobId, researchId, 2 * USD);
        _payAgent(c, jobId, salesId, 3 * USD);
        _payAgent(c, jobId, financeId, 2 * USD);
        _payAgent(c, jobId, developerId, 4 * USD);

        require(demoUsd.transfer(c.treasury, BOOTSTRAP_REVENUE), "bootstrap revenue transfer failed");
        c.expenses += BOOTSTRAP_COST;
        c.revenue += BOOTSTRAP_REVENUE;
        c.cycleCount += 1;

        _rewardReputation(companyId, ceoId, 25, false);
        _rewardReputation(companyId, marketingId, 60, true);
        _rewardReputation(companyId, designerId, 75, true);
        _rewardReputation(companyId, researchId, 80, true);
        _rewardReputation(companyId, salesId, 70, true);
        _rewardReputation(companyId, financeId, 50, true);
        _rewardReputation(companyId, developerId, 100, true);

        uint256 treasuryBalance = demoUsd.balanceOf(c.treasury);
        emit RevenueGenerated(companyId, jobId, BOOTSTRAP_REVENUE, treasuryBalance);
        emit CycleCompleted(companyId, jobId, c.cycleCount, c.revenue, c.expenses, treasuryBalance, false);
    }

    function _isCompanyAgent(uint256 companyId, uint256 agentId) internal view returns (bool) {
        uint256[] storage ids = _companyAgents[companyId];
        for (uint256 i = 0; i < ids.length; i++) if (ids[i] == agentId) return true;
        return false;
    }

    function _payAgent(Company storage c, uint256 jobId, uint256 agentId, uint256 amount) internal {
        Agent storage a = agents[agentId];
        require(a.active, "agent inactive");
        require(amount <= a.perCycleLimit, "agent limit");
        ZoryqCompanyTreasuryV2(c.treasury).protocolPay(a.vault, amount);
        a.earned += amount;
        emit AgentPaid(c.id, jobId, agentId, a.vault, amount);
    }

    function _rewardReputation(uint256 companyId, uint256 agentId, uint32 delta, bool completedJob) internal {
        Agent storage a = agents[agentId];
        uint256 next = uint256(a.reputationBps) + delta;
        a.reputationBps = uint32(next > 10_000 ? 10_000 : next);
        if (completedJob) a.jobsCompleted += 1;
        emit ReputationUpdated(companyId, agentId, a.reputationBps, a.jobsCompleted);
    }
}
