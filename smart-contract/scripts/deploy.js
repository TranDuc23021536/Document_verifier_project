const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Registry = await hre.ethers.getContractFactory("IssuerRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  console.log("✅ IssuerRegistry:", registry.target);

  const Verifier = await hre.ethers.getContractFactory("DocumentVerifier");
  const verifier = await Verifier.deploy(registry.target);
  await verifier.waitForDeployment();
  console.log("✅ DocumentVerifier:", verifier.target);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
