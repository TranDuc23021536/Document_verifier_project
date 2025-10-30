import { useEffect, useState } from "react";
import { ethers } from "ethers";
import abi from "./abi/DocumentVerifier.json";
import "./App.css";

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

function App() {
  const [account, setAccount] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.ethereum) window.ethereum.request({ method: "eth_accounts" }).then(a => a.length && setAccount(a[0]));
  }, []);

  async function connectWallet() {
    if (!window.ethereum) return alert("Cài MetaMask trước đã!");
    const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(addr);
  }

  async function storeHashOnChain() {
    if (!file) return alert("Chọn file trước!");
    try {
      setBusy(true);
      setStatus("Tính SHA256...");
      const buffer = await file.arrayBuffer();
      const hash = ethers.sha256(new Uint8Array(buffer));
      setStatus("Gửi giao dịch...");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi.abi, signer);
      const tx = await contract.storeDocument(hash);
      await tx.wait();
      setStatus(`✅ Lưu thành công. Hash: ${hash}`);
      setHistory(h => [{ hash, fileName: file.name, time: Date.now() }, ...h]);
    } catch (e) {
      console.error(e);
      setStatus("Lỗi: " + (e?.reason || e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyFile() {
    if (!file) return alert("Chọn file trước!");
    try {
      setBusy(true);
      setStatus("Tính SHA256...");
      const buffer = await file.arrayBuffer();
      const hash = ethers.sha256(new Uint8Array(buffer));
      setStatus("Kiểm tra...");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi.abi, provider);
      const [exists, issuer, timestamp] = await contract.verifyDocument(hash);
      if (!exists) setStatus("❌ File chưa được lưu trên blockchain.");
      else setStatus(`✅ Có trên chain! Issuer: ${issuer} - ${new Date(Number(timestamp)*1000).toLocaleString()}`);
    } catch (e) {
      console.error(e);
      setStatus("Lỗi: " + (e?.reason || e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Document Verifier — Demo</h1>
        <div>
          {account ? <div className="wallet">{account}</div> : <button onClick={connectWallet} className="btn">Connect</button>}
        </div>
      </header>

      <main className="container">
        <section className="card">
          <h2>Upload & Save Hash</h2>
          <input type="file" onChange={e => setFile(e.target.files[0])} />
          {file && <div className="preview">{file.type.startsWith("image/") ? <img src={URL.createObjectURL(file)} alt="p" /> : <div>{file.name}</div>}</div>}

          <div className="actions">
            <button onClick={storeHashOnChain} className="btn" disabled={busy}>Save Hash</button>
            <button onClick={verifyFile} className="btn" disabled={busy}>Verify</button>
          </div>

          <pre className="status">{status || "Chưa có hoạt động"}</pre>
        </section>

        <aside className="card">
          <h3>History (local)</h3>
          {history.length === 0 ? <div className="muted">No history</div> : history.map((h, i) => (
            <div key={i} className="histItem">
              <div className="meta">{h.fileName}</div>
              <div className="hash">{h.hash}</div>
            </div>
          ))}
        </aside>
      </main>

      <footer className="footer">Demo — Document Verifier</footer>
    </div>
  );
}

export default App;
