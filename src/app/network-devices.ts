import { Vector } from './vector';
import { SeriesPoint } from './series-point';
import { Packet, PacketType } from './packet';

export interface Device {
  id: string;
  interfaces: Interface[];
  position: Vector;

  panBy(delta: Vector): void;
  attachLink(link: Link, ip: string): void;
  detachLink(link: Link): void;
  receivePacket(packet: Packet, link: Link): void;
}

export interface Host extends Device {
  isHost: boolean;
  flowList: Flow[];
  receiveList: FlowReceived[];
  getIp(): string;
  addNewFlow(dest: string, data: number, algorithm: AlgType, startTime: number): void;
  receivePacket(packet: Packet, link: Link): void;
  sendPacket(packet: Packet): void;
}

export interface Router extends Device {
  isRouter: boolean;
  lsdb: Link[];
  forwardPacket(packet: Packet): void;
  receivePacket(packet: Packet, link: Link): void;
  broadcast(packet: Packet, exclude: Link[]): void;
  attachLink(link: Link, ip: string): void;
  detachLink(link: Link): void;
  advertiseLsa(link: Link): void;
}

export function isDevice(dev: any): dev is Device {
  return isHost(dev) || isRouter(dev);
}

export function isHost(dev: any): dev is Host {
  return (<Host>dev).isHost;
}

export function isRouter(dev: any): dev is Router {
  return (<Router>dev).isRouter;
}

export interface Link {
  isLink: boolean;
  id: string;
  capacity: number;
  delay: number;
  lossRate: number;
  bufferSize: number;
  metric: number;
  src: Device;
  dst: Device;

  latencyStats: SeriesPoint[][];
  packetLossStats: SeriesPoint[][];
  throughputStats: SeriesPoint[][];
  bufferSizeStats: SeriesPoint[][];

  getOtherEnd(element: Device): Device;
  getHostIfPresent(): (Host | void);
  sendPacketFrom(source: Device, packet: Packet): void;
  cleanUp(): void;
  updateMetric(metric: number): void;
}

export function isLink(element: any): element is Link {
  return (<Link>element).isLink;
}

export class Interface {
  constructor(public port: number, public ip: string, public link: Link) {}
}

export class Route {
  constructor(public ip: string, public nextHop: Device) {}
}

export interface Flow {
  isFlow: boolean;
  flowId: string;
  cwnd: number;
  ssthresh: number;
  maxAckDup: number;
  sendingHost: Host;
  rateStats: SeriesPoint[][];
  cwndStats: SeriesPoint[][];
  rttStats: SeriesPoint[][];
  flowStatus: FlowStatus;
  onReceive(packet: Packet): void;
  updateAlg(alg: AlgType): void;
}

export interface CongestionControlAlg {
  onReceiveNewAck(): void;
  onReceiveDupAck(): void;
}

export interface FlowReceived {
  flowId: string; // id of the received flow
  rwnd: number; // Receive window size
  pktRecieved: number[]; // seq numbers of received packets
  nextAck: number; // seq number of the the next Ack packet
  onReceive(packet: Packet): void;
  getAckSeqNum(): number;
}

export enum AlgType {
  Tahoe = 'Tahoe',
  Reno = 'Reno',
  Vegas = 'Vegas',
  FAST = 'FAST'
}

export enum FlowStatus {
  Waiting,
  Complete,
  SS, // slow start
  CA, // comgestion avoidance
  FRFR, // fast retansmit/fast recovery
  HandShake
}
