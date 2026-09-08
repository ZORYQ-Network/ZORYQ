// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ZoryqProjectRegistry
/// @notice Testnet registry for builder-owned project identities and machine-readable manifests.
/// @dev Stores only compact metadata pointers/hashes. Project analytics should be derived from chain activity off-chain.
contract ZoryqProjectRegistry {
    struct Project {
        address owner;
        string slug;
        string manifestURI;
        bytes32 manifestHash;
        uint64 createdAt;
        uint64 updatedAt;
        bool active;
    }

    uint256 public projectCount;
    mapping(uint256 => Project) private projects;
    mapping(bytes32 => uint256) public projectIdBySlugHash;
    mapping(address => uint256[]) private projectsByOwner;

    event ProjectRegistered(uint256 indexed projectId, address indexed owner, string slug, string manifestURI, bytes32 manifestHash);
    event ProjectUpdated(uint256 indexed projectId, string manifestURI, bytes32 manifestHash);
    event ProjectStatusChanged(uint256 indexed projectId, bool active);
    event ProjectOwnershipTransferred(uint256 indexed projectId, address indexed previousOwner, address indexed nextOwner);

    modifier onlyProjectOwner(uint256 projectId) {
        require(projectId != 0 && projects[projectId].owner == msg.sender, "not_project_owner");
        _;
    }

    function registerProject(string calldata slug, string calldata manifestURI, bytes32 manifestHash) external returns (uint256 projectId) {
        bytes memory slugBytes = bytes(slug);
        require(slugBytes.length >= 3 && slugBytes.length <= 48, "invalid_slug_length");
        require(bytes(manifestURI).length > 0, "empty_manifest_uri");
        require(manifestHash != bytes32(0), "empty_manifest_hash");

        bytes32 slugHash = keccak256(slugBytes);
        require(projectIdBySlugHash[slugHash] == 0, "slug_taken");

        projectId = ++projectCount;
        uint64 now64 = uint64(block.timestamp);
        projects[projectId] = Project({
            owner: msg.sender,
            slug: slug,
            manifestURI: manifestURI,
            manifestHash: manifestHash,
            createdAt: now64,
            updatedAt: now64,
            active: true
        });
        projectIdBySlugHash[slugHash] = projectId;
        projectsByOwner[msg.sender].push(projectId);

        emit ProjectRegistered(projectId, msg.sender, slug, manifestURI, manifestHash);
    }

    function updateManifest(uint256 projectId, string calldata manifestURI, bytes32 manifestHash) external onlyProjectOwner(projectId) {
        require(bytes(manifestURI).length > 0, "empty_manifest_uri");
        require(manifestHash != bytes32(0), "empty_manifest_hash");
        Project storage p = projects[projectId];
        p.manifestURI = manifestURI;
        p.manifestHash = manifestHash;
        p.updatedAt = uint64(block.timestamp);
        emit ProjectUpdated(projectId, manifestURI, manifestHash);
    }

    function setActive(uint256 projectId, bool active) external onlyProjectOwner(projectId) {
        projects[projectId].active = active;
        projects[projectId].updatedAt = uint64(block.timestamp);
        emit ProjectStatusChanged(projectId, active);
    }

    function transferProject(uint256 projectId, address nextOwner) external onlyProjectOwner(projectId) {
        require(nextOwner != address(0), "zero_owner");
        address previousOwner = msg.sender;
        projects[projectId].owner = nextOwner;
        projects[projectId].updatedAt = uint64(block.timestamp);
        projectsByOwner[nextOwner].push(projectId);
        emit ProjectOwnershipTransferred(projectId, previousOwner, nextOwner);
    }

    function getProject(uint256 projectId) external view returns (Project memory) {
        require(projectId != 0 && projects[projectId].owner != address(0), "project_not_found");
        return projects[projectId];
    }

    function projectIdsOf(address owner) external view returns (uint256[] memory) {
        return projectsByOwner[owner];
    }
}
