export const TIME_SLOWDOWN = 100;
export const BROADCAST_IP = "0.0.0.0";
export const OSPF_SIZE = 1000;  // 1KB
export const PKT_SIZE = 1000;   // 1KB
export const HEADER_SIZE = 20;  // 20B
export const CTL_SIZE = 64;  // 64B
export const PAYLOAD_SIZE = PKT_SIZE - HEADER_SIZE;
export const MAX_STATS_LENGTH = 80;
export const AVG_LENGTH = 0.1 * TIME_SLOWDOWN;

export const SSTHRESH_INIT = Number.MAX_VALUE;

export const ALPHA = 0.125;
export const BETA = 2; // RTO = BETA * RTT
export const BYTES_PER_MB = 1000 * 1000; // 1 MB = 1000 * 1000 Byte
export const MIN_RTO = 100 * TIME_SLOWDOWN; // 100ms lower bound
export const BPMS_PER_MBPS = 125;

// parameters for Vegas
export const VEGAS_ALPHA = 0.0003;
export const VEGAS_BETA = 0.0006;
export const VEGAS_GAMMA = VEGAS_BETA;
