// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DocumentVerifier {
    struct Document {
        address issuer;
        uint256 timestamp;
    }

    mapping(bytes32 => Document) public documents;

    event DocumentUploaded(bytes32 hash, address issuer, uint256 timestamp);

    function storeDocument(bytes32 hash) public {
        require(documents[hash].issuer == address(0), "Already stored!");
        documents[hash] = Document(msg.sender, block.timestamp);
        emit DocumentUploaded(hash, msg.sender, block.timestamp);
    }

    function verifyDocument(bytes32 hash)
        public
        view
        returns (bool exists, address issuer, uint256 timestamp)
    {
        Document memory doc = documents[hash];
        if (doc.issuer == address(0)) return (false, address(0), 0);
        return (true, doc.issuer, doc.timestamp);
    }
}
