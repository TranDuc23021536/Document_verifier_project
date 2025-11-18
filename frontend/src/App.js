import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import verifierAbi from "./abi/DocumentVerifier.json";
import registryAbi from "./abi/IssuerRegistry.json";
import "./App.css";

const REGISTRY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const VERIFIER_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export default function App() {
  const [account, setAccount] = useState("");
  const [issuer, setIssuer] = useState({ name: "", organization: "", email: "" });
  const [issuersList, setIssuersList] = useState([]);
  const [selectedIssuer, setSelectedIssuer] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [errorLogs, setErrorLogs] = useState([]);

  const addHistory = (msg, type = "info") => {
    const time = new Date().toLocaleString();
    setHistory((prev) => [{ time, msg, type }, ...prev]);
  };

  const addError = (location, err, suggestion = "") => {
    const time = new Date().toLocaleString();
    const errMsg = err?.reason || err?.message || String(err);
    const details = {
      time,
      location,
      message: errMsg,
      suggestion: suggestion || "Check the console for more details.",
    };
    console.error(`❌ [${location}]`, err);
    setErrorLogs((prev) => [details, ...prev]);
    addHistory(`❌ ${location}: ${errMsg}`, "error");
    setStatus(`❌ Error at ${location}: ${errMsg}`);
  };

  const getProvider = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      provider.getNetwork = async () => ({ name: "hardhat", chainId: 31337, ensAddress: null });
      return provider;
    } catch (err) {
      addError("getProvider", err, "Check MetaMask or Hardhat node.");
      throw err;
    }
  };

  async function connectWallet() {
    try {
      if (!window.ethereum) throw new Error("MetaMask is not installed!");
      const provider = await getProvider();
      const [addr] = await provider.send("eth_requestAccounts", []);
      setAccount(addr);
      setStatus("✅ Connected to MetaMask!");
      addHistory(`🔗 MetaMask connected: ${addr}`);
    } catch (err) {
      addError("connectWallet", err, "Open MetaMask and try again.");
    }
  }

  async function registerIssuer() {
    try {
      setLoading(true);
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(REGISTRY_ADDRESS, registryAbi.abi, signer);

      if (!issuer.name || !issuer.organization || !issuer.email)
        throw new Error("Missing issuer information.");

      setStatus("⏳ Sending registration transaction...");
      const tx = await registry.registerIssuer(issuer.name, issuer.organization, issuer.email);
      await tx.wait();
      setStatus("✅ Issuer registered successfully!");
      addHistory(`✅ Registered Issuer: ${issuer.name} (${issuer.organization})`);
      setIssuer({ name: "", organization: "", email: "" });
      await loadIssuers();
    } catch (err) {
      if (err.reason?.includes("Empty name")) {
        addError("registerIssuer", err, "Issuer name cannot be empty.");
      } else {
        addError("registerIssuer", err);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadIssuers() {
    try {
      const provider = await getProvider();
      const registry = new ethers.Contract(REGISTRY_ADDRESS, registryAbi.abi, provider);
      const issuers = await registry.getAllIssuers();

      const formatted = issuers.map((i) => ({
        id: i.id.toString(),
        name: i.name,
        org: i.organization,
        email: i.email,
        owner: i.owner,
      }));
      setIssuersList(formatted);
      if (formatted.length > 0) {
        addHistory(`📋 Loaded ${formatted.length} issuers from blockchain`);
      }
    } catch (err) {
      addError("loadIssuers", err, "Check ABI or contract address.");
    }
  }

  useEffect(() => {
    loadIssuers();
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          addHistory(`🔗 Auto-connected: ${accounts[0]}`);
        }
      });
    }
  }, []);

  async function storeHash() {
    if (!file) return alert("⚠️ No file selected!");
    if (!selectedIssuer) return alert("⚠️ No issuer selected!");

    try {
      setLoading(true);
      setStatus("🔄 Computing SHA256 hash...");
      const buffer = await file.arrayBuffer();
      const hash = ethers.sha256(new Uint8Array(buffer));

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const verifier = new ethers.Contract(VERIFIER_ADDRESS, verifierAbi.abi, signer);

      setStatus("📤 Sending transaction to store hash...");
      const tx = await verifier.storeDocument(hash, Number(selectedIssuer));
      await tx.wait();

      setStatus(`✅ Hash stored successfully!
📝 File: ${file.name}
🔑 Hash: ${hash}
⛓ Tx: ${tx.hash}`);
      addHistory(`✅ Stored hash: ${file.name}`);
    } catch (err) {
      if (err.reason?.includes("Already stored"))
        addError("storeHash", err, "This document was already stored.");
      else addError("storeHash", err);
    } finally {
      setLoading(false);
    }
  }

  async function verifyFile() {
    if (!file) return alert("⚠️ No file selected!");
    try {
      setLoading(true);
      setStatus("🔄 Computing SHA256 hash...");
      const buffer = await file.arrayBuffer();
      const hash = ethers.sha256(new Uint8Array(buffer));

      setStatus("🔍 Verifying on blockchain...");
      const provider = await getProvider();
      const verifier = new ethers.Contract(VERIFIER_ADDRESS, verifierAbi.abi, provider);

      const [exists, id, name, org, email, owner, timestamp] = await verifier.verifyDocument(hash);
      if (!exists) throw new Error("This document is not stored on the blockchain.");

      const info = `✅ Document verified!

📝 File: ${file.name}
🔑 Hash: ${hash}

👤 Issuer: ${name}
🏢 Organization: ${org}
📧 Email: ${email}
💼 Owner: ${owner}
📅 Timestamp: ${new Date(Number(timestamp) * 1000).toLocaleString()}`;

      setStatus(info);
      addHistory(`✅ Verified file: ${file.name}`);
    } catch (err) {
      addError("verifyFile", err);
    } finally {
      setLoading(false);
    }
  }

  async function deleteFile() {
    if (!file) return alert("⚠️ No file selected!");

    try {
      setLoading(true);
      setStatus("🗑️ Computing SHA256 hash...");
      const buffer = await file.arrayBuffer();
      const hash = ethers.sha256(new Uint8Array(buffer));

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const verifier = new ethers.Contract(VERIFIER_ADDRESS, verifierAbi.abi, signer);

      setStatus("🗑️ Sending delete transaction...");
      const tx = await verifier.deleteDocument(hash);
      await tx.wait();

      setStatus(`✅ Document deleted!
🗑️ Hash: ${hash}
⛓ Tx: ${tx.hash}`);
      addHistory(`🗑️ Deleted document: ${file.name}`);
    } catch (err) {
      if (err.reason?.includes("Not document owner")) {
        addError("deleteFile", err, "You are not the owner of this document.");
      } else if (err.reason?.includes("Document does not exist")) {
        addError("deleteFile", err, "This document does not exist on the blockchain.");
      } else {
        addError("deleteFile", err);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>🔐 Blockchain Document Verifier</h1>

      <button onClick={connectWallet} className="connect-btn">
        {account ? `✅ ${account.slice(0, 6)}...${account.slice(-4)}` : "🔗 Connect MetaMask"}
      </button>

      <section>
        <h2>🏢 Register Issuer</h2>
        <input
          placeholder="Issuer Name"
          value={issuer.name}
          onChange={(e) => setIssuer({ ...issuer, name: e.target.value })}
        />
        <input
          placeholder="Organization"
          value={issuer.organization}
          onChange={(e) => setIssuer({ ...issuer, organization: e.target.value })}
        />
        <input
          placeholder="Email"
          value={issuer.email}
          type="email"
          onChange={(e) => setIssuer({ ...issuer, email: e.target.value })}
        />
        <button onClick={registerIssuer} disabled={loading}>
          {loading ? "⏳ Processing..." : "📝 Register Issuer"}
        </button>
      </section>

      <section>
        <h2>📁 Verify / Store / Delete Document</h2>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />

        {file && (
          <div
            style={{
              padding: "12px",
              background: "#f0f9ff",
              borderRadius: "10px",
              marginBottom: "16px",
              fontSize: "14px",
              color: "#0284c7",
            }}
          >
            📎 Selected: <strong>{file.name}</strong>{" "}
            ({(file.size / 1024).toFixed(2)} KB)
          </div>
        )}

        <select onChange={(e) => setSelectedIssuer(e.target.value)} value={selectedIssuer}>
          <option value="">-- Select Issuer --</option>
          {issuersList.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.org})
            </option>
          ))}
        </select>

        <button onClick={storeHash} disabled={loading}>
          {loading ? "⏳ Storing..." : "📤 Store Hash"}
        </button>

        <button onClick={verifyFile} disabled={loading}>
          {loading ? "🔍 Verifying..." : "✓ Verify"}
        </button>

        <button
          onClick={deleteFile}
          disabled={loading}
          style={{ background: "#dc2626" }}
        >
          {loading ? "🗑️ Deleting..." : "🗑️ Delete Document"}
        </button>
      </section>

      <pre className="status-box">
        {status || "💡 Select a document and choose an action"}
      </pre>

      <section>
        <h2>📜 Activity History</h2>
        <ul className="history-list">
          {history.length === 0 && (
            <li style={{ textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>
              No activity yet
            </li>
          )}
          {history.map((h, i) => (
            <li key={i} className={h.type}>
              <b>{h.time}</b>
              {h.msg}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>⚠️ Error Logs</h2>
        <ul className="error-list">
          {errorLogs.length === 0 && (
            <li
              style={{
                background: "#f0fdf4",
                borderLeftColor: "#22c55e",
                color: "#166534",
              }}
            >
              ✅ No errors – system is stable
            </li>
          )}
          {errorLogs.map((e, i) => (
            <li key={i}>
              <b>{e.time}</b>
              <u>{e.location}</u>: {e.message}
              <br />
              💡 <i>{e.suggestion}</i>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
