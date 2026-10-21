/**
 * RoCEForge Pro - RoCEv2 (RDMA over Converged Ethernet v2) Protocol & Buffer Physics Engine
 * Version: 1.0.0
 * Standards: InfiniBand Trade Association (IBTA) RoCEv2, RFC 5040, IEEE 802.1Qbb (PFC), RFC 3168 (ECN/DCQCN)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RoCEProtocolEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PHYSICAL_CONSTANTS = {
    CABLE_PROPAGATION_DELAY_NS_PER_M: {
      DAC_COPPER: 5.0,
      AOC_ACTIVE: 4.9,
      SMF_FIBER: 4.9
    },
    ASIC_LATENCY_NS: {
      TOMAHAWK_3: 850,
      TOMAHAWK_4: 550,
      TOMAHAWK_5: 400,
      SPECTRUM_2: 600,
      SPECTRUM_3: 450,
      SPECTRUM_4: 380,
      SILICON_ONE: 500,
      GENERIC_LOW_LATENCY: 500
    },
    NIC_REACTION_TIME_NS: {
      CONNECTX_5: 450,
      CONNECTX_6_DX: 350,
      CONNECTX_7: 280,
      CONNECTX_8: 220,
      GENERIC_RDMA_NIC: 350
    },
    PFC_ETHERTYPE: 0x8808,
    PFC_OPCODE: 0x0101,
    ROCEV2_UDP_PORT: 4791,
    BTH_OPCODES: {
      0x00: { name: 'RC_SEND_FIRST', type: 'RC', desc: 'Reliable Connection Send First' },
      0x01: { name: 'RC_SEND_MIDDLE', type: 'RC', desc: 'Reliable Connection Send Middle' },
      0x02: { name: 'RC_SEND_LAST', type: 'RC', desc: 'Reliable Connection Send Last' },
      0x03: { name: 'RC_SEND_LAST_IMM', type: 'RC', desc: 'RC Send Last with Immediate' },
      0x04: { name: 'RC_SEND_ONLY', type: 'RC', desc: 'Reliable Connection Send Only' },
      0x05: { name: 'RC_SEND_ONLY_IMM', type: 'RC', desc: 'RC Send Only with Immediate' },
      0x06: { name: 'RC_RDMA_WRITE_FIRST', type: 'RC', desc: 'RC RDMA Write First' },
      0x07: { name: 'RC_RDMA_WRITE_MIDDLE', type: 'RC', desc: 'RC RDMA Write Middle' },
      0x08: { name: 'RC_RDMA_WRITE_LAST', type: 'RC', desc: 'RC RDMA Write Last' },
      0x09: { name: 'RC_RDMA_WRITE_LAST_IMM', type: 'RC', desc: 'RC RDMA Write Last Immediate' },
      0x0A: { name: 'RC_RDMA_WRITE_ONLY', type: 'RC', desc: 'RC RDMA Write Only' },
      0x0B: { name: 'RC_RDMA_WRITE_ONLY_IMM', type: 'RC', desc: 'RC RDMA Write Only Immediate' },
      0x0C: { name: 'RC_RDMA_READ_REQ', type: 'RC', desc: 'RC RDMA Read Request' },
      0x10: { name: 'RC_RDMA_READ_RESP_FIRST', type: 'RC', desc: 'RC RDMA Read Response First' },
      0x11: { name: 'RC_RDMA_READ_RESP_MIDDLE', type: 'RC', desc: 'RC RDMA Read Response Middle' },
      0x12: { name: 'RC_RDMA_READ_RESP_LAST', type: 'RC', desc: 'RC RDMA Read Response Last' },
      0x16: { name: 'RC_ACK', type: 'RC', desc: 'Reliable Connection ACK' },
      0x81: { name: 'CNP', type: 'CONGESTION', desc: 'Congestion Notification Packet (DCQCN)' }
    }
  };

  function calculateHeadroom(params) {
    const speedGbps = Number(params.speedGbps) || 100;
    const cableLengthM = Number(params.cableLengthM) || 5;
    const cableType = params.cableType || 'DAC_COPPER';
    const propDelayNsPerM = PHYSICAL_CONSTANTS.CABLE_PROPAGATION_DELAY_NS_PER_M[cableType] || 5.0;

    const cableOneWayNs = cableLengthM * propDelayNsPerM;
    const cableRttNs = 2 * cableOneWayNs;

    let switchNs = typeof params.switchLatency === 'number'
      ? params.switchLatency
      : (PHYSICAL_CONSTANTS.ASIC_LATENCY_NS[params.switchLatency] || 500);

    let nicNs = typeof params.nicLatency === 'number'
      ? params.nicLatency
      : (PHYSICAL_CONSTANTS.NIC_REACTION_TIME_NS[params.nicLatency] || 350);

    const jitterMarginNs = Number(params.jitterMarginNs) || 150;
    const mtuBytes = Number(params.mtuBytes) || 9216;
    const cellSizeBytes = Number(params.asicCellSizeBytes) || 256;

    const totalFlightTimeNs = cableRttNs + switchNs + nicNs + jitterMarginNs;
    const bytesPerNs = speedGbps / 8;
    const inFlightBytes = Math.ceil(totalFlightTimeNs * bytesPerNs);
    const rawHeadroomBytes = inFlightBytes + mtuBytes;
    const cellsRequired = Math.ceil(rawHeadroomBytes / cellSizeBytes);
    const allocatedHeadroomBytes = cellsRequired * cellSizeBytes;
    const allocatedHeadroomKB = Math.round((allocatedHeadroomBytes / 1024) * 10) / 10;

    const recommendedXoffBytes = allocatedHeadroomBytes;
    const recommendedXonBytes = Math.max(cellSizeBytes, allocatedHeadroomBytes - (mtuBytes * 2));

    return {
      speedGbps,
      cableLengthM,
      cableType,
      cableRttNs,
      switchLatencyNs: switchNs,
      nicLatencyNs: nicNs,
      jitterMarginNs,
      totalFlightTimeNs,
      mtuBytes,
      cellSizeBytes,
      bytesPerNs,
      inFlightBytes,
      rawHeadroomBytes,
      cellsRequired,
      allocatedHeadroomBytes,
      allocatedHeadroomKB,
      recommendedXoffBytes,
      recommendedXonBytes,
      recommendedXoffKB: Math.round((recommendedXoffBytes / 1024) * 10) / 10,
      recommendedXonKB: Math.round((recommendedXonBytes / 1024) * 10) / 10
    };
  }

  function evaluateDCQCNThresholds(params) {
    const kMin = Number(params.kMinBytes) || (64 * 1024);
    const kMax = Number(params.kMaxBytes) || (256 * 1024);
    const pMax = Number(params.pMaxPercent) || 20;
    const xoff = Number(params.xoffBytes) || (384 * 1024);
    const headroom = Number(params.headroomBytes) || (60 * 1024);
    const totalBuffer = Number(params.totalBufferBytes) || (1024 * 1024);

    const issues = [];
    let isHealthy = true;

    if (kMin >= kMax) {
      issues.push({
        severity: 'CRITICAL',
        code: 'ECN_KMIN_GE_KMAX',
        message: `ECN Kmin (${kMin} B) must be strictly less than Kmax (${kMax} B). Current setup disables smooth WRED curve.`
      });
      isHealthy = false;
    }

    if (kMax >= xoff) {
      issues.push({
        severity: 'CRITICAL',
        code: 'PFC_BEFORE_ECN',
        message: `PFC Xoff threshold (${xoff} B) is less than or equal to ECN Kmax (${kMax} B). PFC pause will fire before ECN can complete endpoint rate throttling, causing pause storms and throughput collapse!`
      });
      isHealthy = false;
    } else {
      const ecnPfcBufferMargin = xoff - kMax;
      if (ecnPfcBufferMargin < (headroom * 0.5)) {
        issues.push({
          severity: 'WARNING',
          code: 'NARROW_ECN_PFC_MARGIN',
          message: `Buffer gap between ECN Kmax and PFC Xoff is only ${Math.round(ecnPfcBufferMargin / 1024)} KB. Under intense all-to-all incast, queue may jump straight into PFC pause before DCQCN CNPs take effect.`
        });
      }
    }

    if (kMin < 32 * 1024) {
      issues.push({
        severity: 'WARNING',
        code: 'KMIN_UNDERSIZED',
        message: `ECN Kmin (${Math.round(kMin / 1024)} KB) is very low. High-speed 100G–800G links will suffer premature throughput throttling on small micro-bursts.`
      });
    }

    if (pMax < 5 || pMax > 100) {
      issues.push({
        severity: 'WARNING',
        code: 'PMAX_OUT_OF_BOUNDS',
        message: `Pmax (${pMax}%) should be between 10% and 50% for stable DCQCN convergence without oscillation.`
      });
    }

    if (xoff + headroom > totalBuffer) {
      issues.push({
        severity: 'CRITICAL',
        code: 'BUFFER_OVERFLOW',
        message: `Combined PFC Xoff (${Math.round(xoff/1024)} KB) and Headroom (${Math.round(headroom/1024)} KB) exceeds Total Queue Buffer (${Math.round(totalBuffer/1024)} KB). Packet drops will occur!`
      });
      isHealthy = false;
    }

    const curvePoints = [];
    const stepCount = 10;
    const maxRange = Math.max(totalBuffer, xoff + headroom);
    for (let i = 0; i <= stepCount; i++) {
      const qDepth = (maxRange / stepCount) * i;
      let prob = 0;
      let state = 'CLEAR';

      if (qDepth < kMin) {
        prob = 0;
        state = 'NO_MARK';
      } else if (qDepth <= kMax) {
        prob = ((qDepth - kMin) / (kMax - kMin)) * (pMax / 100);
        state = 'ECN_RANDOM_MARK';
      } else if (qDepth < xoff) {
        prob = 1.0;
        state = 'ECN_100_MARK';
      } else {
        prob = 1.0;
        state = 'PFC_PAUSE_XOFF';
      }

      curvePoints.push({
        queueDepthBytes: Math.round(qDepth),
        queueDepthKB: Math.round(qDepth / 1024),
        markProbabilityPercent: Math.round(prob * 1000) / 10,
        state
      });
    }

    return {
      kMinBytes: kMin,
      kMinKB: Math.round(kMin / 1024),
      kMaxBytes: kMax,
      kMaxKB: Math.round(kMax / 1024),
      pMaxPercent: pMax,
      xoffBytes: xoff,
      xoffKB: Math.round(xoff / 1024),
      headroomBytes: headroom,
      headroomKB: Math.round(headroom / 1024),
      totalBufferBytes: totalBuffer,
      totalBufferKB: Math.round(totalBuffer / 1024),
      isHealthy,
      issues,
      curvePoints
    };
  }

  function encodeBTH(bth) {
    const opcode = (Number(bth.opcode) || 0x04) & 0xFF;
    const se = bth.solicitedEvent ? 1 : 0;
    const mig = bth.migReq ? 1 : 0;
    const pad = (Number(bth.padCount) || 0) & 0x03;
    const tver = 0;
    const flagsByte = (se << 7) | (mig << 6) | (pad << 4) | (tver & 0x0F);

    const pKey = (Number(bth.pKey) || 0xFFFF) & 0xFFFF;
    const destQp = (Number(bth.destQp) || 100) & 0xFFFFFF;
    const ackReq = bth.ackReq ? 1 : 0;
    const ackReservedByte = (ackReq << 7) & 0x80;
    const psn = (Number(bth.psn) || 0) & 0xFFFFFF;

    const bytes = new Uint8Array(12);
    bytes[0] = opcode;
    bytes[1] = flagsByte;
    bytes[2] = (pKey >> 8) & 0xFF;
    bytes[3] = pKey & 0xFF;
    bytes[4] = 0x00;
    bytes[5] = (destQp >> 16) & 0xFF;
    bytes[6] = (destQp >> 8) & 0xFF;
    bytes[7] = destQp & 0xFF;
    bytes[8] = ackReservedByte;
    bytes[9] = (psn >> 16) & 0xFF;
    bytes[10] = (psn >> 8) & 0xFF;
    bytes[11] = psn & 0xFF;

    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0').toUpperCase() + (i % 4 === 3 ? ' ' : '');
    }

    const meta = PHYSICAL_CONSTANTS.BTH_OPCODES[opcode] || {
      name: 'CUSTOM_OR_VENDOR_OPCODE',
      type: 'UNKNOWN',
      desc: 'Vendor or Extension Opcode'
    };

    return {
      bytes: Array.from(bytes),
      hexString: hex.trim(),
      lengthBytes: 12,
      opcode,
      opcodeName: meta.name,
      opcodeType: meta.type,
      opcodeDesc: meta.desc,
      solicitedEvent: !!se,
      migReq: !!mig,
      padCount: pad,
      pKey: '0x' + pKey.toString(16).padStart(4, '0').toUpperCase(),
      destQp,
      destQpHex: '0x' + destQp.toString(16).padStart(6, '0').toUpperCase(),
      ackReq: !!ackReq,
      psn,
      psnHex: '0x' + psn.toString(16).padStart(6, '0').toUpperCase()
    };
  }

  return {
    PHYSICAL_CONSTANTS,
    calculateHeadroom,
    evaluateDCQCNThresholds,
    encodeBTH
  };
}));
