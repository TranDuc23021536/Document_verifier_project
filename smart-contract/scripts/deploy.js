const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying DocumentVerifier...");
  const DocumentVerifier = await hre.ethers.getContractFactory("DocumentVerifier");
  const contract = await DocumentVerifier.deploy();
  await contract.waitForDeployment();
  console.log("✅ Contract deployed at:", await contract.getAddress());
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exitCode = 1;
});
