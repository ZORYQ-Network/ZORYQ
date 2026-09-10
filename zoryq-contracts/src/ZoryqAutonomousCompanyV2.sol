// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Testnet-only synthetic accounting token. It is not real USD and has no monetary value.
contract ZoryqDemoUSDV2 {
    string public constant name = "ZORYQ Demo USD v2";
    string public constant symbol = "dUSD";
    uint8 public constant decimals = 6;
    address public immutable minter;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(address minter_) { minter = minter_; }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "minter only");
        require(to != address(0), "zero recipient");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "zero recipient");
        uint256 bal = balanceOf[from];
        require(bal >= amount, "balance");
        unchecked { balanceOf[from] = bal - amount; }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract ZoryqCompanyTreasuryV2 {
    address public immutable protocol;
    address public immutable owner;
    ZoryqDemoUSDV2 public immutable token;

    constructor(address protocol_, address owner_, ZoryqDemoUSDV2 token_) {
        protocol = protocol_;
        owner = owner_;
        token = token_;
    }

    function protocolPay(address to, uint256 amount) external {
        require(msg.sender == protocol, "protocol only");
        require(token.transfer(to, amount), "payment failed");
    }

    function ownerWithdraw(address to, uint256 amount) external {
        require(msg.sender == owner, "owner only");
        require(token.transfer(to, amount), "withdraw failed");
    }
}

contract ZoryqAgentVaultV2 {
    address public immutable owner;
    uint256 public immutable companyId;
    uint256 public immutable agentId;
    bytes32 public immutable role;
    ZoryqDemoUSDV2 public immutable token;

    constructor(address owner_, uint256 companyId_, uint256 agentId_, bytes32 role_, ZoryqDemoUSDV2 token_) {
        owner = owner_;
        companyId = companyId_;
        agentId = agentId_;
        role = role_;
        token = token_;
    }

    function withdraw(address to, uint256 amount) external {
        require(msg.sender == owner, "owner only");
        require(token.transfer(to, amount), "withdraw failed");
    }
}

