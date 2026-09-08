// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ZoryqProjectRegistry
/// @notice Testnet registry for builder-owned project identities and machine-readable manifests.
/// @dev Stores compact metadata pointers/hashes. Project analytics should be derived from chain activity off-chain.
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
    mapping(uint256 => uint256) private ownerListIndex;

    event ProjectRegistered(uint256 indexed projectId, address indexed owner, string slug, string manifestURI, bytes32 manifestHash);
    event ProjectUpdated(uint256 indexed projectId, string manifestURI, bytes32 manifestHash);
    event ProjectStatusChanged(uint256 indexed projectId, bool active);
    event ProjectOwnershipTransferred(uint256 indexed projectId, address indexed previousOwner, address indexed nextOwner);

    modifier onlyProjectOwner(uint256 projectId) {
        require(projectExists(projectId) && projects[projectId].owner == msg.sender, "not_project_owner");
        _;
    }

    function registerProject(string calldata slug, string calldata manifestURI, bytes32 manifestHash) external returns (uint256 projectId) {
        _validateSlug(slug);
        require(bytes(manifestURI).length > 0 && bytes(manifestURI).length <= 512, "invalid_manifest_uri");
        require(manifestHash != bytes32(0), "empty_manifest_hash");

        bytes32 slugHash = keccak256(bytes(slug));
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
        _addToOwner(msg.sender, projectId);

        emit ProjectRegistered(projectId, msg.sender, slug, manifestURI, manifestHash);
    }

    function updateManifest(uint256 projectId, string calldata manifestURI, bytes32 manifestHash) external onlyProjectOwner(projectId) {
        require(bytes(manifestURI).length > 0 && bytes(manifestURI).length <= 512, "invalid_manifest_uri");
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
        require(nextOwner != msg.sender, "same_owner");
        address previousOwner = msg.sender;
        _removeFromOwner(previousOwner, projectId);
        projects[projectId].owner = nextOwner;
        projects[projectId].updatedAt = uint64(block.timestamp);
        _addToOwner(nextOwner, projectId);
        emit ProjectOwnershipTransferred(projectId, previousOwner, nextOwner);
    }

    function getProject(uint256 projectId) external view returns (Project memory) {
        require(projectExists(projectId), "project_not_found");
        return projects[projectId];
    }

    function projectIdsOf(address owner) external view returns (uint256[] memory) {
        return projectsByOwner[owner];
    }

    function projectExists(uint256 projectId) public view returns (bool) {
        return projectId != 0 && projects[projectId].owner != address(0);
    }

    function projectIdBySlug(string calldata slug) external view returns (uint256) {
        return projectIdBySlugHash[keccak256(bytes(slug))];
    }

    function _validateSlug(string calldata slug) private pure {
        bytes memory s = bytes(slug);
        require(s.length >= 3 && s.length <= 48, "invalid_slug_length");
        require(s[0] != 0x2d && s[s.length - 1] != 0x2d, "invalid_slug_format");
        for (uint256 i = 0; i < s.length; i++) {
            bytes1 c = s[i];
            bool ok = (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x2d;
            require(ok, "invalid_slug_character");
            if (c == 0x2d && i > 0) require(s[i - 1] != 0x2d, "invalid_slug_format");
        }
    }

    function _addToOwner(address owner, uint256 projectId) private {
        ownerListIndex[projectId] = projectsByOwner[owner].length;
        projectsByOwner[owner].push(projectId);
    }

    function _removeFromOwner(address owner, uint256 projectId) private {
        uint256[] storage ids = projectsByOwner[owner];
        uint256 index = ownerListIndex[projectId];
        uint256 lastIndex = ids.length - 1;
        if (index != lastIndex) {
            uint256 movedId = ids[lastIndex];
            ids[index] = movedId;
            ownerListIndex[movedId] = index;
        }
        ids.pop();
        delete ownerListIndex[projectId];
    }
}
