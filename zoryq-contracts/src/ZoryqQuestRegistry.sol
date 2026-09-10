// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ZoryqQuestRegistry {
    address public owner;
    uint256 public nextQuestId = 1;

    struct Quest {
        uint256 id;
        string title;
        string metadataURI;
        uint256 points;
        uint64 startAt;
        uint64 endAt;
        bool active;
    }

    mapping(uint256 => Quest) public quests;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event QuestCreated(uint256 indexed questId, string title, uint256 points, uint64 startAt, uint64 endAt, string metadataURI);
    event QuestUpdated(uint256 indexed questId, string title, uint256 points, uint64 startAt, uint64 endAt, string metadataURI);
    event QuestStatusChanged(uint256 indexed questId, bool active);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address initialOwner) {
        require(initialOwner != address(0), "zero owner");
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function createQuest(
        string calldata title,
        string calldata metadataURI,
        uint256 points,
        uint64 startAt,
        uint64 endAt
    ) external onlyOwner returns (uint256 questId) {
        require(points > 0, "zero points");
        require(endAt == 0 || endAt > startAt, "bad window");
        questId = nextQuestId++;
        quests[questId] = Quest(questId, title, metadataURI, points, startAt, endAt, true);
        emit QuestCreated(questId, title, points, startAt, endAt, metadataURI);
    }

    function updateQuest(
        uint256 questId,
        string calldata title,
        string calldata metadataURI,
        uint256 points,
        uint64 startAt,
        uint64 endAt
    ) external onlyOwner {
        Quest storage q = quests[questId];
        require(q.id != 0, "missing quest");
        require(points > 0, "zero points");
        require(endAt == 0 || endAt > startAt, "bad window");
        q.title = title;
        q.metadataURI = metadataURI;
        q.points = points;
        q.startAt = startAt;
        q.endAt = endAt;
        emit QuestUpdated(questId, title, points, startAt, endAt, metadataURI);
    }

    function setQuestActive(uint256 questId, bool active) external onlyOwner {
        require(quests[questId].id != 0, "missing quest");
        quests[questId].active = active;
        emit QuestStatusChanged(questId, active);
    }

    function isQuestLive(uint256 questId) external view returns (bool) {
        Quest memory q = quests[questId];
        if (!q.active || q.id == 0) return false;
        if (q.startAt != 0 && block.timestamp < q.startAt) return false;
        if (q.endAt != 0 && block.timestamp > q.endAt) return false;
        return true;
    }
}