/// @title ZORYQ Autonomous Company v2
/// @notice Public-testnet demonstration: name + objective + budget -> onchain company + autonomous economic cycle.
/// @dev AI reasoning remains an offchain service layer; authority, treasury, work evidence, settlement and reputation are onchain.
contract ZoryqAutonomousCompanyV2 {
    uint256 public constant USD = 1_000_000;
    uint256 public constant MARKET_REVENUE_PER_CYCLE = 40 * USD;
    uint256 public constant OPERATING_COST_PER_CYCLE = 17 * USD;
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
        bytes32 specHash;
        bytes32 resultHash;
        bool verified;
        bool settled;
    }

    mapping(uint256 => Company) public companies;
    mapping(uint256 => Agent) public agents;
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => uint256[]) private _companyAgents;

    event CompanyCreated(uint256 indexed companyId, address indexed owner, address treasury, string name, string objective, uint256 budget, bytes32 promptHash);
    event TreasuryOpened(uint256 indexed companyId, address treasury, address demoUsd, uint256 startingBalance);
    event ConstitutionInstalled(uint256 indexed companyId, bytes32 constitutionHash, string rules);
    event RevenuePolicyInstalled(uint256 indexed companyId, uint16 treasuryRetentionBps, uint256 maxOperatingCostPerCycle);
    event EmergencyStopConfigured(uint256 indexed companyId, bool enabled);
    event AgentCreated(uint256 indexed companyId, uint256 indexed agentId, bytes32 indexed role, address vault, uint32 permissions, uint256 perCycleLimit, uint32 reputationBps);
    event WorkDiscovered(uint256 indexed companyId, uint256 indexed jobId, uint256 marketValue, bytes32 specHash);
    event AgentHired(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed agentId, bytes32 role, uint256 plannedPayment);
    event AgentSubcontracted(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed fromAgentId, uint256 toAgentId, uint256 plannedPayment);
    event WorkExecuted(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed agentId, bytes32 resultHash);
    event WorkVerified(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed verifierAgentId, bytes32 resultHash);
    event AgentPaid(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed agentId, address vault, uint256 amount);
    event RevenueGenerated(uint256 indexed companyId, uint256 indexed jobId, uint256 amount, uint256 treasuryBalance);
    event ReputationUpdated(uint256 indexed companyId, uint256 indexed agentId, uint32 reputationBps, uint32 jobsCompleted);
    event CycleCompleted(uint256 indexed companyId, uint256 indexed jobId, uint32 cycleCount, uint256 revenue, uint256 expenses, uint256 treasuryBalance);
    event EmergencyStopTriggered(uint256 indexed companyId, address indexed owner, uint32 humanInterventions);
    event CompanyResumed(uint256 indexed companyId, address indexed owner, uint32 humanInterventions);

    constructor() {
        demoUsd = new ZoryqDemoUSDV2(address(this));
        demoUsd.mint(address(this), 10_000_000 * USD);
    }

    /// @notice Creates the complete company and executes its first economic cycle in a single transaction.
    function launchCompany(string calldata companyName, string calldata objective, uint256 budgetUsd6, bytes32 promptHash) external returns (uint256 companyId) {
        require(bytes(companyName).length >= 2 && bytes(companyName).length <= 80, "invalid name");
        require(bytes(objective).length >= 4 && bytes(objective).length <= 280, "invalid objective");
        require(budgetUsd6 >= 25 * USD && budgetUsd6 <= 10_000 * USD, "invalid budget");
        require(promptHash != bytes32(0), "prompt required");

        companyId = ++companyCount;
        ZoryqCompanyTreasuryV2 treasury = new ZoryqCompanyTreasuryV2(address(this), msg.sender, demoUsd);
        bytes32 constitutionHash = keccak256(abi.encode(
            "ZORYQ_AUTONOMOUS_COMPANY_CONSTITUTION_V2",
            msg.sender,
            companyId,
            companyName,
            objective,
            budgetUsd6,
            promptHash,
            "CEO routes; agents operate only inside recorded roles/limits; Research verifies; Finance settles; emergency stop owner-controlled"
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
            humanInterventions: 0,
            emergencyStopEnabled: true,
            active: true
        });

        demoUsd.mint(address(treasury), budgetUsd6);
        emit CompanyCreated(companyId, msg.sender, address(treasury), companyName, objective, budgetUsd6, promptHash);
        emit TreasuryOpened(companyId, address(treasury), address(demoUsd), budgetUsd6);
        emit ConstitutionInstalled(companyId, constitutionHash, "CEO routes; Marketing and Sales find demand; Designer and Developer execute; Research verifies; Finance settles; owner can emergency-stop");
        emit RevenuePolicyInstalled(companyId, 10_000, OPERATING_COST_PER_CYCLE);
        emit EmergencyStopConfigured(companyId, true);

        _createAgent(companyId, bytes32("AI_CEO"), PERM_ROUTE | PERM_HIRE | PERM_EMERGENCY, 10 * USD);
        _createAgent(companyId, bytes32("AI_MARKETING"), PERM_MARKET | PERM_HIRE, 5 * USD);
        _createAgent(companyId, bytes32("AI_DESIGNER"), PERM_EXECUTE, 3 * USD);
        _createAgent(companyId, bytes32("AI_RESEARCH"), PERM_EXECUTE | PERM_VERIFY, 2 * USD);
        _createAgent(companyId, bytes32("AI_SALES"), PERM_MARKET | PERM_HIRE, 3 * USD);
        _createAgent(companyId, bytes32("AI_FINANCE"), PERM_PAY | PERM_VERIFY, 15 * USD);
        _createAgent(companyId, bytes32("AI_DEVELOPER"), PERM_EXECUTE | PERM_DEPLOY | PERM_HIRE, 5 * USD);

        _runCycle(companyId);
    }

    function runNextCycle(uint256 companyId) external returns (uint256 jobId) {
        Company storage c = companies[companyId];
        require(c.owner == msg.sender, "owner only");
        jobId = _runCycle(companyId);
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
        uint256 teamSize,
        bytes32 constitutionHash,
        bool active,
        bool emergencyStopEnabled,
        uint32 humanInterventions
    ) {
        Company storage c = companies[companyId];
        treasuryBalance = demoUsd.balanceOf(c.treasury);
        profitAfterOperatingCosts = c.revenue >= c.expenses ? c.revenue - c.expenses : 0;
        return (c.name, c.objective, c.owner, c.treasury, address(demoUsd), treasuryBalance, c.initialBudget, c.revenue, c.expenses, profitAfterOperatingCosts, c.cycleCount, _companyAgents[companyId].length, c.constitutionHash, c.active, c.emergencyStopEnabled, c.humanInterventions);
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

    function _runCycle(uint256 companyId) internal returns (uint256 jobId) {
        Company storage c = companies[companyId];
        require(c.active, "company stopped");
        require(c.cycleCount < MAX_CYCLES, "cycle cap reached");
        require(demoUsd.balanceOf(c.treasury) >= OPERATING_COST_PER_CYCLE, "treasury below cost");

        uint256[] storage team = _companyAgents[companyId];
        require(team.length == 7, "team incomplete");
        uint256 ceoId = team[0];
        uint256 marketingId = team[1];
        uint256 designerId = team[2];
        uint256 researchId = team[3];
        uint256 salesId = team[4];
        uint256 financeId = team[5];
        uint256 developerId = team[6];

        jobId = ++jobCount;
        bytes32 specHash = keccak256(abi.encode("AUTONOMOUS_DIGITAL_PRODUCT", companyId, c.cycleCount + 1, c.objective, block.number));
        bytes32 resultHash = keccak256(abi.encode("DELIVERED_VERIFIED_REVENUE_READY", companyId, jobId, developerId, designerId, researchId));
        jobs[jobId] = Job({
            id: jobId,
            companyId: companyId,
            leadAgentId: developerId,
            verifierAgentId: researchId,
            marketValue: MARKET_REVENUE_PER_CYCLE,
            cost: OPERATING_COST_PER_CYCLE,
            specHash: specHash,
            resultHash: bytes32(0),
            verified: false,
            settled: false
        });

        emit WorkDiscovered(companyId, jobId, MARKET_REVENUE_PER_CYCLE, specHash);
        emit AgentHired(companyId, jobId, marketingId, agents[marketingId].role, 3 * USD);
        emit AgentHired(companyId, jobId, developerId, agents[developerId].role, 4 * USD);
        emit AgentSubcontracted(companyId, jobId, developerId, designerId, 3 * USD);
        emit AgentSubcontracted(companyId, jobId, developerId, researchId, 2 * USD);
        emit AgentSubcontracted(companyId, jobId, ceoId, salesId, 3 * USD);
        emit AgentHired(companyId, jobId, financeId, agents[financeId].role, 2 * USD);

        jobs[jobId].resultHash = resultHash;
        emit WorkExecuted(companyId, jobId, developerId, resultHash);
        jobs[jobId].verified = true;
        emit WorkVerified(companyId, jobId, researchId, resultHash);

        _payAgent(c, jobId, marketingId, 3 * USD);
        _payAgent(c, jobId, designerId, 3 * USD);
        _payAgent(c, jobId, researchId, 2 * USD);
        _payAgent(c, jobId, salesId, 3 * USD);
        _payAgent(c, jobId, financeId, 2 * USD);
        _payAgent(c, jobId, developerId, 4 * USD);

        require(demoUsd.transfer(c.treasury, MARKET_REVENUE_PER_CYCLE), "revenue transfer failed");
        c.expenses += OPERATING_COST_PER_CYCLE;
        c.revenue += MARKET_REVENUE_PER_CYCLE;
        c.cycleCount += 1;
        jobs[jobId].settled = true;

        _rewardReputation(companyId, ceoId, 25, false);
        _rewardReputation(companyId, marketingId, 60, true);
        _rewardReputation(companyId, designerId, 75, true);
        _rewardReputation(companyId, researchId, 80, true);
        _rewardReputation(companyId, salesId, 70, true);
        _rewardReputation(companyId, financeId, 50, true);
        _rewardReputation(companyId, developerId, 100, true);

        uint256 treasuryBalance = demoUsd.balanceOf(c.treasury);
        emit RevenueGenerated(companyId, jobId, MARKET_REVENUE_PER_CYCLE, treasuryBalance);
        emit CycleCompleted(companyId, jobId, c.cycleCount, c.revenue, c.expenses, treasuryBalance);
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
