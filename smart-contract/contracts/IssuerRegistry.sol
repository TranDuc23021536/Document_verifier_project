// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IssuerRegistry {
    struct Issuer {
        uint256 id;
        string name;
        string organization;
        string email;
        address owner;
    }

    mapping(uint256 => Issuer) public issuers;
    mapping(address => uint256[]) public ownerToIssuers;
    uint256 public issuerCount;

    event IssuerRegistered(uint256 id, address indexed owner, string name, string organization, string email);

    function registerIssuer(
        string memory name,
        string memory organization,
        string memory email
    ) external {
        require(bytes(name).length > 0, "Empty name");
        issuerCount++;

        issuers[issuerCount] = Issuer({
            id: issuerCount,
            name: name,
            organization: organization,
            email: email,
            owner: msg.sender
        });

        ownerToIssuers[msg.sender].push(issuerCount);

        emit IssuerRegistered(issuerCount, msg.sender, name, organization, email);
    }

    function getIssuer(uint256 id)
        external
        view
        returns (string memory, string memory, string memory, address)
    {
        Issuer memory issuer = issuers[id];
        return (issuer.name, issuer.organization, issuer.email, issuer.owner);
    }

    function getAllIssuers() external view returns (Issuer[] memory) {
        Issuer[] memory list = new Issuer[](issuerCount);
        for (uint256 i = 1; i <= issuerCount; i++) {
            list[i - 1] = issuers[i];
        }
        return list;
    }

    function getMyIssuers(address owner) external view returns (uint256[] memory) {
        return ownerToIssuers[owner];
    }
}
