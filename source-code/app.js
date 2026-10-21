/**
 * RoCEForge Pro - Application Controller & Visualizer
 * Version: 1.0.0
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const inputSpeed = document.getElementById('input-speed');
  const inputCableLength = document.getElementById('input-cable-length');
  const inputCableType = document.getElementById('input-cable-type');
  const inputSwitchAsic = document.getElementById('input-switch-asic');
  const inputNicModel = document.getElementById('input-nic-model');
  const inputMtu = document.getElementById('input-mtu');

  const valCableRtt = document.getElementById('val-cable-rtt');
  const valTotalFlight = document.getElementById('val-total-flight');
  const valInflightBytes = document.getElementById('val-inflight-bytes');
  const valReqHeadroom = document.getElementById('val-req-headroom');
  const valAllocHeadroom = document.getElementById('val-alloc-headroom');
  const valRecXoff = document.getElementById('val-rec-xoff');
  const valRecXon = document.getElementById('val-rec-xon');
  const badgeHeadroomStatus = document.getElementById('badge-headroom-status');

  const inputKmin = document.getElementById('input-kmin');
  const inputKmax = document.getElementById('input-kmax');
  const inputPmax = document.getElementById('input-pmax');
  const inputXoff = document.getElementById('input-xoff');
  const inputTotalBuffer = document.getElementById('input-total-buffer');
  const inputAlpha = document.getElementById('input-alpha');
  const labelHierarchyStatus = document.getElementById('label-hierarchy-status');
  const bufferBarEl = document.getElementById('buffer-bar-el');

  const inputBthOpcode = document.getElementById('input-bth-opcode');
  const inputDestQp = document.getElementById('input-dest-qp');
  const inputPsn = document.getElementById('input-psn');
  const checkSe = document.getElementById('check-se');
  const checkMig = document.getElementById('check-mig');
  const checkAck = document.getElementById('check-ack');
  const packetHexGrid = document.getElementById('packet-hex-grid');
  const lblBthName = document.getElementById('lbl-bth-name');
  const lblBthQp = document.getElementById('lbl-bth-qp');
  const lblBthPsn = document.getElementById('lbl-bth-psn');

  const badgeAuditGrade = document.getElementById('badge-audit-grade');
  const auditChecklistEl = document.getElementById('audit-checklist-el');
  const codeOutputEl = document.getElementById('code-output-el');
  const btnCopyCode = document.getElementById('btn-copy-code');

  const btnExportJson = document.getElementById('btn-export-json');
  const btnImportJson = document.getElementById('btn-import-json');
  const fileImport = document.getElementById('file-import');
  const btnRunAudit = document.getElementById('btn-run-audit');

  let activeTab = 'arista';
  let activePreset = 'hyperscale-800g';

  const PRESETS = {
    'hyperscale-800g': {
      speedGbps: 800,
      cableLengthM: 5,
      cableType: 'DAC_COPPER',
      switchLatency: 'TOMAHAWK_5',
      nicLatency: 'CONNECTX_8',
      mtuBytes: 9216,
      kMinKB: 64,
      kMaxKB: 256,
      pMaxPercent: 20,
      xoffKB: 384,
      totalBufferKB: 1024,
      bufferAlpha: 2,
      pfcPriority: 3,
      pfcEnabled: true,
      pfcOnBestEffort: false,
      trustDscp: true,
      dscpRoce: 26,
      pfcWatchdogEnabled: true,
      pfcWatchdogTimerMs: 100,
      pfcWatchdogAction: 'drop',
      cnpHighPriority: true,
      cnpDscp: 48,
      telemetryEnabled: true
    },
    'enterprise-100g': {
      speedGbps: 100,
      cableLengthM: 15,
      cableType: 'AOC_ACTIVE',
      switchLatency: 'TOMAHAWK_4',
      nicLatency: 'CONNECTX_6_DX',
      mtuBytes: 9000,
      kMinKB: 48,
      kMaxKB: 192,
      pMaxPercent: 25,
      xoffKB: 256,
      totalBufferKB: 512,
      bufferAlpha: 4,
      pfcPriority: 3,
      pfcEnabled: true,
      pfcOnBestEffort: false,
      trustDscp: true,
      dscpRoce: 26,
      pfcWatchdogEnabled: true,
      pfcWatchdogTimerMs: 150,
      pfcWatchdogAction: 'drop',
      cnpHighPriority: true,
      cnpDscp: 48,
      telemetryEnabled: true
    },
    'vulnerable-deadlock': {
      speedGbps: 100,
      cableLengthM: 100,
      cableType: 'SMF_FIBER',
      switchLatency: 'TOMAHAWK_3',
      nicLatency: 'GENERIC_RDMA_NIC',
      mtuBytes: 1500,
      kMinKB: 256,
      kMaxKB: 512,
      pMaxPercent: 5,
      xoffKB: 256,
      totalBufferKB: 256,
      bufferAlpha: 8,
      pfcPriority: 0,
      pfcEnabled: true,
      pfcOnBestEffort: true,
      trustDscp: false,
      dscpRoce: 0,
      pfcWatchdogEnabled: false,
      pfcWatchdogTimerMs: 1000,
      pfcWatchdogAction: 'none',
      cnpHighPriority: false,
      cnpDscp: 0,
      telemetryEnabled: false
    }
  };

  function loadPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    activePreset = key;

    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === key);
    });

    inputSpeed.value = p.speedGbps;
    inputCableLength.value = p.cableLengthM;
    inputCableType.value = p.cableType;
    inputSwitchAsic.value = p.switchLatency;
    inputNicModel.value = p.nicLatency;
    inputMtu.value = p.mtuBytes;

    inputKmin.value = p.kMinKB;
    inputKmax.value = p.kMaxKB;
    inputPmax.value = p.pMaxPercent;
    inputXoff.value = p.xoffKB;
    inputTotalBuffer.value = p.totalBufferKB;
    inputAlpha.value = p.bufferAlpha;

    updateCalculations();
  }

  function updateCalculations() {
    const speed = Number(inputSpeed.value);
    const cableLen = Number(inputCableLength.value);
    const cableType = inputCableType.value;
    const switchAsic = inputSwitchAsic.value;
    const nicModel = inputNicModel.value;
    const mtu = Number(inputMtu.value);

    const headroom = RoCEProtocolEngine.calculateHeadroom({
      speedGbps: speed,
      cableLengthM: cableLen,
      cableType,
      switchLatency: switchAsic,
      nicLatency: nicModel,
      mtuBytes: mtu,
      jitterMarginNs: 150,
      asicCellSizeBytes: 256
    });

    valCableRtt.textContent = `${headroom.cableRttNs} ns`;
    valTotalFlight.textContent = `${headroom.totalFlightTimeNs} ns`;
    valInflightBytes.textContent = `${Math.round((headroom.inFlightBytes / 1024) * 10) / 10} KB`;
    valReqHeadroom.textContent = `${Math.round((headroom.rawHeadroomBytes / 1024) * 10) / 10} KB`;
    valAllocHeadroom.textContent = `${headroom.allocatedHeadroomKB} KB`;
    valRecXoff.textContent = `${headroom.recommendedXoffKB} KB`;
    valRecXon.textContent = `${headroom.recommendedXonKB} KB`;

    if (headroom.allocatedHeadroomBytes >= headroom.rawHeadroomBytes) {
      badgeHeadroomStatus.className = 'badge badge-green';
      badgeHeadroomStatus.textContent = 'Optimal Margin';
    } else {
      badgeHeadroomStatus.className = 'badge badge-rose';
      badgeHeadroomStatus.textContent = 'Buffer Deficit';
    }

    const kMinBytes = Number(inputKmin.value) * 1024;
    const kMaxBytes = Number(inputKmax.value) * 1024;
    const pMax = Number(inputPmax.value);
    const xoffBytes = Number(inputXoff.value) * 1024;
    const totalBufferBytes = Number(inputTotalBuffer.value) * 1024;

    const dcqcn = RoCEProtocolEngine.evaluateDCQCNThresholds({
      kMinBytes,
      kMaxBytes,
      pMaxPercent: pMax,
      xoffBytes,
      headroomBytes: headroom.allocatedHeadroomBytes,
      totalBufferBytes
    });

    if (dcqcn.isHealthy) {
      labelHierarchyStatus.style.color = 'var(--accent-green)';
      labelHierarchyStatus.textContent = 'Hierarchy OK: Kmin < Kmax < Xoff';
    } else {
      labelHierarchyStatus.style.color = 'var(--accent-rose)';
      const firstIssue = dcqcn.issues[0] ? dcqcn.issues[0].message : 'Hierarchy Violation';
      labelHierarchyStatus.textContent = firstIssue;
    }

    renderBufferBar(dcqcn);
    updateBthDissection();
    runAudit(headroom, dcqcn);
    updateConfigSynthesizer(headroom, dcqcn);
  }

  function renderBufferBar(dcqcn) {
    const total = Math.max(dcqcn.totalBufferBytes, dcqcn.xoffBytes + dcqcn.headroomBytes);
    const kMinPct = Math.min(100, Math.max(2, (dcqcn.kMinBytes / total) * 100));
    const kMaxDeltaPct = Math.min(100, Math.max(2, (Math.max(0, dcqcn.kMaxBytes - dcqcn.kMinBytes) / total) * 100));
    const xoffDeltaPct = Math.min(100, Math.max(2, (Math.max(0, dcqcn.xoffBytes - dcqcn.kMaxBytes) / total) * 100));
    const headroomPct = Math.min(100, Math.max(2, (dcqcn.headroomBytes / total) * 100));
    const usedPct = kMinPct + kMaxDeltaPct + xoffDeltaPct + headroomPct;
    const freePct = Math.max(0, 100 - usedPct);

    bufferBarEl.innerHTML = `
      <div class="buf-seg buf-kmin" style="width: ${kMinPct}%" title="Kmin: ${dcqcn.kMinKB}KB">Kmin (${dcqcn.kMinKB}K)</div>
      <div class="buf-seg buf-kmax" style="width: ${kMaxDeltaPct}%" title="WRED Zone: ${dcqcn.kMaxKB}KB">WRED (${Math.round((dcqcn.kMaxBytes - dcqcn.kMinBytes)/1024)}K)</div>
      <div class="buf-seg buf-xoff" style="width: ${xoffDeltaPct}%" title="Xoff: ${dcqcn.xoffKB}KB">100% Mark (${Math.max(0, dcqcn.xoffKB - dcqcn.kMaxKB)}K)</div>
      <div class="buf-seg buf-headroom" style="width: ${headroomPct}%" title="Headroom: ${dcqcn.headroomKB}KB">Headroom (${dcqcn.headroomKB}K)</div>
      <div class="buf-seg buf-free" style="width: ${freePct}%" title="Shared/Free Pool">Shared Free</div>
    `;
  }

  function updateBthDissection() {
    const opcode = parseInt(inputBthOpcode.value, 16);
    const destQp = Number(inputDestQp.value) || 1048576;
    const psn = Number(inputPsn.value) || 38421;
    const se = checkSe.checked;
    const mig = checkMig.checked;
    const ack = checkAck.checked;

    const bth = RoCEProtocolEngine.encodeBTH({
      opcode,
      solicitedEvent: se,
      migReq: mig,
      padCount: 0,
      pKey: 0xFFFF,
      destQp,
      ackReq: ack,
      psn
    });

    packetHexGrid.innerHTML = '';
    bth.bytes.forEach((b, idx) => {
      const cell = document.createElement('div');
      cell.className = 'packet-byte-cell';
      cell.innerHTML = `
        <div class="byte-idx">B${idx}</div>
        <div class="byte-val">${b.toString(16).padStart(2, '0').toUpperCase()}</div>
      `;
      packetHexGrid.appendChild(cell);
    });

    lblBthName.textContent = bth.opcodeName;
    lblBthQp.textContent = bth.destQpHex;
    lblBthPsn.textContent = bth.psnHex;
  }

  function runAudit(headroom, dcqcn) {
    const currentPresetObj = PRESETS[activePreset] || PRESETS['hyperscale-800g'];
    const auditConfig = {
      pfcEnabled: currentPresetObj.pfcEnabled,
      pfcPriority: currentPresetObj.pfcPriority,
      pfcOnBestEffort: currentPresetObj.pfcOnBestEffort,
      trustDscp: currentPresetObj.trustDscp,
      dscpRoce: currentPresetObj.dscpRoce,
      kMinBytes: dcqcn.kMinBytes,
      kMaxBytes: dcqcn.kMaxBytes,
      xoffBytes: dcqcn.xoffBytes,
      allocatedHeadroomBytes: headroom.allocatedHeadroomBytes,
      requiredHeadroomBytes: headroom.rawHeadroomBytes,
      pfcWatchdogEnabled: currentPresetObj.pfcWatchdogEnabled,
      pfcWatchdogTimerMs: currentPresetObj.pfcWatchdogTimerMs,
      pfcWatchdogAction: currentPresetObj.pfcWatchdogAction,
      mtuBytes: Number(inputMtu.value),
      bufferAlpha: Number(inputAlpha.value),
      cnpHighPriority: currentPresetObj.cnpHighPriority,
      cnpDscp: currentPresetObj.cnpDscp,
      pMaxPercent: Number(inputPmax.value),
      telemetryEnabled: currentPresetObj.telemetryEnabled
    };

    const audit = RoCESecurityAuditor.auditRoCEFabric(auditConfig);

    badgeAuditGrade.textContent = `Grade ${audit.grade} (${audit.percentage}%)`;
    if (audit.percentage >= 90) {
      badgeAuditGrade.className = 'badge badge-green';
    } else if (audit.percentage >= 70) {
      badgeAuditGrade.className = 'badge badge-amber';
    } else {
      badgeAuditGrade.className = 'badge badge-rose';
    }

    auditChecklistEl.innerHTML = '';
    audit.results.forEach(res => {
      const item = document.createElement('div');
      item.className = 'audit-item';
      item.innerHTML = `
        <div class="audit-left">
          <div class="audit-title">${res.name}</div>
          <div class="audit-desc">${res.details}</div>
        </div>
        <div class="audit-badge ${res.passed ? 'badge-green' : 'badge-rose'}">
          ${res.passed ? 'PASS (' + res.score + '/' + res.maxScore + ')' : 'FAIL (' + res.score + '/' + res.maxScore + ')'}
        </div>
      `;
      auditChecklistEl.appendChild(item);
    });
  }

  function updateConfigSynthesizer(headroom, dcqcn) {
    const currentPresetObj = PRESETS[activePreset] || PRESETS['hyperscale-800g'];
    const synthParams = {
      speedGbps: Number(inputSpeed.value),
      cableLengthM: Number(inputCableLength.value),
      pfcPriority: currentPresetObj.pfcPriority,
      dscpRoce: currentPresetObj.dscpRoce || 26,
      cnpDscp: currentPresetObj.cnpDscp || 48,
      kMinBytes: dcqcn.kMinBytes,
      kMaxBytes: dcqcn.kMaxBytes,
      pMaxPercent: Number(inputPmax.value),
      xoffBytes: dcqcn.xoffBytes,
      recommendedXonBytes: headroom.recommendedXonBytes,
      allocatedHeadroomBytes: headroom.allocatedHeadroomBytes,
      pfcWatchdogTimerMs: currentPresetObj.pfcWatchdogTimerMs || 100,
      bufferAlpha: Number(inputAlpha.value),
      mtuBytes: Number(inputMtu.value)
    };

    let code = '';
    if (activeTab === 'arista') {
      code = RoCEConfigSynthesizer.generateAristaEOS(synthParams);
    } else if (activeTab === 'cumulus') {
      code = RoCEConfigSynthesizer.generateNvidiaCumulus(synthParams);
    } else if (activeTab === 'cisco') {
      code = RoCEConfigSynthesizer.generateCiscoNexus(synthParams);
    } else if (activeTab === 'juniper') {
      code = RoCEConfigSynthesizer.generateJuniperJunos(synthParams);
    } else if (activeTab === 'prometheus') {
      code = RoCEConfigSynthesizer.generatePrometheusRules(synthParams);
    }
    codeOutputEl.textContent = code;
  }

  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      loadPreset(btn.dataset.preset);
    });
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      updateCalculations();
    });
  });

  [inputSpeed, inputCableLength, inputCableType, inputSwitchAsic, inputNicModel, inputMtu,
   inputKmin, inputKmax, inputPmax, inputXoff, inputTotalBuffer, inputAlpha,
   inputBthOpcode, inputDestQp, inputPsn, checkSe, checkMig, checkAck].forEach(input => {
    input.addEventListener('input', updateCalculations);
    input.addEventListener('change', updateCalculations);
  });

  btnCopyCode.addEventListener('click', () => {
    navigator.clipboard.writeText(codeOutputEl.textContent).then(() => {
      btnCopyCode.textContent = 'Copied!';
      setTimeout(() => { btnCopyCode.textContent = 'Copy Config'; }, 2000);
    });
  });

  btnExportJson.addEventListener('click', () => {
    const profile = {
      schema: 'roceforge-pro-profile-v1',
      timestamp: new Date().toISOString(),
      activePreset,
      settings: {
        speedGbps: Number(inputSpeed.value),
        cableLengthM: Number(inputCableLength.value),
        cableType: inputCableType.value,
        switchLatency: inputSwitchAsic.value,
        nicLatency: inputNicModel.value,
        mtuBytes: Number(inputMtu.value),
        kMinKB: Number(inputKmin.value),
        kMaxKB: Number(inputKmax.value),
        pMaxPercent: Number(inputPmax.value),
        xoffKB: Number(inputXoff.value),
        totalBufferKB: Number(inputTotalBuffer.value),
        bufferAlpha: Number(inputAlpha.value)
      }
    };
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roceforge-profile-${activePreset}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnImportJson.addEventListener('click', () => {
    fileImport.click();
  });

  fileImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.settings) {
          inputSpeed.value = data.settings.speedGbps || 800;
          inputCableLength.value = data.settings.cableLengthM || 5;
          inputCableType.value = data.settings.cableType || 'DAC_COPPER';
          inputSwitchAsic.value = data.settings.switchLatency || 'TOMAHAWK_5';
          inputNicModel.value = data.settings.nicLatency || 'CONNECTX_8';
          inputMtu.value = data.settings.mtuBytes || 9216;
          inputKmin.value = data.settings.kMinKB || 64;
          inputKmax.value = data.settings.kMaxKB || 256;
          inputPmax.value = data.settings.pMaxPercent || 20;
          inputXoff.value = data.settings.xoffKB || 384;
          inputTotalBuffer.value = data.settings.totalBufferKB || 1024;
          inputAlpha.value = data.settings.bufferAlpha || 2;
          updateCalculations();
          alert('Profile loaded successfully!');
        }
      } catch (err) {
        alert('Invalid JSON profile file.');
      }
    };
    reader.readAsText(file);
  });

  btnRunAudit.addEventListener('click', () => {
    updateCalculations();
    alert(`Audit Completed: ${badgeAuditGrade.textContent}`);
  });

  loadPreset('hyperscale-800g');
});
