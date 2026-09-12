// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqExternalWorkProof.sol";

contract RejectingTreasury {
    receive() external payable { revert("reject"); }
}

contract ExternalPayer {
    function pay(ZoryqExternalWorkProof proof, uint256 id) external payable {
        proof.payForDeliveredWork{value: msg.value}(id);
    }
}

contract ZoryqExternalWorkProofTest {
    receive() external payable {}

    function testExternalPaymentIsBoundToDeliveredWorkAndForwarded() public {
        ZoryqExternalWorkProof proof = new ZoryqExternalWorkProof();
        ExternalPayer payer = new ExternalPayer();
        bytes32 companyRef = keccak256("company-1");
        bytes32 specHash = keccak256("external-work-spec");
        bytes32 deliveryHash = keccak256("public-delivery-artifact");

        uint256 id = proof.createWorkOrder(payable(address(this)), companyRef, specHash);
        proof.recordDelivery(id, deliveryHash);

        uint256 beforeBalance = address(this).balance;
        payer.pay{value: 1 wei}(proof, id);
        require(address(this).balance == beforeBalance + 1 wei, "treasury did not receive payment");

        (
            , address owner, address treasury, bytes32 storedCompanyRef, bytes32 storedSpec,
            bytes32 storedDelivery, address storedPayer, uint256 revenue,,,, bool delivered, bool paid, bool cancelled
        ) = proof.workOrders(id);
        require(owner == address(this), "owner mismatch");
        require(treasury == address(this), "treasury mismatch");
        require(storedCompanyRef == companyRef && storedSpec == specHash, "work binding mismatch");
        require(storedDelivery == deliveryHash, "delivery mismatch");
        require(storedPayer == address(payer), "payer mismatch");
        require(revenue == 1 wei, "revenue mismatch");
        require(delivered && paid && !cancelled, "invalid final state");
        require(proof.proofDigest(id) != bytes32(0), "proof digest missing");
    }

    function testCannotPayBeforeDelivery() public {
        ZoryqExternalWorkProof proof = new ZoryqExternalWorkProof();
        ExternalPayer payer = new ExternalPayer();
        uint256 id = proof.createWorkOrder(payable(address(this)), keccak256("company"), keccak256("spec"));
        (bool ok,) = address(payer).call{value: 1 wei}(abi.encodeWithSelector(payer.pay.selector, proof, id));
        require(!ok, "payment before delivery must fail");
    }

    function testOwnerCannotSelfPayAndDoublePaymentFails() public {
        ZoryqExternalWorkProof proof = new ZoryqExternalWorkProof();
        ExternalPayer payer = new ExternalPayer();
        uint256 id = proof.createWorkOrder(payable(address(this)), keccak256("company"), keccak256("spec"));
        proof.recordDelivery(id, keccak256("delivery"));

        (bool selfPayOk,) = address(proof).call{value: 1 wei}(abi.encodeWithSelector(proof.payForDeliveredWork.selector, id));
        require(!selfPayOk, "owner self-payment must fail");

        payer.pay{value: 1 wei}(proof, id);
        (bool doublePayOk,) = address(payer).call{value: 1 wei}(abi.encodeWithSelector(payer.pay.selector, proof, id));
        require(!doublePayOk, "double payment must fail");
    }

    function testPaymentRevertsIfTreasuryRejectsFunds() public {
        ZoryqExternalWorkProof proof = new ZoryqExternalWorkProof();
        ExternalPayer payer = new ExternalPayer();
        RejectingTreasury rejecting = new RejectingTreasury();
        uint256 id = proof.createWorkOrder(payable(address(rejecting)), keccak256("company"), keccak256("spec"));
        proof.recordDelivery(id, keccak256("delivery"));

        (bool ok,) = address(payer).call{value: 1 wei}(abi.encodeWithSelector(payer.pay.selector, proof, id));
        require(!ok, "rejecting treasury must revert payment");
        (,,,,,, address storedPayer, uint256 revenue,,,, bool paid,) = proof.workOrders(id);
        require(storedPayer == address(0) && revenue == 0 && !paid, "failed transfer must not become revenue");
    }

    function testCancellationPreventsPaymentAndPaidWorkCannotBeCancelled() public {
        ZoryqExternalWorkProof proof = new ZoryqExternalWorkProof();
        ExternalPayer payer = new ExternalPayer();
        uint256 cancelledId = proof.createWorkOrder(payable(address(this)), keccak256("company-a"), keccak256("spec-a"));
        proof.recordDelivery(cancelledId, keccak256("delivery-a"));
        proof.cancelWorkOrder(cancelledId);
        (bool cancelledPayOk,) = address(payer).call{value: 1 wei}(abi.encodeWithSelector(payer.pay.selector, proof, cancelledId));
        require(!cancelledPayOk, "cancelled work must not accept payment");

        uint256 paidId = proof.createWorkOrder(payable(address(this)), keccak256("company-b"), keccak256("spec-b"));
        proof.recordDelivery(paidId, keccak256("delivery-b"));
        payer.pay{value: 1 wei}(proof, paidId);
        (bool cancelPaidOk,) = address(proof).call(abi.encodeWithSelector(proof.cancelWorkOrder.selector, paidId));
        require(!cancelPaidOk, "paid work must be immutable");
    }

    function testSpecAndDeliveryHashesCannotBeReused() public {
        ZoryqExternalWorkProof proof = new ZoryqExternalWorkProof();
        bytes32 specHash = keccak256("spec");
        bytes32 deliveryHash = keccak256("delivery");
        uint256 id = proof.createWorkOrder(payable(address(this)), keccak256("company-a"), specHash);
        proof.recordDelivery(id, deliveryHash);

        (bool specReuseOk,) = address(proof).call(abi.encodeWithSelector(proof.createWorkOrder.selector, payable(address(this)), keccak256("company-b"), specHash));
        require(!specReuseOk, "spec replay must fail");

        uint256 id2 = proof.createWorkOrder(payable(address(this)), keccak256("company-b"), keccak256("spec-2"));
        (bool deliveryReuseOk,) = address(proof).call(abi.encodeWithSelector(proof.recordDelivery.selector, id2, deliveryHash));
        require(!deliveryReuseOk, "delivery replay must fail");
    }
}
