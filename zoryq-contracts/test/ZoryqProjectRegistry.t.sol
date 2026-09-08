// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqProjectRegistry.sol";

interface VmProject {
    function prank(address who) external;
    function startPrank(address who) external;
    function stopPrank() external;
    function expectRevert(bytes calldata) external;
}

contract ZoryqProjectRegistryTest {
    VmProject constant vm = VmProject(address(uint160(uint256(keccak256("hevm cheat code")))));
    ZoryqProjectRegistry registry;
    address builder = address(0xB01D);
    address nextOwner = address(0xCAFE);

    function setUp() public {
        registry = new ZoryqProjectRegistry();
    }

    function testRegisterAndReadProject() public {
        bytes32 hash = keccak256("manifest-v1");
        vm.prank(builder);
        uint256 id = registry.registerProject("hello-zoryq", "ipfs://example-v1", hash);
        ZoryqProjectRegistry.Project memory p = registry.getProject(id);
        require(p.owner == builder, "owner");
        require(keccak256(bytes(p.slug)) == keccak256(bytes("hello-zoryq")), "slug");
        require(keccak256(bytes(p.manifestURI)) == keccak256(bytes("ipfs://example-v1")), "uri");
        require(p.manifestHash == hash, "hash");
        require(p.active, "active");
        require(registry.projectExists(id), "exists");
        require(registry.projectIdBySlug("hello-zoryq") == id, "lookup");
    }

    function testSlugIsUnique() public {
        bytes32 hash = keccak256("manifest-v1");
        vm.prank(builder);
        registry.registerProject("hello-zoryq", "ipfs://one", hash);
        vm.expectRevert(bytes("slug_taken"));
        registry.registerProject("hello-zoryq", "ipfs://two", keccak256("manifest-v2"));
    }

    function testRejectsUnsafeSlugCharacters() public {
        vm.startPrank(builder);
        vm.expectRevert(bytes("invalid_slug_character"));
        registry.registerProject("Hello_Zoryq", "ipfs://one", keccak256("a"));
        vm.expectRevert(bytes("invalid_slug_format"));
        registry.registerProject("-zoryq", "ipfs://one", keccak256("b"));
        vm.expectRevert(bytes("invalid_slug_format"));
        registry.registerProject("zoryq--app", "ipfs://one", keccak256("c"));
        vm.stopPrank();
    }

    function testOnlyOwnerCanUpdate() public {
        vm.prank(builder);
        uint256 id = registry.registerProject("builder-app", "https://example.dev/v1.json", keccak256("v1"));
        vm.expectRevert(bytes("not_project_owner"));
        registry.updateManifest(id, "https://example.dev/v2.json", keccak256("v2"));
        vm.prank(builder);
        registry.updateManifest(id, "https://example.dev/v2.json", keccak256("v2"));
        ZoryqProjectRegistry.Project memory p = registry.getProject(id);
        require(p.manifestHash == keccak256("v2"), "updated");
    }

    function testTransferProjectOwnershipRemovesOldOwnerIndex() public {
        vm.prank(builder);
        uint256 id = registry.registerProject("portable-project", "ipfs://project", keccak256("project"));
        vm.prank(builder);
        registry.transferProject(id, nextOwner);
        ZoryqProjectRegistry.Project memory p = registry.getProject(id);
        require(p.owner == nextOwner, "new_owner");
        uint256[] memory oldIds = registry.projectIdsOf(builder);
        uint256[] memory ids = registry.projectIdsOf(nextOwner);
        require(oldIds.length == 0, "old_owner_index");
        require(ids.length == 1 && ids[0] == id, "new_owner_index");
    }

    function testTransferKeepsOwnerIndexConsistentWithMultipleProjects() public {
        vm.startPrank(builder);
        uint256 first = registry.registerProject("first-app", "ipfs://first", keccak256("first"));
        uint256 second = registry.registerProject("second-app", "ipfs://second", keccak256("second"));
        registry.transferProject(first, nextOwner);
        vm.stopPrank();
        uint256[] memory oldIds = registry.projectIdsOf(builder);
        require(oldIds.length == 1 && oldIds[0] == second, "compacted_owner_index");
    }

    function testRejectsSameOwnerTransfer() public {
        vm.prank(builder);
        uint256 id = registry.registerProject("same-owner", "ipfs://project", keccak256("same"));
        vm.prank(builder);
        vm.expectRevert(bytes("same_owner"));
        registry.transferProject(id, builder);
    }
}
