/**
 * RoCEForge Pro - 10-Point Zero-Trust AI Fabric & Deadlock Prevention Auditor
 * Version: 1.0.0
 * Evaluates Lossless Ethernet configurations against strict stability, deadlock immunity, and AI training throughput benchmarks.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RoCESecurityAuditor = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const AUDIT_RULES = [
    {
      id: 'lossless_queue_isolation',
      name: 'Dedicated Lossless Priority Isolation',
      weight: 12,
      category: 'QoS & Flow Control',
      description: 'PFC must be strictly enabled only on dedicated RDMA traffic classes (typically 802.1p priority 3 or 4). Enabling PFC on priority 0 (best effort) or control planes causes system-wide lockups.'
    },
    {
      id: 'dscp_trust_boundary',
      name: 'DSCP Trust & Class Mapping',
      weight: 10,
      category: 'Zero-Trust Architecture',
      description: 'Switches must maintain strict DSCP trust mode on all leaf access and spine inter-switch links, mapping DSCP 26 (or custom RoCE DSCP) directly into the lossless traffic class without untrusted remarking.'
    },
    {
      id: 'pfc_ecn_threshold_ordering',
      name: 'PFC vs ECN Threshold Hierarchy',
      weight: 15,
      category: 'Congestion Control',
      description: 'To prevent destructive pause storms, ECN thresholds must trigger rate reduction BEFORE PFC pauses links: 0 < Kmin < Kmax < Xoff. Violating this order causes full line pauses on minor congestion.'
    },
    {
      id: 'headroom_adequacy',
      name: 'Physical Buffer Headroom Margin',
      weight: 12,
      category: 'Buffer Architecture',
      description: 'Allocated ingress buffer headroom must exceed the total in-flight delay volume (2x cable propagation + switch latency + NIC reaction time) plus 1 full MTU packet to prevent silent drops.'
    },
    {
      id: 'pfc_watchdog_deadlock_prevention',
      name: 'PFC Watchdog & Deadlock Auto-Recovery',
      weight: 15,
      category: 'Deadlock Immunity',
      description: 'Hardware PFC Watchdog must be enabled with detection timer <= 200ms and automatic recovery action (drop stuck packets or temporarily unpause queue) to break cyclic dependency buffer deadlocks.'
    },
    {
      id: 'mtu_parity_jumbo',
      name: 'End-to-End Jumbo MTU Parity (9216B)',
      weight: 8,
      category: 'Throughput Optimization',
      description: 'AI collective operations (AllReduce/AllToAll) require 9000-9216B Jumbo Frames. Any MTU mismatch between NICs, leaves, and spines causes silent packet discards or software fragmentation.'
    },
    {
      id: 'shared_buffer_alpha',
      name: 'Dynamic Shared Buffer Alpha Sizing',
      weight: 8,
      category: 'Buffer Architecture',
      description: 'Dynamic buffer sharing pool should configure alpha between 1 and 8 (ideally alpha=2 or 4). Static allocations or extreme alpha values lead to queue starvation or premature buffer exhaustion.'
    },
    {
      id: 'cnp_priority_acceleration',
      name: 'CNP (Congestion Notification Packet) Acceleration',
      weight: 6,
      category: 'Congestion Control',
      description: 'Congestion Notification Packets (CNP, opcode 0x81) must be prioritized with high priority (DSCP 48 / CoS 6) so rate-throttling signals bypass congested data queues without delay.'
    },
    {
      id: 'ecn_pmax_slope',
      name: 'ECN WRED Marking Gradient & Stability',
      weight: 7,
      category: 'Congestion Control',
      description: 'ECN maximum marking probability Pmax must be >= 10% and the buffer delta (Kmax - Kmin) must be >= 128 KB to maintain smooth rate scaling and prevent step-function throughput oscillation.'
    },
    {
      id: 'telemetry_and_alerting',
      name: 'Lossless Telemetry & Drift Monitoring',
      weight: 7,
      category: 'Observability',
      description: 'PFC pause frame counters (TX/RX per priority), buffer drop counters, and PFC watchdog trigger events must be exported to Prometheus or streaming telemetry with automated alerting.'
    }
  ];

  function auditRoCEFabric(config) {
    const results = [];
    let earnedPoints = 0;
    let totalWeight = 0;

    {
      const rule = AUDIT_RULES.find(r => r.id === 'lossless_queue_isolation');
      totalWeight += rule.weight;
      const pfcPrio = Number(config.pfcPriority !== undefined ? config.pfcPriority : 3);
      const isDedicated = (pfcPrio === 3 || pfcPrio === 4);
      const pfcOnPrio0 = !!config.pfcOnBestEffort;

      if (isDedicated && !pfcOnPrio0 && config.pfcEnabled) {
        earnedPoints += rule.weight;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: rule.weight,
          maxScore: rule.weight,
          passed: true,
          details: `PFC is cleanly isolated on dedicated lossless Priority ${pfcPrio}. Priority 0 best-effort traffic is unpaused.`
        });
      } else {
        const score = (!config.pfcEnabled) ? 0 : (pfcOnPrio0 ? 0 : 4);
        earnedPoints += score;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score,
          maxScore: rule.weight,
          passed: false,
          details: pfcOnPrio0
            ? 'CRITICAL HAZARD: PFC is enabled on Priority 0 or non-dedicated queues, causing global cluster pauses on web/control traffic!'
            : (!config.pfcEnabled ? 'PFC is completely disabled; RoCEv2 will experience heavy packet drops under buffer pressure.' : `PFC set on non-standard Priority ${pfcPrio}.`)
        });
      }
    }

    {
      const rule = AUDIT_RULES.find(r => r.id === 'dscp_trust_boundary');
      totalWeight += rule.weight;
      const trustDscp = !!config.trustDscp;
      const dscpMapped = Number(config.dscpRoce || 26);

      if (trustDscp && (dscpMapped === 26 || dscpMapped === 46 || dscpMapped === 48)) {
        earnedPoints += rule.weight;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: rule.weight,
          maxScore: rule.weight,
          passed: true,
          details: `Strict DSCP trust enabled. RoCE traffic tagged with DSCP ${dscpMapped} maps consistently to lossless queue.`
        });
      } else if (trustDscp) {
        const score = 5;
        earnedPoints += score;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score,
          maxScore: rule.weight,
          passed: false,
          details: `DSCP trust enabled, but non-standard DSCP ${dscpMapped} may cause interoperability issues across multi-vendor spines.`
        });
      } else {
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: 0,
          maxScore: rule.weight,
          passed: false,
          details: 'FAIL: DSCP trust mode is disabled or set to rewrite; RDMA packets will be remarked to best-effort lossy queues.'
        });
      }
    }

    {
      const rule = AUDIT_RULES.find(r => r.id === 'pfc_ecn_threshold_ordering');
      totalWeight += rule.weight;
      const kMin = Number(config.kMinBytes) || (64 * 1024);
      const kMax = Number(config.kMaxBytes) || (256 * 1024);
      const xoff = Number(config.xoffBytes) || (384 * 1024);

      if (kMin < kMax && kMax < xoff) {
        earnedPoints += rule.weight;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: rule.weight,
          maxScore: rule.weight,
          passed: true,
          details: `Optimal hierarchy: Kmin (${Math.round(kMin/1024)}KB) < Kmax (${Math.round(kMax/1024)}KB) < PFC Xoff (${Math.round(xoff/1024)}KB). ECN smoothly reduces rate before PFC pause fires.`
        });
      } else {
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: 0,
          maxScore: rule.weight,
          passed: false,
          details: `CRITICAL FLAW: Threshold hierarchy violated (Kmin: ${Math.round(kMin/1024)}KB, Kmax: ${Math.round(kMax/1024)}KB, Xoff: ${Math.round(xoff/1024)}KB). PFC will pause links before ECN DCQCN can throttle endpoints, triggering pause storms.`
        });
      }
    }

    {
      const rule = AUDIT_RULES.find(r => r.id === 'headroom_adequacy');
      totalWeight += rule.weight;
      const allocatedHeadroom = Number(config.allocatedHeadroomBytes) || 0;
      const calculatedHeadroom = Number(config.requiredHeadroomBytes) || 0;

      if (allocatedHeadroom >= calculatedHeadroom && allocatedHeadroom > 0) {
        earnedPoints += rule.weight;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: rule.weight,
          maxScore: rule.weight,
          passed: true,
          details: `Buffer headroom (${Math.round(allocatedHeadroom/1024)}KB) satisfies physical flight time requirement (${Math.round(calculatedHeadroom/1024)}KB) + MTU safety margin.`
        });
      } else {
        const score = Math.max(0, Math.floor(rule.weight * (allocatedHeadroom / Math.max(1, calculatedHeadroom))));
        earnedPoints += score;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score,
          maxScore: rule.weight,
          passed: false,
          details: `DEFICIT: Allocated headroom (${Math.round(allocatedHeadroom/1024)}KB) is below physical RTT in-flight volume (${Math.round(calculatedHeadroom/1024)}KB). Packets in transit after Xoff will drop!`
        });
      }
    }

    {
      const rule = AUDIT_RULES.find(r => r.id === 'pfc_watchdog_deadlock_prevention');
      totalWeight += rule.weight;
      const wdEnabled = !!config.pfcWatchdogEnabled;
      const wdTimerMs = Number(config.pfcWatchdogTimerMs) || 100;
      const wdAction = config.pfcWatchdogAction || 'drop';

      if (wdEnabled && wdTimerMs <= 200 && wdAction === 'drop') {
        earnedPoints += rule.weight;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: rule.weight,
          maxScore: rule.weight,
          passed: true,
          details: `PFC Watchdog enabled with tight ${wdTimerMs}ms detection timer and automatic stuck-queue packet drop to break deadlocks.`
        });
      } else if (wdEnabled && wdTimerMs <= 500) {
        const score = 8;
        earnedPoints += score;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score,
          maxScore: rule.weight,
          passed: false,
          details: `PFC Watchdog enabled, but detection timer (${wdTimerMs}ms) or action (${wdAction}) is slow, allowing temporary GPU pipeline stalls.`
        });
      } else {
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: 0,
          maxScore: rule.weight,
          passed: false,
          details: 'CRITICAL HAZARD: PFC Watchdog is DISABLED. Any cyclic buffer loop across spine-leaf tiers will permanently freeze GPU cluster communication!'
        });
      }
    }

    {
      const rule = AUDIT_RULES.find(r => r.id === 'mtu_parity_jumbo');
      totalWeight += rule.weight;
      const mtu = Number(config.mtuBytes) || 9216;

      if (mtu >= 9000 && mtu <= 9216) {
        earnedPoints += rule.weight;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: rule.weight,
          maxScore: rule.weight,
          passed: true,
          details: `Standard Jumbo MTU (${mtu} Bytes) configured across fabric for maximum RDMA throughput and minimal CPU interrupt overhead.`
        });
      } else {
        const score = mtu === 1500 ? 2 : 4;
        earnedPoints += score;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score,
          maxScore: rule.weight,
          passed: false,
          details: `Standard MTU (${mtu} Bytes) is sub-optimal for RoCEv2. RDMA payloads will fragment or waste 3-5x more bandwidth on packet headers.`
        });
      }
    }

    {
      const rule = AUDIT_RULES.find(r => r.id === 'shared_buffer_alpha');
      totalWeight += rule.weight;
      const alpha = Number(config.bufferAlpha !== undefined ? config.bufferAlpha : 2);

      if (alpha >= 1 && alpha <= 4) {
        earnedPoints += rule.weight;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: rule.weight,
          maxScore: rule.weight,
          passed: true,
          details: `Dynamic shared buffer alpha (${alpha}) balanced to prevent queue starvation while accommodating high burst incast.`
        });
      } else if (alpha > 4 && alpha <= 8) {
        const score = 5;
        earnedPoints += score;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score,
          maxScore: rule.weight,
          passed: false,
          details: `Aggressive alpha (${alpha}) risks starving other active queues during simultaneous multi-tenant GPU job runs.`
        });
      } else {
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: 2,
          maxScore: rule.weight,
          passed: false,
          details: `Static or extreme alpha (${alpha}) causes inefficient switch MMU memory utilization.`
        });
      }
    }

    {
      const rule = AUDIT_RULES.find(r => r.id === 'cnp_priority_acceleration');
      totalWeight += rule.weight;
      const cnpDscp = Number(config.cnpDscp || 48);
      const cnpHighPrio = !!config.cnpHighPriority || (cnpDscp >= 46);

      if (cnpHighPrio) {
        earnedPoints += rule.weight;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: rule.weight,
          maxScore: rule.weight,
          passed: true,
          details: `CNP congestion feedback packets are expedited (DSCP ${cnpDscp}), accelerating sender rate throttling.`
        });
      } else {
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: 1,
          maxScore: rule.weight,
          passed: false,
          details: 'CNP packets share best-effort queues. When congestion occurs, CNPs are delayed, postponing rate backoff and inducing PFC.'
        });
      }
    }

    {
      const rule = AUDIT_RULES.find(r => r.id === 'ecn_pmax_slope');
      totalWeight += rule.weight;
      const pMax = Number(config.pMaxPercent || 20);
      const kMin = Number(config.kMinBytes) || (64 * 1024);
      const kMax = Number(config.kMaxBytes) || (256 * 1024);
      const deltaKB = Math.round((kMax - kMin) / 1024);

      if (pMax >= 10 && pMax <= 50 && deltaKB >= 128) {
        earnedPoints += rule.weight;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: rule.weight,
          maxScore: rule.weight,
          passed: true,
          details: `Smooth ECN slope: Pmax=${pMax}%, Delta=${deltaKB}KB. Sufficient headroom for progressive DCQCN alpha convergence.`
        });
      } else {
        const score = 3;
        earnedPoints += score;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score,
          maxScore: rule.weight,
          passed: false,
          details: `Sub-optimal ECN slope: Pmax=${pMax}%, Delta=${deltaKB}KB. Rapid step-function marking causes rate collapse and bandwidth underutilization.`
        });
      }
    }

    {
      const rule = AUDIT_RULES.find(r => r.id === 'telemetry_and_alerting');
      totalWeight += rule.weight;
      const telemetry = !!config.telemetryEnabled;

      if (telemetry) {
        earnedPoints += rule.weight;
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: rule.weight,
          maxScore: rule.weight,
          passed: true,
          details: 'Lossless telemetry active: PFC RX/TX pauses, headroom watermarks, and watchdog drop counters exported to Prometheus.'
        });
      } else {
        results.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          score: 0,
          maxScore: rule.weight,
          passed: false,
          details: 'No PFC/lossless streaming telemetry configured. Operators have zero visibility into silent pause propagation.'
        });
      }
    }

    const percentage = Math.round((earnedPoints / totalWeight) * 100);
    let grade = 'F';
    if (percentage >= 95) grade = 'A+';
    else if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';

    return {
      percentage,
      grade,
      earnedPoints,
      totalWeight,
      isPassing: percentage >= 80,
      results
    };
  }

  return {
    AUDIT_RULES,
    auditRoCEFabric
  };
}));
