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
    }

    function testSlugIsUnique() public {
        bytes32 hash = keccak256("manifest-v1");
        vm.prank(builder);
        registry.registerProject("hello-zoryq", "ipfs://one", hash);
        vm.expectRevert("slug_taken");
        registry.registerProject("hello-zoryq", "ipfs://two", keccak256("manifest-v2"));
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

    function testTransferProjectOwnership() public {
        vm.prank(builder);
        uint256 id = registry.registerProject("portable-project", "ipfs://project", keccak256("project"));
        vm.prank(builder);
        registry.transferProject(id, nextOwner);
        ZoryqProjectRegistry.Project memory p = registry.getProject(id);
        assertEq(p.owner, nextOwner);
        uint256[] memory ids = registry.projectIdsOf(nextOwner);
        assertEq(ids.length, 1);
        assertEq(ids[0], id);
    }
}
