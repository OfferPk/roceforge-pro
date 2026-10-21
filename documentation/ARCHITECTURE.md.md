# RoCEForge Pro v1.0.0 — Architecture & Engineering Manual

## 1\. Executive Summary & Protocol Overview

Distributed Large Language Model (LLM) training and High-Performance Computing (HPC) require ultra-low latency, high-bandwidth Remote Direct Memory Access (RDMA) over standard commodity Ethernet. RoCEv2 (RDMA over Converged Ethernet v2) encapsulates InfiniBand transport packets inside standard UDP/IP datagrams (UDP Destination Port 4791).

To make Ethernet lossless and high-performance, two foundational mechanisms must be combined:

1. Priority-based Flow Control (PFC, IEEE 802.1Qbb): Link-level flow control operating on specific 802.1p priorities (Traffic Classes), pausing upstream switches before ingress buffers overflow.  
2. Data Center Quantized Congestion Notification (DCQCN / ECN RFC 3168): End-to-end congestion control using Random Early Detection (WRED) marking on switch egress queues to signal endpoints via Congestion Notification Packets (CNP, opcode 0x81) to reduce transmission rates before PFC pause is triggered.

---

## 2\. Ingress Buffer Headroom Mathematical Derivation

When an ingress switch queue depth reaches the Xoff threshold, the switch generates an IEEE 802.1Qbb PFC pause frame back to the transmitting neighbor. Because the cable, transceiver, and switch ASIC pipelines have finite physical latency, packets that are already in flight or being serialized cannot be stopped immediately.

The switch ingress buffer must contain a dedicated Headroom Pool to absorb all in-flight bytes without dropping a single packet:

### 2.1 The Flight Reaction Loop (T\_flight)

T\_flight \= 2 \* T\_cable \+ T\_switch\_internal \+ T\_nic\_reaction \+ T\_jitter\_margin

Where:

- T\_cable \= L \* delta: One-way propagation delay over cable length L in meters (5.0 ns/m for DAC, 4.9 ns/m for AOC/SMF).  
- T\_switch\_internal: Switch internal latency (MAC RX, MMU queuing, MAC TX PFC generation): \~400-550ns on modern ASICs.  
- T\_nic\_reaction: Time for upstream NIC to receive, parse, and halt transmission: \~220-350ns on modern ConnectX NICs.  
- T\_jitter\_margin: Safety padding for serialization jitter (\~150ns).

### 2.2 In-Flight Byte Volume

Bytes\_flight \= ceil(T\_flight \* Link\_Speed / 8\)

### 2.3 Required Headroom Allocation

B\_headroom \= ceil((Bytes\_flight \+ MTU) / Cell\_Size) \* Cell\_Size

---

## 3\. PFC vs DCQCN/ECN Threshold Coordination

Strict Hierarchy Law: 0 \< Kmin \< Kmax \< Xoff \< B\_total

- If Xoff \<= Kmax, the switch triggers PFC pause frames BEFORE ECN rate-reduction can take effect. This converts benign congestion into line-halting pause storms, killing cluster throughput.  
- If Kmin is too low, link bandwidth is artificially throttled on routine bursty traffic.  
- If the gap Kmax \- Kmin is too narrow, the probability slope is too steep, causing severe DCQCN rate oscillations.

---

## 4\. PFC Deadlock Graph Theory & Hardware Watchdog

In multi-tier Clos networks, cyclic dependencies can form across buffer queues, producing a PFC Deadlock. To eliminate deadlocks:

1. Hardware PFC Watchdog monitors how long a queue remains in XOFF pause.  
2. If paused duration exceeds detection timer (\<= 100-200ms), switch drops incoming frames on stuck queue to break dependency loop, increments telemetry counter, and alerts operators.