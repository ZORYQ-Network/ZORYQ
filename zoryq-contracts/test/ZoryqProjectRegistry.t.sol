// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ZoryqProjectRegistry.sol";

contract ZoryqProjectRegistryTest is Test {
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
        assertEq(p.owner, builder);
        assertEq(p.slug, "hello-zoryq");
        assertEq(p.manifestURI, "ipfs://example-v1");
        assertEq(p.manifestHash, hash);
        assertTrue(p.active);
        assertTrue(registry.projectExists(id));
        assertEq(registry.projectIdBySlug("hello-zoryq"), id);
    }

    function testSlugIsUnique() public {
        bytes32 hash = keccak256("manifest-v1");
        vm.prank(builder);
        registry.registerProject("hello-zoryq", "ipfs://one", hash);
        vm.expectRevert("slug_taken");
        registry.registerProject("hello-zoryq", "ipfs://two", keccak256("manifest-v2"));
    }

    function testRejectsUnsafeSlugCharacters() public {
        vm.startPrank(builder);
        vm.expectRevert("invalid_slug_character");
        registry.registerProject("Hello_Zoryq", "ipfs://one", keccak256("a"));
        vm.expectRevert("invalid_slug_format");
        registry.registerProject("-zoryq", "ipfs://one", keccak256("b"));
        vm.expectRevert("invalid_slug_format");
        registry.registerProject("zoryq--app", "ipfs://one", keccak256("c"));
        vm.stopPrank();
    }

    function testOnlyOwnerCanUpdate() public {
        vm.prank(builder);
        uint256 id = registry.registerProject("builder-app", "https://example.dev/v1.json", keccak256("v1"));
        vm.expectRevert("not_project_owner");
        registry.updateManifest(id, "https://example.dev/v2.json", keccak256("v2"));
        vm.prank(builder);
        registry.updateManifest(id, "https://example.dev/v2.json", keccak256("v2"));
        ZoryqProjectRegistry.Project memory p = registry.getProject(id);
        assertEq(p.manifestHash, keccak256("v2"));
    }

    function testTransferProjectOwnershipRemovesOldOwnerIndex() public {
        vm.prank(builder);
        uint256 id = registry.registerProject("portable-project", "ipfs://project", keccak256("project"));
        vm.prank(builder);
        registry.transferProject(id, nextOwner);
        ZoryqProjectRegistry.Project memory p = registry.getProject(id);
        assertEq(p.owner, nextOwner);
        uint256[] memory oldIds = registry.projectIdsOf(builder);
        uint256[] memory ids = registry.projectIdsOf(nextOwner);
        assertEq(oldIds.length, 0);
        assertEq(ids.length, 1);
        assertEq(ids[0], id);
    }

    function testTransferKeepsOwnerIndexConsistentWithMultipleProjects() public {
        vm.startPrank(builder);
        uint256 first = registry.registerProject("first-app", "ipfs://first", keccak256("first"));
        uint256 second = registry.registerProject("second-app", "ipfs://second", keccak256("second"));
        registry.transferProject(first, nextOwner);
        vm.stopPrank();
        uint256[] memory oldIds = registry.projectIdsOf(builder);
        assertEq(oldIds.length, 1);
        assertEq(oldIds[0], second);
    }

    function testRejectsSameOwnerTransfer() public {
        vm.prank(builder);
        uint256 id = registry.registerProject("same-owner", "ipfs://project", keccak256("same"));
        vm.prank(builder);
        vm.expectRevert("same_owner");
        registry.transferProject(id, builder);
    }
}
