// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ZORYQ External Work Proof
/// @notice Evidence-gated public-testnet primitive for linking a work agreement,
///         a delivery hash and an actual incoming native-ZQ payment in one auditable record.
/// @dev Testnet primitive only. A recorded payment proves an onchain transfer associated
///      with declared work evidence; it does not prove legal/commercial validity offchain.
contract ZoryqExternalWorkProof {
    struct WorkOrder {
        uint256 id;
        address companyOwner;
        address payable treasury;
        bytes32 companyRef;
        bytes32 specHash;
        bytes32 deliveryHash;
        address payer;
        uint256 revenueZqWei;
        uint64 createdAt;
        uint64 deliveredAt;
        uint64 paidAt;
        bool delivered;
        bool paid;
        bool cancelled;
    }

    uint256 public workOrderCount;
    mapping(uint256 => WorkOrder) public workOrders;
    mapping(bytes32 => bool) public usedSpecHashes;
    mapping(bytes32 => bool) public usedDeliveryHashes;

    event WorkOrderCreated(
        uint256 indexed workOrderId,
        address indexed companyOwner,
        address indexed treasury,
        bytes32 companyRef,
        bytes32 specHash
    );
    event WorkDelivered(uint256 indexed workOrderId, bytes32 indexed deliveryHash);
    event ExternalRevenueReceived(
        uint256 indexed workOrderId,
        address indexed payer,
        address indexed treasury,
        uint256 amountZqWei,
        bytes32 deliveryHash
    );
    event WorkOrderCancelled(uint256 indexed workOrderId);

    function createWorkOrder(address payable treasury, bytes32 companyRef, bytes32 specHash)
        external
        returns (uint256 workOrderId)
    {
        require(treasury != address(0), "zero treasury");
        require(companyRef != bytes32(0), "company ref required");
        require(specHash != bytes32(0), "spec required");
        require(!usedSpecHashes[specHash], "spec already used");

        workOrderId = ++workOrderCount;
        usedSpecHashes[specHash] = true;
        workOrders[workOrderId] = WorkOrder({
            id: workOrderId,
            companyOwner: msg.sender,
            treasury: treasury,
            companyRef: companyRef,
            specHash: specHash,
            deliveryHash: bytes32(0),
            payer: address(0),
            revenueZqWei: 0,
            createdAt: uint64(block.timestamp),
            deliveredAt: 0,
            paidAt: 0,
            delivered: false,
            paid: false,
            cancelled: false
        });

        emit WorkOrderCreated(workOrderId, msg.sender, treasury, companyRef, specHash);
    }

    function recordDelivery(uint256 workOrderId, bytes32 deliveryHash) external {
        WorkOrder storage w = workOrders[workOrderId];
        require(w.id != 0, "unknown work order");
        require(msg.sender == w.companyOwner, "owner only");
        require(!w.cancelled, "cancelled");
        require(!w.delivered, "already delivered");
        require(!w.paid, "already paid");
        require(deliveryHash != bytes32(0), "delivery required");
        require(!usedDeliveryHashes[deliveryHash], "delivery already used");

        usedDeliveryHashes[deliveryHash] = true;
        w.deliveryHash = deliveryHash;
        w.deliveredAt = uint64(block.timestamp);
        w.delivered = true;
        emit WorkDelivered(workOrderId, deliveryHash);
    }

    /// @notice Client/payer pays native ZQ only after a delivery hash exists.
    /// @dev Funds are forwarded directly to the declared treasury. State is finalized
    ///      only if the transfer succeeds, so receipt status 0x1 proves both record and transfer.
    function payForDeliveredWork(uint256 workOrderId) external payable {
        WorkOrder storage w = workOrders[workOrderId];
        require(w.id != 0, "unknown work order");
        require(!w.cancelled, "cancelled");
        require(w.delivered, "delivery required");
        require(!w.paid, "already paid");
        require(msg.value > 0, "payment required");
        require(msg.sender != w.companyOwner, "external payer required");

        address payable treasury = w.treasury;
        (bool ok,) = treasury.call{value: msg.value}("");
        require(ok, "treasury transfer failed");

        w.payer = msg.sender;
        w.revenueZqWei = msg.value;
        w.paidAt = uint64(block.timestamp);
        w.paid = true;

        emit ExternalRevenueReceived(workOrderId, msg.sender, treasury, msg.value, w.deliveryHash);
    }

    function cancelWorkOrder(uint256 workOrderId) external {
        WorkOrder storage w = workOrders[workOrderId];
        require(w.id != 0, "unknown work order");
        require(msg.sender == w.companyOwner, "owner only");
        require(!w.paid, "paid work immutable");
        require(!w.cancelled, "already cancelled");
        w.cancelled = true;
        emit WorkOrderCancelled(workOrderId);
    }

    function paymentProof(uint256 workOrderId)
        external
        view
        returns (address payer, uint256 revenueZqWei, bool delivered, bool paid, bool cancelled)
    {
        WorkOrder storage w = workOrders[workOrderId];
        require(w.id != 0, "unknown work order");
        return (w.payer, w.revenueZqWei, w.delivered, w.paid, w.cancelled);
    }

    function proofDigest(uint256 workOrderId) external view returns (bytes32) {
        WorkOrder storage w = workOrders[workOrderId];
        require(w.id != 0, "unknown work order");
        return keccak256(abi.encode(
            block.chainid,
            address(this),
            w.id,
            w.companyOwner,
            w.treasury,
            w.companyRef,
            w.specHash,
            w.deliveryHash,
            w.payer,
            w.revenueZqWei,
            w.createdAt,
            w.deliveredAt,
            w.paidAt,
            w.delivered,
            w.paid,
            w.cancelled
        ));
    }
}
