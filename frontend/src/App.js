import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import verifierAbi from "./abi/DocumentVerifier.json";
import registryAbi from "./abi/IssuerRegistry.json";
import "./App.css";

const VERIFIER_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const REGISTRY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

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
      suggestion: suggestion || "Xem console để biết chi tiết thêm.",
    };
    console.error(`❌ [${location}]`, err);
    setErrorLogs((prev) => [details, ...prev]);
    addHistory(`❌ ${location}: ${errMsg}`, "error");
    setStatus(`❌ Lỗi tại ${location}: ${errMsg}`);
  };

  const getProvider = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      provider.getNetwork = async () => ({ name: "hardhat", chainId: 31337, ensAddress: null });
      return provider;
    } catch (err) {
      addError("getProvider", err, "Kiểm tra MetaMask hoặc Hardhat node.");
      throw err;
    }
  };

  async function connectWallet() {
    try {
      if (!window.ethereum) throw new Error("MetaMask chưa được cài!");
      const provider = await getProvider();
      const [addr] = await provider.send("eth_requestAccounts", []);
      setAccount(addr);
      setStatus("✅ Kết nối MetaMask thành công!");
      addHistory(`🔗 Kết nối MetaMask thành công: ${addr}`);
    } catch (err) {
      addError("connectWallet", err, "Hãy mở MetaMask và thử lại.");
    }
  }

  async function registerIssuer() {
    try {
      setLoading(true);
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(REGISTRY_ADDRESS, registryAbi.abi, signer);

      if (!issuer.name || !issuer.organization || !issuer.email)
        throw new Error("Thiếu thông tin Issuer.");

      setStatus("⏳ Đang gửi giao dịch đăng ký...");
      const tx = await registry.registerIssuer(issuer.name, issuer.organization, issuer.email);
      await tx.wait();
      setStatus("✅ Đăng ký Issuer thành công!");
      addHistory(`✅ Đăng ký Issuer: ${issuer.name} (${issuer.organization})`);
      setIssuer({ name: "", organization: "", email: "" });
      await loadIssuers();
    } catch (err) {
      if (err.reason?.includes("Empty name")) {
        addError("registerIssuer", err, "Tên Issuer không được để trống.");
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
        addHistory(`📋 Đã tải ${formatted.length} issuer(s) từ blockchain`);
      }
    } catch (err) {
      addError("loadIssuers", err, "Kiểm tra ABI và contract address.");
    }
  }

  useEffect(() => {
    loadIssuers();
    // Auto-connect if already connected
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" })
        .then(accounts => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            addHistory(`🔗 Tự động kết nối: ${accounts[0]}`);
          }
        });
    }
  }, []);

  async function storeHash() {
    if (!file) return alert("⚠️ Chưa chọn file!");
    if (!selectedIssuer) return alert("⚠️ Chưa chọn Issuer!");

    try {
      setLoading(true);
      setStatus("🔄 Đang tính toán SHA256 hash...");
      const buffer = await file.arrayBuffer();
      const hash = ethers.sha256(new Uint8Array(buffer));

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const verifier = new ethers.Contract(VERIFIER_ADDRESS, verifierAbi.abi, signer);

      setStatus("📤 Đang gửi giao dịch lưu hash...");
      const tx = await verifier.storeDocument(hash, Number(selectedIssuer));
      await tx.wait();
      
      setStatus(`✅ Lưu hash thành công!\n\n📝 File: ${file.name}\n🔑 Hash: ${hash}\n⛓️ Transaction: ${tx.hash}`);
      addHistory(`✅ Lưu hash: ${file.name}`);
    } catch (err) {
      if (err.reason?.includes("Already stored"))
        addError("storeHash", err, "Tài liệu này đã được lưu trước đó.");
      else addError("storeHash", err);
    } finally {
      setLoading(false);
    }
  }

  async function verifyFile() {
    if (!file) return alert("⚠️ Chưa chọn file!");
    try {
      setLoading(true);
      setStatus("🔄 Đang tính toán SHA256 hash...");
      const buffer = await file.arrayBuffer();
      const hash = ethers.sha256(new Uint8Array(buffer));
      
      setStatus("🔍 Đang xác minh trên blockchain...");
      const provider = await getProvider();
      const verifier = new ethers.Contract(VERIFIER_ADDRESS, verifierAbi.abi, provider);

      const [exists, id, name, org, email, owner, timestamp] = await verifier.verifyDocument(hash);
      if (!exists) throw new Error("File chưa được lưu trên blockchain.");

      const info = `✅ File hợp lệ!\n\n📝 File: ${file.name}\n🔑 Hash: ${hash}\n\n👤 Issuer: ${name}\n🏢 Tổ chức: ${org}\n📧 Email: ${email}\n💼 Owner: ${owner}\n📅 Thời gian: ${new Date(
        Number(timestamp) * 1000
      ).toLocaleString()}`;
      setStatus(info);
      addHistory(`✅ Xác minh file: ${file.name}`);
    } catch (err) {
      if (err.message?.includes("chưa được lưu")) {
        addError("verifyFile", err, "File này chưa được đăng ký trên blockchain.");
      } else {
        addError("verifyFile", err, "Kiểm tra xem file đã được lưu chưa.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>🔐 Blockchain Document Verifier</h1>
      
      <button onClick={connectWallet} className="connect-btn">
        {account ? `✅ ${account.slice(0, 6)}...${account.slice(-4)}` : "🔗 Kết nối MetaMask"}
      </button>

      <section>
        <h2>🏢 Đăng ký Issuer</h2>
        <input 
          placeholder="Tên issuer" 
          value={issuer.name}
          onChange={(e) => setIssuer({ ...issuer, name: e.target.value })} 
        />
        <input
          placeholder="Tổ chức"
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
          {loading ? "⏳ Đang xử lý..." : "📝 Đăng ký Issuer"}
        </button>
      </section>

      <section>
        <h2>📁 Xác minh / Lưu tài liệu</h2>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        {file && (
          <div style={{
            padding: '12px',
            background: '#f0f9ff',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#0284c7'
          }}>
            📎 Đã chọn: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
          </div>
        )}
        <select onChange={(e) => setSelectedIssuer(e.target.value)} value={selectedIssuer}>
          <option value="">-- Chọn Issuer --</option>
          {issuersList.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.org})
            </option>
          ))}
        </select>
        <button onClick={storeHash} disabled={loading}>
          {loading ? "⏳ Đang lưu..." : "📤 Lưu Hash"}
        </button>
        <button onClick={verifyFile} disabled={loading}>
          {loading ? "🔍 Đang kiểm tra..." : "✓ Xác minh"}
        </button>
      </section>

      <pre className="status-box">{status || "💡 Chọn file và thực hiện các thao tác trên"}</pre>

      <section>
        <h2>📜 Lịch sử hoạt động</h2>
        <ul className="history-list">
          {history.length === 0 && (
            <li style={{textAlign: 'center', color: '#94a3b8', fontStyle: 'italic'}}>
              Chưa có hoạt động nào
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
        <h2>⚠️ Log lỗi chi tiết</h2>
        <ul className="error-list">
          {errorLogs.length === 0 && (
            <li style={{background: '#f0fdf4', borderLeftColor: '#22c55e', color: '#166534'}}>
              ✅ Không có lỗi nào - Hệ thống hoạt động bình thường
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