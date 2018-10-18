export const TIME_SLOWDOWN = 100;
export const BROADCAST_IP = "0.0.0.0";
export const OSPF_SIZE = 1000;  // 1KB
export const PKT_SIZE = 1000;   // 1KB
export const HEADER_SIZE = 20;  // 20B
export const CTL_SIZE = 64;  // 64B
export const PAYLOAD_SIZE = PKT_SIZE - HEADER_SIZE;
export const IPv4 = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/;

export const RWND_INIT = Number.MAX_VALUE;
export const SSTHRESH_INIT = Number.MAX_VALUE;

export const ALPHA = 0.125;
export const BETA = 2; // RTO = BETA * RTT
export const MEGA = 1000 * 1000; // 1 MB = 1000 * 1000 Byte
export const MIN_RTO = 100 * TIME_SLOWDOWN; // 100ms lower bound

// para,eters for Vegas
export const VEGAS_ALPHA = 100;
export const VEGAS_BETA = 100;
