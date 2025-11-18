// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IssuerRegistry.sol";

contract DocumentVerifier {
    struct Document {
        bool exists;
        uint256 issuerId;
        uint256 timestamp;
        address owner;
    }

    mapping(bytes32 => Document) public documents;
    IssuerRegistry public registry;

    event DocumentStored(bytes32 hash, uint256 issuerId, uint256 timestamp, address owner);
    event DocumentDeleted(bytes32 hash, address owner);

    constructor(address _registry) {
        registry = IssuerRegistry(_registry);
    }

    function storeDocument(bytes32 hash, uint256 issuerId) external {
        require(!documents[hash].exists, "Already stored");

        documents[hash] = Document({
            exists: true,
            issuerId: issuerId,
            timestamp: block.timestamp,
            owner: msg.sender
        });

        emit DocumentStored(hash, issuerId, block.timestamp, msg.sender);
    }

    function deleteDocument(bytes32 hash) external {
        require(documents[hash].exists, "Document does not exist");
        require(documents[hash].owner == msg.sender, "Not document owner");

        delete documents[hash];
        emit DocumentDeleted(hash, msg.sender);
    }

    function verifyDocument(bytes32 hash)
        external
        view
        returns (
            bool exists,
            uint256 issuerId,
            string memory name,
            string memory org,
            string memory email,
            address owner,
            uint256 timestamp
        )
    {
        Document memory doc = documents[hash];

        if (!doc.exists) return (false, 0, "", "", "", address(0), 0);

        (name, org, email, owner) = registry.getIssuer(doc.issuerId);

        return (
            true,
            doc.issuerId,
            name,
            org,
            email,
            doc.owner,
            doc.timestamp
        );
    }
}
