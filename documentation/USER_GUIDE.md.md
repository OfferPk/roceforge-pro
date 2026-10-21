# RoCEForge Pro v1.0.0 — User & Operations Guide

## 1\. Quick Start Guide

### 1.1 Web Studio Usage

1. Open source-code/index.html in any modern web browser.  
2. Select one of the pre-configured industry presets:  
   - 800G GPU Supercluster: NVIDIA B200 / Hopper AI cluster topology.  
   - 100G/200G Storage NVMe-oF: High-throughput storage fabric.  
   - Vulnerable Deadlock Setup: Demonstrates how misaligned thresholds cause CI/CD failure.  
3. Adjust cable lengths, transceiver types, and switch ASIC models in real-time.  
4. Inspect the Buffer Memory Allocation Hierarchy bar to ensure Kmin \< Kmax \< Xoff.  
5. Run the 10-Point Zero-Trust Fabric Audit to verify cluster resilience.  
6. Switch to the Configuration Synthesizer tab to copy ready-to-deploy configurations for Arista EOS, NVIDIA Cumulus/SONiC, Cisco Nexus, or Juniper Junos.

---

## 2\. Command Line Interface (roceforge-cli.py)

The standalone Python CLI tool requires zero third-party dependencies and runs natively on Python 3.8+.

### 2.1 Calculate Lossless Headroom

python3 build/roceforge-cli.py analyze \--speed 800 \--cable-len 5 \--cable-type DAC\_COPPER \--switch-asic TOMAHAWK\_5 \--nic-model CONNECTX\_8 \--mtu 9216

### 2.2 Run 10-Point Zero-Trust Audit with CI/CD Gate

Enforce that production pull requests maintain at least a Grade A or A+ audit rating:

python3 build/roceforge-cli.py audit \--preset hyperscale-800g \--check-grade A

\# Exits with 0 on pass

python3 build/roceforge-cli.py audit \--preset vulnerable-deadlock \--check-grade A

\# Exits with 1 on failure

### 2.3 Synthesize Multi-Vendor Switch Configuration

python3 build/roceforge-cli.py synthesize \--vendor arista \--preset hyperscale-800g

python3 build/roceforge-cli.py synthesize \--vendor cumulus \--preset hyperscale-800g

python3 build/roceforge-cli.py synthesize \--vendor cisco \--preset hyperscale-800g

python3 build/roceforge-cli.py synthesize \--vendor juniper \--preset hyperscale-800g

python3 build/roceforge-cli.py synthesize \--vendor prometheus \--preset hyperscale-800g