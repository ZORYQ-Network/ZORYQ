// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ZORYQ Autonomous Economy Protocol
/// @notice Testnet prototype for economic identities, autonomous organizations,
///         delegated spending policies, agent-to-agent work and auditable settlement.
/// @dev This contract is experimental and unaudited. ZQ on the ZORYQ testnet has no monetary value.
contract ZoryqAutonomousEconomy {
    uint256 public constant ROLE_CEO = 1 << 0;
    uint256 public constant ROLE_FINANCE = 1 << 1;
    uint256 public constant ROLE_MARKETING = 1 << 2;
    uint256 public constant ROLE_DEVELOPER = 1 << 3;
    uint256 public constant ROLE_WORKER = 1 << 4;
    uint256 public constant ROLE_AUDITOR = 1 << 5;

    uint256 private _guard = 1;
    uint256 public agentCount;
    uint256 public organizationCount;
    uint256 public taskCount;

    enum TaskStatus { None, Open, Assigned, Submitted, Settled, Cancelled }

    struct Agent {
        bytes32 agentId;
        address controller;
        bytes32 label;
        bytes32 metadataHash;
        bytes32 capabilitiesHash;
        uint64 createdAt;
        uint64 updatedAt;
        uint64 successfulTasks;
        uint64 failedTasks;
        uint256 grossEarned;
        uint256 grossSpent;
        uint32 reputationBps;
        bool active;
    }

    struct Organization {
        uint256 id;
        address owner;
        bytes32 label;
        bytes32 metadataHash;
        uint256 balance;
        uint256 monthlyBudget;
        uint256 committedThisWindow;
        uint256 lifetimeIn;
        uint256 lifetimeOut;
        uint64 windowStart;
        uint64 createdAt;
        bool active;
    }

    struct Policy {
        uint256 roles;
        uint256 perTxLimit;
        uint256 monthlyLimit;
        uint256 spentThisWindow;
        uint64 windowStart;
        bool active;
    }

    struct Bid {
        uint256 price;
        bytes32 proposalHash;
        uint64 createdAt;
        bool active;
    }

    struct Task {
        uint256 id;
        uint256 organizationId;
        address creator;
        address worker;
        bytes32 specHash;
        bytes32 resultHash;
        uint256 rewardCap;
        uint256 acceptedPrice;
        uint256 escrowed;
        uint64 deadline;
        uint64 createdAt;
        TaskStatus status;
    }

    mapping(address => Agent) public agents;
    address[] public agentIndex;
    mapping(uint256 => Organization) public organizations;
    mapping(uint256 => mapping(address => Policy)) public policies;
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => mapping(address => Bid)) public bids;

    event AgentRegistered(bytes32 indexed agentId, address indexed controller, bytes32 label, bytes32 capabilitiesHash);
    event AgentUpdated(bytes32 indexed agentId, address indexed controller, bytes32 metadataHash, bytes32 capabilitiesHash, bool active);
    event OrganizationCreated(uint256 indexed organizationId, address indexed owner, bytes32 label, uint256 monthlyBudget);
    event OrganizationFunded(uint256 indexed organizationId, address indexed funder, uint256 amount, uint256 newBalance);
    event OrganizationPolicySet(uint256 indexed organizationId, address indexed agent, uint256 roles, uint256 perTxLimit, uint256 monthlyLimit, bool active);
    event AgentSpent(uint256 indexed organizationId, address indexed agent, address indexed recipient, uint256 amount, bytes32 categoryHash, bytes32 memoHash);
    event TaskCreated(uint256 indexed taskId, uint256 indexed organizationId, address indexed creator, bytes32 specHash, uint256 rewardCap, uint64 deadline);
    event TaskBid(uint256 indexed taskId, address indexed agent, uint256 price, bytes32 proposalHash);
    event TaskAssigned(uint256 indexed taskId, address indexed worker, uint256 acceptedPrice);
    event TaskSubmitted(uint256 indexed taskId, address indexed worker, bytes32 resultHash);
    event TaskSettled(uint256 indexed taskId, address indexed worker, uint256 paid, bytes32 resultHash);
    event TaskCancelled(uint256 indexed taskId, address indexed actor, uint256 refunded);
    event EconomicAction(bytes32 indexed action, uint256 indexed organizationId, uint256 indexed taskId, address actor, address counterparty, uint256 value, bytes32 dataHash);

    modifier nonReentrant() {
        require(_guard == 1, "reentrancy");
        _guard = 2;
        _;
        _guard = 1;
    }

    modifier registeredAgent() {
        require(agents[msg.sender].active, "active agent required");
        _;
    }

    receive() external payable {
        revert("use fundOrganization or createDirectTask");
    }

    function registerAgent(bytes32 label, bytes32 metadataHash, bytes32 capabilitiesHash) external returns (bytes32 agentId) {
        require(label != bytes32(0), "label required");
        Agent storage a = agents[msg.sender];
        require(a.controller == address(0), "agent already registered");
        agentId = keccak256(abi.encodePacked(block.chainid, msg.sender, block.timestamp, agentCount + 1));
        agents[msg.sender] = Agent({
            agentId: agentId,
            controller: msg.sender,
            label: label,
            metadataHash: metadataHash,
            capabilitiesHash: capabilitiesHash,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            successfulTasks: 0,
            failedTasks: 0,
            grossEarned: 0,
            grossSpent: 0,
            reputationBps: 5000,
            active: true
        });
        agentIndex.push(msg.sender);
        agentCount++;
        emit AgentRegistered(agentId, msg.sender, label, capabilitiesHash);
        emit EconomicAction("AGENT_REGISTERED", 0, 0, msg.sender, address(0), 0, metadataHash);
    }

    function updateAgent(bytes32 metadataHash, bytes32 capabilitiesHash, bool active) external {
        Agent storage a = agents[msg.sender];
        require(a.controller == msg.sender, "agent not registered");
        a.metadataHash = metadataHash;
        a.capabilitiesHash = capabilitiesHash;
        a.active = active;
        a.updatedAt = uint64(block.timestamp);
        emit AgentUpdated(a.agentId, msg.sender, metadataHash, capabilitiesHash, active);
        emit EconomicAction("AGENT_UPDATED", 0, 0, msg.sender, address(0), 0, metadataHash);
    }

    function createOrganization(bytes32 label, bytes32 metadataHash, uint256 monthlyBudget) external returns (uint256 organizationId) {
        require(label != bytes32(0), "label required");
        organizationId = ++organizationCount;
        organizations[organizationId] = Organization({
            id: organizationId,
            owner: msg.sender,
            label: label,
            metadataHash: metadataHash,
            balance: 0,
            monthlyBudget: monthlyBudget,
            committedThisWindow: 0,
            lifetimeIn: 0,
            lifetimeOut: 0,
            windowStart: uint64(block.timestamp),
            createdAt: uint64(block.timestamp),
            active: true
        });
        emit OrganizationCreated(organizationId, msg.sender, label, monthlyBudget);
        emit EconomicAction("ORG_CREATED", organizationId, 0, msg.sender, address(0), monthlyBudget, metadataHash);
    }

    function fundOrganization(uint256 organizationId) external payable {
        Organization storage o = _activeOrganization(organizationId);
        require(msg.value > 0, "value required");
        o.balance += msg.value;
        o.lifetimeIn += msg.value;
        emit OrganizationFunded(organizationId, msg.sender, msg.value, o.balance);
        emit EconomicAction("ORG_FUNDED", organizationId, 0, msg.sender, address(this), msg.value, bytes32(0));
    }

    function setOrganizationActive(uint256 organizationId, bool active) external {
        Organization storage o = organizations[organizationId];
        require(o.owner == msg.sender, "owner only");
        o.active = active;
        emit EconomicAction(active ? bytes32("ORG_ACTIVATED") : bytes32("ORG_PAUSED"), organizationId, 0, msg.sender, address(0), 0, bytes32(0));
    }

    function setAgentPolicy(
        uint256 organizationId,
        address agent,
        uint256 roles,
        uint256 perTxLimit,
        uint256 monthlyLimit,
        bool active
    ) external {
        Organization storage o = organizations[organizationId];
        require(o.owner == msg.sender, "owner only");
        require(agent != address(0), "invalid agent");
        require(agents[agent].controller != address(0), "agent not registered");
        policies[organizationId][agent] = Policy({
            roles: roles,
            perTxLimit: perTxLimit,
            monthlyLimit: monthlyLimit,
            spentThisWindow: 0,
            windowStart: uint64(block.timestamp),
            active: active
        });
        emit OrganizationPolicySet(organizationId, agent, roles, perTxLimit, monthlyLimit, active);
        emit EconomicAction("POLICY_SET", organizationId, 0, msg.sender, agent, monthlyLimit, bytes32(roles));
    }

    function agentSpend(
        uint256 organizationId,
        address payable recipient,
        uint256 amount,
        bytes32 categoryHash,
        bytes32 memoHash
    ) external registeredAgent nonReentrant {
        require(recipient != address(0), "invalid recipient");
        require(amount > 0, "amount required");
        Organization storage o = _activeOrganization(organizationId);
        Policy storage p = policies[organizationId][msg.sender];
        _rollPolicyWindow(p);
        require(p.active, "policy inactive");
        require((p.roles & (ROLE_CEO | ROLE_FINANCE)) != 0, "spending role required");
        if (p.perTxLimit > 0) require(amount <= p.perTxLimit, "per tx limit");
        if (p.monthlyLimit > 0) require(p.spentThisWindow + amount <= p.monthlyLimit, "agent monthly limit");
        _consumeOrganizationBudget(o, amount);
        require(o.balance >= amount, "organization balance");
        p.spentThisWindow += amount;
        o.balance -= amount;
        o.lifetimeOut += amount;
        agents[msg.sender].grossSpent += amount;
        (bool ok,) = recipient.call{value: amount}("");
        require(ok, "transfer failed");
        emit AgentSpent(organizationId, msg.sender, recipient, amount, categoryHash, memoHash);
        emit EconomicAction("AGENT_SPEND", organizationId, 0, msg.sender, recipient, amount, memoHash);
    }

    function createTask(
        uint256 organizationId,
        bytes32 specHash,
        uint256 rewardCap,
        uint64 deadline
    ) external returns (uint256 taskId) {
        Organization storage o = _activeOrganization(organizationId);
        require(_canCreateTask(organizationId, msg.sender), "task manager role required");
        require(specHash != bytes32(0), "spec required");
        require(rewardCap > 0, "reward required");
        require(deadline > block.timestamp, "future deadline required");
        _consumeOrganizationBudget(o, rewardCap);
        require(o.balance >= rewardCap, "organization balance");
        o.balance -= rewardCap;
        taskId = _newTask(organizationId, msg.sender, specHash, rewardCap, rewardCap, deadline);
    }

    function createDirectTask(bytes32 specHash, uint256 rewardCap, uint64 deadline) external payable registeredAgent returns (uint256 taskId) {
        require(specHash != bytes32(0), "spec required");
        require(rewardCap > 0 && msg.value == rewardCap, "exact escrow required");
        require(deadline > block.timestamp, "future deadline required");
        taskId = _newTask(0, msg.sender, specHash, rewardCap, msg.value, deadline);
    }

    function bidForTask(uint256 taskId, uint256 price, bytes32 proposalHash) external registeredAgent {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Open, "task not open");
        require(block.timestamp <= t.deadline, "task expired");
        require(msg.sender != t.creator, "creator cannot bid");
        require(price > 0 && price <= t.rewardCap, "invalid price");
        bids[taskId][msg.sender] = Bid({price: price, proposalHash: proposalHash, createdAt: uint64(block.timestamp), active: true});
        emit TaskBid(taskId, msg.sender, price, proposalHash);
        emit EconomicAction("TASK_BID", t.organizationId, taskId, msg.sender, t.creator, price, proposalHash);
    }

    function assignTask(uint256 taskId, address worker) external {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Open, "task not open");
        require(_canManageTask(t, msg.sender), "task manager only");
        Bid storage b = bids[taskId][worker];
        require(b.active && b.price > 0, "active bid required");
        require(agents[worker].active, "worker inactive");
        t.worker = worker;
        t.acceptedPrice = b.price;
        t.status = TaskStatus.Assigned;
        emit TaskAssigned(taskId, worker, b.price);
        emit EconomicAction("TASK_ASSIGNED", t.organizationId, taskId, msg.sender, worker, b.price, b.proposalHash);
    }

    function submitTask(uint256 taskId, bytes32 resultHash) external {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Assigned, "task not assigned");
        require(t.worker == msg.sender, "worker only");
        require(resultHash != bytes32(0), "result required");
        t.resultHash = resultHash;
        t.status = TaskStatus.Submitted;
        emit TaskSubmitted(taskId, msg.sender, resultHash);
        emit EconomicAction("TASK_SUBMITTED", t.organizationId, taskId, msg.sender, t.creator, 0, resultHash);
    }

    function settleTask(uint256 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Submitted, "task not submitted");
        require(_canSettleTask(t, msg.sender), "settlement role required");
        uint256 payment = t.acceptedPrice;
        require(payment > 0 && payment <= t.escrowed, "invalid settlement");
        uint256 refund = t.escrowed - payment;
        t.escrowed = 0;
        t.status = TaskStatus.Settled;
        if (t.organizationId != 0) {
            Organization storage o = organizations[t.organizationId];
            o.balance += refund;
            o.lifetimeOut += payment;
        } else if (refund > 0) {
            (bool refundOk,) = payable(t.creator).call{value: refund}("");
            require(refundOk, "refund failed");
        }
        Agent storage workerAgent = agents[t.worker];
        workerAgent.successfulTasks += 1;
        workerAgent.grossEarned += payment;
        if (workerAgent.reputationBps < 9900) workerAgent.reputationBps += 100;
        else workerAgent.reputationBps = 10000;
        (bool ok,) = payable(t.worker).call{value: payment}("");
        require(ok, "worker payment failed");
        emit TaskSettled(taskId, t.worker, payment, t.resultHash);
        emit EconomicAction("TASK_SETTLED", t.organizationId, taskId, msg.sender, t.worker, payment, t.resultHash);
    }

    function cancelTask(uint256 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Open || t.status == TaskStatus.Assigned, "cannot cancel");
        require(_canManageTask(t, msg.sender), "task manager only");
        uint256 refund = t.escrowed;
        t.escrowed = 0;
        t.status = TaskStatus.Cancelled;
        if (t.status == TaskStatus.Assigned && t.worker != address(0)) {
            agents[t.worker].failedTasks += 1;
        }
        if (t.organizationId != 0) {
            organizations[t.organizationId].balance += refund;
        } else if (refund > 0) {
            (bool ok,) = payable(t.creator).call{value: refund}("");
            require(ok, "refund failed");
        }
        emit TaskCancelled(taskId, msg.sender, refund);
        emit EconomicAction("TASK_CANCELLED", t.organizationId, taskId, msg.sender, t.worker, refund, t.specHash);
    }

    function agentSummary(address agent) external view returns (
        bytes32 agentId,
        bytes32 label,
        uint256 reputationBps,
        uint256 successfulTasks,
        uint256 failedTasks,
        uint256 grossEarned,
        uint256 grossSpent,
        bool active
    ) {
        Agent storage a = agents[agent];
        return (a.agentId, a.label, a.reputationBps, a.successfulTasks, a.failedTasks, a.grossEarned, a.grossSpent, a.active);
    }

    function organizationSummary(uint256 organizationId) external view returns (
        address owner,
        bytes32 label,
        uint256 balance,
        uint256 monthlyBudget,
        uint256 committedThisWindow,
        uint256 lifetimeIn,
        uint256 lifetimeOut,
        bool active
    ) {
        Organization storage o = organizations[organizationId];
        return (o.owner, o.label, o.balance, o.monthlyBudget, o.committedThisWindow, o.lifetimeIn, o.lifetimeOut, o.active);
    }

    function taskSummary(uint256 taskId) external view returns (
        uint256 organizationId,
        address creator,
        address worker,
        bytes32 specHash,
        bytes32 resultHash,
        uint256 rewardCap,
        uint256 acceptedPrice,
        uint256 escrowed,
        uint64 deadline,
        TaskStatus status
    ) {
        Task storage t = tasks[taskId];
        return (t.organizationId, t.creator, t.worker, t.specHash, t.resultHash, t.rewardCap, t.acceptedPrice, t.escrowed, t.deadline, t.status);
    }

    function hasRole(uint256 organizationId, address agent, uint256 role) public view returns (bool) {
        Organization storage o = organizations[organizationId];
        if (o.owner == agent) return true;
        Policy storage p = policies[organizationId][agent];
        return p.active && (p.roles & role) != 0;
    }

    function _newTask(uint256 organizationId, address creator, bytes32 specHash, uint256 rewardCap, uint256 escrowed, uint64 deadline) internal returns (uint256 taskId) {
        taskId = ++taskCount;
        tasks[taskId] = Task({
            id: taskId,
            organizationId: organizationId,
            creator: creator,
            worker: address(0),
            specHash: specHash,
            resultHash: bytes32(0),
            rewardCap: rewardCap,
            acceptedPrice: 0,
            escrowed: escrowed,
            deadline: deadline,
            createdAt: uint64(block.timestamp),
            status: TaskStatus.Open
        });
        emit TaskCreated(taskId, organizationId, creator, specHash, rewardCap, deadline);
        emit EconomicAction("TASK_CREATED", organizationId, taskId, creator, address(0), rewardCap, specHash);
    }

    function _activeOrganization(uint256 organizationId) internal view returns (Organization storage o) {
        o = organizations[organizationId];
        require(o.id != 0 && o.active, "organization inactive");
    }

    function _rollOrganizationWindow(Organization storage o) internal {
        if (block.timestamp >= uint256(o.windowStart) + 30 days) {
            o.windowStart = uint64(block.timestamp);
            o.committedThisWindow = 0;
        }
    }

    function _rollPolicyWindow(Policy storage p) internal {
        if (p.windowStart == 0 || block.timestamp >= uint256(p.windowStart) + 30 days) {
            p.windowStart = uint64(block.timestamp);
            p.spentThisWindow = 0;
        }
    }

    function _consumeOrganizationBudget(Organization storage o, uint256 amount) internal {
        _rollOrganizationWindow(o);
        if (o.monthlyBudget > 0) require(o.committedThisWindow + amount <= o.monthlyBudget, "organization monthly budget");
        o.committedThisWindow += amount;
    }

    function _canCreateTask(uint256 organizationId, address actor) internal view returns (bool) {
        Organization storage o = organizations[organizationId];
        if (o.owner == actor) return true;
        Policy storage p = policies[organizationId][actor];
        return p.active && (p.roles & (ROLE_CEO | ROLE_MARKETING | ROLE_DEVELOPER)) != 0;
    }

    function _canManageTask(Task storage t, address actor) internal view returns (bool) {
        if (t.organizationId == 0) return t.creator == actor;
        Organization storage o = organizations[t.organizationId];
        if (o.owner == actor) return true;
        Policy storage p = policies[t.organizationId][actor];
        return p.active && (p.roles & ROLE_CEO) != 0;
    }

    function _canSettleTask(Task storage t, address actor) internal view returns (bool) {
        if (t.organizationId == 0) return t.creator == actor;
        Organization storage o = organizations[t.organizationId];
        if (o.owner == actor) return true;
        Policy storage p = policies[t.organizationId][actor];
        return p.active && (p.roles & (ROLE_CEO | ROLE_FINANCE | ROLE_AUDITOR)) != 0;
    }
}
